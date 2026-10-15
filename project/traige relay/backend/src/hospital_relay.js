/**
 * Hospital Relay Bridge (Triage Relay -> Hospital Relay)
 *
 * When a paramedic selects a hospital, the Triage Relay server forwards the
 * incident to the Hospital Relay server (POST /api/cases) so the alert shows
 * up on the hospital's own dashboard.
 *
 * Settings (set automatically by "npm start" in the project root):
 *   HOSPITAL_RELAY_URL     e.g. http://localhost:4100
 *   RELAY_SHARED_SECRET    shared secret sent as the X-Relay-Key header
 *   HOSPITAL_ID_MAP        optional JSON, e.g. {"hos_001":"hosp_metro_01"}
 */

const crypto = require('crypto');

const DEFAULT_HOSPITAL_ID_MAP = { hos_001: 'hosp_metro_01' };
const ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1500];
const TIMEOUT_MS = 4000;

function getHospitalIdMap() {
  if (process.env.HOSPITAL_ID_MAP) {
    try {
      return JSON.parse(process.env.HOSPITAL_ID_MAP);
    } catch (e) {
      console.warn('[Hospital Relay] HOSPITAL_ID_MAP is not valid JSON, using default mapping');
    }
  }
  return DEFAULT_HOSPITAL_ID_MAP;
}

function esiToPriority(esiLevel) {
  const level = Number(esiLevel);
  if (level === 1) return 'CRITICAL';
  if (level === 2) return 'HIGH';
  if (level === 3) return 'MEDIUM';
  return 'LOW';
}

function prettify(code) {
  return String(code)
    .toLowerCase()
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildVitalSigns(vitals) {
  if (!vitals) return [];
  const at = vitals.takenAt || new Date().toISOString();
  const out = [];
  const num = v => v !== null && v !== undefined && Number.isFinite(Number(v));
  if (num(vitals.heartRate)) out.push({ type: 'heart_rate', value: Number(vitals.heartRate), unit: 'bpm', measured_at: at });
  if (num(vitals.sbp) && num(vitals.dbp)) out.push({ type: 'blood_pressure', value: `${vitals.sbp}/${vitals.dbp}`, unit: 'mmHg', measured_at: at });
  if (num(vitals.spo2)) out.push({ type: 'oxygen_saturation', value: Number(vitals.spo2), unit: '%', measured_at: at });
  if (num(vitals.respiratoryRate)) out.push({ type: 'respiratory_rate', value: Number(vitals.respiratoryRate), unit: '/min', measured_at: at });
  if (num(vitals.temperatureC)) out.push({ type: 'temperature', value: Number(vitals.temperatureC), unit: 'C', measured_at: at });
  if (num(vitals.gcsTotal)) {
    out.push({ type: 'glasgow_coma_scale', value: Number(vitals.gcsTotal), unit: 'points', measured_at: at });
  }
  return out;
}

/**
 * Convert a Triage Relay INCOMING_PATIENT payload into the Hospital Relay case format.
 * The patient's name is intentionally NOT sent (the hospital format has no name field).
 */
function buildHospitalCase(payload, hospitalId) {
  const hospitalMap = getHospitalIdMap();
  const mappedHospitalId = hospitalMap[hospitalId];
  const trauma = Array.isArray(payload.traumaTypes) ? payload.traumaTypes : [];
  const traumaText = trauma.length ? trauma.map(prettify).join(', ') : 'Emergency Transport';
  const mechanism = payload.mechanism ? String(payload.mechanism) : '';
  const emergencyType = (mechanism ? `${traumaText} (${mechanism})` : traumaText).slice(0, 255);

  const patient = payload.patient || {};
  const age = Number.isInteger(patient.ageYears) ? patient.ageYears : null;
  const sex = patient.sex ? String(patient.sex).toLowerCase() : null;
  const summaryParts = [];
  if (age !== null) summaryParts.push(`${age}y`);
  if (sex) summaryParts.push(sex);
  const summary = `${summaryParts.join(' ')}${summaryParts.length ? ': ' : ''}${traumaText}`.slice(0, 1000);

  const etaMinutes = Number.isFinite(Number(payload.etaMinutes)) ? Number(payload.etaMinutes) : 15;
  const now = Date.now();

  return {
    case_id: String(payload.incidentId),
    idempotency_key: `triage_${payload.incidentId}`.slice(0, 128),
    source: 'TRIAGE_RELAY',
    hospital_id: mappedHospitalId,
    submitted_at: new Date(now).toISOString(),
    priority: esiToPriority(payload.esiLevel),
    emergency_type: emergencyType,
    patient_condition_summary: summary,
    patient: {
      age,
      age_group: patient.isPediatric ? 'PEDIATRIC' : 'ADULT',
      sex
    },
    vital_signs: buildVitalSigns(payload.vitals),
    notes: payload.paramedicNote ? String(payload.paramedicNote).slice(0, 5000) : '',
    paramedic: {
      unit_id: String(payload.ambulanceId || 'AMBULANCE').slice(0, 50),
      name_or_code: 'Triage Relay crew'
    },
    eta: new Date(now + etaMinutes * 60000).toISOString(),
    eta_minutes: Math.min(Math.max(etaMinutes, 0), 1440)
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send one incident to the hospital server.
 * Returns { state: 'DELIVERED' | 'FAILED' | 'SKIPPED', ... } and never throws.
 */
async function forwardIncidentToHospital(payload, hospitalId) {
  const hospitalMap = getHospitalIdMap();
  if (!hospitalMap[hospitalId]) {
    return { state: 'SKIPPED', reason: `No live hospital portal is linked to ${hospitalId}` };
  }

  const baseUrl = process.env.HOSPITAL_RELAY_URL;
  const secret = process.env.RELAY_SHARED_SECRET;
  if (!baseUrl || !secret) {
    return { state: 'FAILED', reason: 'Hospital link is not configured (start both servers with "npm start" from the project root)' };
  }

  const body = JSON.stringify(buildHospitalCase(payload, hospitalId));
  let lastReason = 'unknown error';

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}/api/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Relay-Key': secret },
        body,
        signal: controller.signal
      });
      if (res.ok) {
        return { state: 'DELIVERED', attempts: attempt };
      }
      let detail = '';
      try { detail = JSON.stringify(await res.json()); } catch (e) { /* ignore */ }
      lastReason = `Hospital server answered HTTP ${res.status} ${detail}`.slice(0, 400);
      // 4xx means the data itself was rejected: retrying will not help.
      if (res.status >= 400 && res.status < 500) {
        return { state: 'FAILED', reason: lastReason, attempts: attempt };
      }
    } catch (err) {
      lastReason = err.name === 'AbortError' ? 'Hospital server did not answer in time' : `Hospital server unreachable (${err.message})`;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < ATTEMPTS) await sleep(RETRY_DELAYS_MS[attempt - 1] || 1500);
  }

  return { state: 'FAILED', reason: lastReason, attempts: ATTEMPTS };
}

function relayKeyMatches(provided) {
  const secret = process.env.RELAY_SHARED_SECRET;
  if (!secret || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(secret));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  buildHospitalCase,
  forwardIncidentToHospital,
  relayKeyMatches,
  esiToPriority,
  getHospitalIdMap
};
