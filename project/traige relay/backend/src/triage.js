/**
 * Triage Relay: Clinical Triage Calculators
 * Source: 02_PARAMEDIC_INTAKE_MODULE.md Section 5
 *
 * Implements:
 * - Glasgow Coma Scale (GCS)
 * - Revised Trauma Score (RTS Triage & Weighted)
 * - Emergency Severity Index (ESI) Decision-Support Suggestion Rule Engine
 * - Inline Vitals Boundary & Soft Warning Evaluator
 */

/**
 * Calculates Glasgow Coma Scale Total
 * @param {number} eye - Eye opening (1-4)
 * @param {number} verbal - Verbal response (1-5)
 * @param {number} motor - Motor response (1-6)
 * @returns {number} GCS total score (3-15)
 */
function calculateGcsTotal(eye, verbal, motor) {
  const e = Math.min(4, Math.max(1, Number(eye) || 1));
  const v = Math.min(5, Math.max(1, Number(verbal) || 1));
  const m = Math.min(6, Math.max(1, Number(motor) || 1));
  return e + v + m;
}

/**
 * Returns coded value for GCS (0-4)
 * @param {number} gcs - GCS total (3-15)
 */
function getGcsCode(gcs) {
  if (gcs >= 13) return 4;
  if (gcs >= 9) return 3;
  if (gcs >= 6) return 2;
  if (gcs >= 4) return 1;
  return 0;
}

/**
 * Returns coded value for Systolic Blood Pressure (0-4)
 * @param {number} sbp - SBP in mmHg
 */
function getSbpCode(sbp) {
  const val = Number(sbp);
  if (val > 89) return 4;
  if (val >= 76) return 3;
  if (val >= 50) return 2;
  if (val >= 1) return 1;
  return 0;
}

/**
 * Returns coded value for Respiratory Rate (0-4)
 * @param {number} rr - RR in breaths/min
 */
function getRrCode(rr) {
  const val = Number(rr);
  if (val >= 10 && val <= 29) return 4;
  if (val > 29) return 3;
  if (val >= 6 && val <= 9) return 2;
  if (val >= 1 && val <= 5) return 1;
  return 0;
}

/**
 * Calculates Revised Trauma Score (RTS Triage, 0-12)
 * Score <= 11 indicates transfer to a designated trauma center.
 */
function calculateRtsTriage(gcs, sbp, rr) {
  const gcsCode = getGcsCode(gcs);
  const sbpCode = getSbpCode(sbp);
  const rrCode = getRrCode(rr);
  return gcsCode + sbpCode + rrCode;
}

/**
 * Calculates Revised Trauma Score (RTS Weighted, 0-7.8408)
 * Formula: 0.9368*gcsCode + 0.7326*sbpCode + 0.2908*rrCode
 */
function calculateRtsWeighted(gcs, sbp, rr) {
  const gcsCode = getGcsCode(gcs);
  const sbpCode = getSbpCode(sbp);
  const rrCode = getRrCode(rr);
  const weighted = 0.9368 * gcsCode + 0.7326 * sbpCode + 0.2908 * rrCode;
  return Math.round(weighted * 1000) / 1000;
}

/**
 * Decision-support helper to suggest an initial ESI level with clinical explanation
 * @param {Object} params
 * @param {Object} params.vitals - { sbp, dbp, heartRate, respiratoryRate, spo2 }
 * @param {number} params.gcsTotal - (3-15)
 * @param {string[]} params.traumaTypes - array of conditions
 * @param {boolean} [params.isPediatric]
 * @returns {{ suggestedLevel: number, reasons: string[] }}
 */
function suggestEsiLevel({ vitals = {}, gcsTotal = 15, traumaTypes = [], isPediatric = false }) {
  const sbp = Number(vitals.sbp ?? 120);
  const hr = Number(vitals.heartRate ?? 80);
  const rr = Number(vitals.respiratoryRate ?? 16);
  const spo2 = Number(vitals.spo2 ?? 98);
  const traumaList = Array.isArray(traumaTypes) ? traumaTypes : [];

  const rtsTriage = calculateRtsTriage(gcsTotal, sbp, rr);
  const reasons = [];

  // 1. ESI 1 (Immediate / Resuscitation) Check
  const isEsi1Reasons = [];
  if (sbp === 0 || hr === 0) isEsi1Reasons.push('Pulseless / SBP 0 / Cardiac arrest');
  if (gcsTotal <= 8) isEsi1Reasons.push(`Severe unconsciousness (GCS ${gcsTotal} <= 8)`);
  if (spo2 < 85) isEsi1Reasons.push(`Critical hypoxemia (SpO2 ${spo2}% < 85%)`);
  if (rr < 6 && rr > 0) isEsi1Reasons.push(`Impending respiratory failure (RR ${rr}/min < 6)`);
  if (traumaList.includes('MAJOR_BLEEDING') && sbp < 90) {
    isEsi1Reasons.push(`Exsanguinating hemorrhage with shock (SBP ${sbp} mmHg < 90)`);
  }

  if (isEsi1Reasons.length > 0) {
    return {
      suggestedLevel: 1,
      reasons: isEsi1Reasons
    };
  }

  // 2. ESI 2 (Emergent / High Risk) Check
  const isEsi2Reasons = [];
  if (gcsTotal >= 9 && gcsTotal <= 12) isEsi2Reasons.push(`Moderate altered mental status (GCS ${gcsTotal})`);
  if (spo2 >= 85 && spo2 <= 89) isEsi2Reasons.push(`Moderate hypoxemia (SpO2 ${spo2}%)`);
  if (sbp >= 90 && sbp <= 100 && hr > 120) isEsi2Reasons.push(`Borderline hypotension with tachycardia (SBP ${sbp}, HR ${hr})`);
  if (rtsTriage <= 10) isEsi2Reasons.push(`Compromised physiological score (RTS Triage ${rtsTriage} <= 10)`);
  if (traumaList.includes('CARDIAC_STEMI_SUSPECTED')) isEsi2Reasons.push('Suspected Acute Coronary Syndrome / STEMI');
  if (traumaList.includes('STROKE_SUSPECTED')) isEsi2Reasons.push('Suspected Acute Stroke / CVA within time window');
  if (traumaList.includes('AMPUTATION')) isEsi2Reasons.push('Traumatic amputation requiring limb salvage');
  if (traumaList.includes('PENETRATING_INJURY')) isEsi2Reasons.push('Penetrating chest/abdominal wound');
  if (traumaList.includes('BURNS') && isPediatric) isEsi2Reasons.push('Pediatric major burn trauma');

  if (isEsi2Reasons.length > 0) {
    return {
      suggestedLevel: 2,
      reasons: isEsi2Reasons
    };
  }

  // 3. Otherwise ESI 3 (Urgent)
  return {
    suggestedLevel: 3,
    reasons: ['Stable baseline vitals requiring multi-disciplinary evaluation or intervention']
  };
}

/**
 * Checks for clinical soft warnings (non-blocking warning flags)
 * @param {Object} vitals
 * @param {number} gcsTotal
 * @returns {Array<{ parameter: string, message: string, severity: 'WARNING' | 'CRITICAL' }>}
 */
function evaluateVitalsWarnings(vitals = {}, gcsTotal = 15) {
  const warnings = [];
  const sbp = Number(vitals.sbp);
  const hr = Number(vitals.heartRate);
  const rr = Number(vitals.respiratoryRate);
  const spo2 = Number(vitals.spo2);

  if (!isNaN(spo2) && spo2 < 90) {
    warnings.push({
      parameter: 'SpO2',
      message: `Low Oxygen Saturation (${spo2}% < 90%)`,
      severity: spo2 < 85 ? 'CRITICAL' : 'WARNING'
    });
  }

  if (!isNaN(sbp) && sbp < 90) {
    warnings.push({
      parameter: 'SBP',
      message: `Hypotension (${sbp} mmHg < 90 mmHg)`,
      severity: sbp < 75 ? 'CRITICAL' : 'WARNING'
    });
  }

  if (!isNaN(hr) && (hr > 130 || hr < 50)) {
    warnings.push({
      parameter: 'HeartRate',
      message: hr > 130 ? `Severe Tachycardia (${hr} bpm > 130)` : `Bradycardia (${hr} bpm < 50)`,
      severity: hr > 150 || hr < 40 ? 'CRITICAL' : 'WARNING'
    });
  }

  if (gcsTotal <= 8) {
    warnings.push({
      parameter: 'GCS',
      message: `Severe Neurological Deficit (GCS ${gcsTotal} <= 8)`,
      severity: 'CRITICAL'
    });
  }

  if (!isNaN(rr) && (rr < 10 || rr > 29)) {
    warnings.push({
      parameter: 'RespiratoryRate',
      message: rr < 10 ? `Bradypnea (${rr} /min < 10)` : `Tachypnea (${rr} /min > 29)`,
      severity: rr < 8 || rr > 35 ? 'CRITICAL' : 'WARNING'
    });
  }

  return warnings;
}

module.exports = {
  calculateGcsTotal,
  getGcsCode,
  getSbpCode,
  getRrCode,
  calculateRtsTriage,
  calculateRtsWeighted,
  suggestEsiLevel,
  evaluateVitalsWarnings
};
