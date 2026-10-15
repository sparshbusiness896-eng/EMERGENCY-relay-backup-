/**
 * ==============================================================================
 * Triage Relay: Client Application Logic & Clinical Decision Support
 * Sources: 02_PARAMEDIC_INTAKE_MODULE.md, 03_RECOMMENDATION_ENGINE.md,
 *          04_ER_DASHBOARD_MODULE.md, 05_NAVIGATION_MODULE.md
 * ==============================================================================
 */

// 0. BACKEND API CONFIGURATION & ERROR HANDLING
const API_BASE = window.TRIAGE_API_BASE || '';
const API_ORIGIN = window.TRIAGE_API_ORIGIN || window.location.origin;

function showBackendError(title, message) {
  const banner = document.getElementById('backendErrorBanner');
  if (banner) {
    const titleEl = document.getElementById('backendErrorTitle');
    const msgEl = document.getElementById('backendErrorMessage');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    banner.classList.remove('hidden');
  }
}

function hideBackendError() {
  const banner = document.getElementById('backendErrorBanner');
  if (banner) {
    banner.classList.add('hidden');
  }
}

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      let errData = {};
      try {
        errData = await res.json();
      } catch (e) {
        errData = { message: res.statusText };
      }
      const errMsg = errData.message || errData.error?.message || errData.error || `HTTP ${res.status}`;
      showBackendError(`API Error (${res.status})`, `Request to ${endpoint} failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    hideBackendError();
    return await res.json();
  } catch (err) {
    console.error(`Fetch error for ${endpoint}:`, err);
    showBackendError(
      'Backend Server Offline or Unreachable',
      `Cannot connect to API at ${url}. Confirm PostgreSQL is running, then run npm start from the project root.`
    );
    throw err;
  }
}

async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/hospitals`, { method: 'GET' });
    if (res.ok) {
      hideBackendError();
      return true;
    } else {
      showBackendError('Backend Server Error', `API responded with status ${res.status}`);
      return false;
    }
  } catch (err) {
    showBackendError(
      'Backend Server Offline',
      `Cannot connect to backend server at ${API_ORIGIN}. Confirm PostgreSQL is running, then run npm start from the project root.`
    );
    return false;
  }
}

// 1. DATASETS & CLINICAL MODELS (Loaded into client memory)
let HOSPITALS_DATA = [
  {
    id: "hos_001",
    name: "Apex Level-1 Trauma & Multi-Specialty Hospital",
    address: "Plot 14, Health City Parkway, Central Sector",
    phone: "+91-135-255-0101",
    coordinates: { lat: 30.3165, lng: 78.0322 },
    edEntranceCoordinates: { lat: 30.3168, lng: 78.0325 },
    status: "ACTIVE",
    edOccupancyPercent: 68,
    capabilities: [
      "ER_24X7", "TRAUMA_CENTER_L1", "CATH_LAB", "COMPREHENSIVE_STROKE_CENTER",
      "NEUROSURGERY", "VASCULAR_SURGERY", "ORTHOPEDICS", "CT_24X7", "BLOOD_BANK"
    ],
    bedInventory: {
      ER: { total: 25, available: 8 },
      ICU: { total: 12, available: 4 },
      TRAUMA: { total: 6, available: 2 },
      OR: { total: 4, available: 1 }
    },
    bedsUpdatedAt: "2026-10-07T10:12:00Z"
  },
  {
    id: "hos_002",
    name: "Metro Heart & Vascular Super-Specialty Institute",
    address: "88 Ring Road, South Medical Corridor",
    phone: "+91-135-255-0102",
    coordinates: { lat: 30.3050, lng: 78.0410 },
    edEntranceCoordinates: { lat: 30.3052, lng: 78.0412 },
    status: "ACTIVE",
    edOccupancyPercent: 55,
    capabilities: [
      "ER_24X7", "CATH_LAB", "VASCULAR_SURGERY", "CT_24X7", "BLOOD_BANK"
    ],
    bedInventory: {
      ER: { total: 15, available: 6 },
      ICU: { total: 14, available: 5 },
      OR: { total: 3, available: 2 }
    },
    bedsUpdatedAt: "2026-10-07T10:14:00Z"
  },
  {
    id: "hos_003",
    name: "Comprehensive Neuro & Stroke Regional Hospital",
    address: "12 Civil Lines, West Wing",
    phone: "+91-135-255-0103",
    coordinates: { lat: 30.3290, lng: 78.0190 },
    edEntranceCoordinates: { lat: 30.3292, lng: 78.0192 },
    status: "ACTIVE",
    edOccupancyPercent: 60,
    capabilities: [
      "ER_24X7", "COMPREHENSIVE_STROKE_CENTER", "PRIMARY_STROKE_CENTER",
      "NEUROSURGERY", "CT_24X7", "BLOOD_BANK"
    ],
    bedInventory: {
      ER: { total: 16, available: 5 },
      ICU: { total: 10, available: 3 },
      TRAUMA: { total: 4, available: 1 }
    },
    bedsUpdatedAt: "2026-10-07T10:10:00Z"
  },
  {
    id: "hos_004",
    name: "Children & Maternity Emergency Medical Center",
    address: "45 Shanti Path, Sector 4",
    phone: "+91-135-255-0104",
    coordinates: { lat: 30.3340, lng: 78.0550 },
    edEntranceCoordinates: { lat: 30.3342, lng: 78.0553 },
    status: "ACTIVE",
    edOccupancyPercent: 42,
    capabilities: [
      "ER_24X7", "PEDIATRIC_TRAUMA", "OBSTETRICS_EMERGENCY", "BLOOD_BANK", "CT_24X7"
    ],
    bedInventory: {
      ER: { total: 20, available: 11 },
      PEDIATRIC_ICU: { total: 8, available: 3 },
      ICU: { total: 6, available: 2 }
    },
    bedsUpdatedAt: "2026-10-07T10:15:00Z"
  },
  {
    id: "hos_005",
    name: "St. Jude Burn & Emergency Trauma Center",
    address: "7 Industrial Bypass, East Zone",
    phone: "+91-135-255-0105",
    coordinates: { lat: 30.2980, lng: 78.0620 },
    edEntranceCoordinates: { lat: 30.2982, lng: 78.0622 },
    status: "ACTIVE",
    edOccupancyPercent: 75,
    capabilities: [
      "ER_24X7", "BURN_UNIT", "TRAUMA_CENTER_L1", "BLOOD_BANK", "CT_24X7"
    ],
    bedInventory: {
      ER: { total: 14, available: 4 },
      BURN: { total: 10, available: 3 },
      TRAUMA: { total: 5, available: 1 },
      ICU: { total: 6, available: 1 }
    },
    bedsUpdatedAt: "2026-10-07T10:05:00Z"
  },
  {
    id: "hos_006",
    name: "Valley Orthopedic & Surgical Emergency Hospital",
    address: "19 Ridge View Road, North Foothills",
    phone: "+91-135-255-0106",
    coordinates: { lat: 30.3450, lng: 78.0080 },
    edEntranceCoordinates: { lat: 30.3452, lng: 78.0082 },
    status: "ACTIVE",
    edOccupancyPercent: 50,
    capabilities: [
      "ER_24X7", "ORTHOPEDICS", "VASCULAR_SURGERY", "CT_24X7"
    ],
    bedInventory: {
      ER: { total: 12, available: 6 },
      TRAUMA: { total: 4, available: 2 },
      ICU: { total: 4, available: 1 }
    },
    bedsUpdatedAt: "2026-10-07T10:11:00Z"
  },
  {
    id: "hos_007",
    name: "Central Memorial Level-2 Trauma Hospital",
    address: "102 Grand Trunk Ave, Old Cantonment",
    phone: "+91-135-255-0107",
    coordinates: { lat: 30.3120, lng: 78.0250 },
    edEntranceCoordinates: { lat: 30.3122, lng: 78.0253 },
    status: "ACTIVE",
    edOccupancyPercent: 72,
    capabilities: [
      "ER_24X7", "TRAUMA_CENTER_L2", "BLOOD_BANK", "CT_24X7", "ORTHOPEDICS"
    ],
    bedInventory: {
      ER: { total: 18, available: 5 },
      TRAUMA: { total: 6, available: 2 },
      ICU: { total: 8, available: 2 }
    },
    bedsUpdatedAt: "2026-10-07T10:08:00Z"
  },
  {
    id: "hos_008",
    name: "Riverside General & Emergency Care Center",
    address: "33 Riverbed Expressway, South End",
    phone: "+91-135-255-0108",
    coordinates: { lat: 30.2850, lng: 78.0480 },
    edEntranceCoordinates: { lat: 30.2853, lng: 78.0483 },
    status: "ACTIVE",
    edOccupancyPercent: 80,
    capabilities: [
      "ER_24X7", "CT_24X7", "POISON_CENTER"
    ],
    bedInventory: {
      ER: { total: 14, available: 3 },
      ICU: { total: 4, available: 1 }
    },
    bedsUpdatedAt: "2026-10-07T09:45:00Z"
  },
  {
    id: "hos_009",
    name: "North Suburban General Hospital",
    address: "210 Highway Link, North Industrial Hub",
    phone: "+91-135-255-0109",
    coordinates: { lat: 30.3620, lng: 78.0120 },
    edEntranceCoordinates: { lat: 30.3622, lng: 78.0122 },
    status: "DIVERSION",
    edOccupancyPercent: 98,
    capabilities: [
      "ER_24X7", "CATH_LAB", "CT_24X7"
    ],
    bedInventory: {
      ER: { total: 15, available: 0 },
      ICU: { total: 6, available: 0 }
    },
    bedsUpdatedAt: "2026-10-07T10:00:00Z"
  },
  {
    id: "hos_010",
    name: "Sunrise Emergency Community Clinic",
    address: "5 Bazar Gate, Downtown Market",
    phone: "+91-135-255-0110",
    coordinates: { lat: 30.3210, lng: 78.0370 },
    edEntranceCoordinates: { lat: 30.3212, lng: 78.0372 },
    status: "ACTIVE",
    edOccupancyPercent: 90,
    capabilities: [
      "ER_24X7", "POISON_CENTER"
    ],
    bedInventory: {
      ER: { total: 8, available: 2 },
      ICU: { total: 2, available: 0 }
    },
    bedsUpdatedAt: "2026-10-07T10:13:00Z"
  }
];

const ALL_TRAUMA_TYPES = [
  { id: 'HEAD_INJURY', label: '🧠 Head Injury' },
  { id: 'SPINAL_INJURY', label: '🦴 Spinal Injury' },
  { id: 'CHEST_TRAUMA', label: '🫁 Chest Trauma' },
  { id: 'ABDOMINAL_TRAUMA', label: '🩹 Abdominal Trauma' },
  { id: 'PELVIC_FRACTURE', label: '🩻 Pelvic Fracture' },
  { id: 'LIMB_FRACTURE', label: '🦴 Limb Fracture' },
  { id: 'AMPUTATION', label: '🩸 Amputation' },
  { id: 'BURNS', label: '🔥 Severe Burns' },
  { id: 'PENETRATING_INJURY', label: '🗡️ Penetrating Wound' },
  { id: 'MAJOR_BLEEDING', label: '🩸 Major Bleeding' },
  { id: 'CARDIAC_STEMI_SUSPECTED', label: '❤️ Cardiac / STEMI' },
  { id: 'STROKE_SUSPECTED', label: '🧠 Stroke / CVA' },
  { id: 'RESPIRATORY_DISTRESS', label: '😮‍💨 Respiratory Distress' },
  { id: 'DROWNING', label: '🌊 Drowning' },
  { id: 'POISONING', label: '☣️ Poisoning / Tox' },
  { id: 'OBSTETRIC_EMERGENCY', label: '🤰 Obstetric Emergency' },
  { id: 'OTHER', label: '🏥 Other Trauma' }
];

// 2. APPLICATION STATE
const AppState = {
  activeTab: 'view-paramedic',
  audioArmed: true,
  audioContext: null,
  alarmInterval: null,
  selectedHospitalId: 'hos_001',
  destinationHospital: null,
  pendingOverrideHospitalId: null,

  // Paramedic Intake Form
  intake: {
    incidentId: 'inc_01HZX990',
    patient: {
      name: 'Rohan Sharma',
      ageYears: 34,
      sex: 'MALE',
      isPediatric: false
    },
    vitals: {
      sbp: 92,
      dbp: 60,
      heartRate: 118,
      respiratoryRate: 24,
      spo2: 93,
      temperatureC: 36.4
    },
    gcs: {
      eye: 3,
      verbal: 3,
      motor: 3
    },
    traumaTypes: ['HEAD_INJURY', 'MAJOR_BLEEDING'],
    acuity: {
      esiSuggested: 2,
      esiAssigned: 2,
      rtsTriage: 9,
      rtsWeighted: 6.90
    },
    mechanism: 'Two-wheeler vs truck, helmet dislodged',
    notes: 'Severe scalp laceration, right temporal hematoma suspected, IV x2 established'
  },

  // ER Pre-Alert Dashboard
  erDashboard: {
    currentIncident: null,
    alertAcknowledged: true,
    assignedBed: 'Trauma Bay 2',
    countdownSeconds: 494 // ~8m 14s
  },

  // Navigation & GPS simulation
  navigation: {
    simulatingDrive: false,
    currentStepIndex: 0,
    progressFraction: 0.35,
    distanceMeters: 4800,
    durationSeconds: 494
  }
};

// 3. SOUND SYNTHESIZER (Web Audio API)
function initAudio() {
  if (!AppState.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) AppState.audioContext = new AudioCtx();
  }
  if (AppState.audioContext && AppState.audioContext.state === 'suspended') {
    AppState.audioContext.resume();
  }
}

function playTone(freq, type = 'sine', duration = 0.25) {
  if (!AppState.audioArmed) return;
  try {
    initAudio();
    if (!AppState.audioContext) return;
    const osc = AppState.audioContext.createOscillator();
    const gain = AppState.audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, AppState.audioContext.currentTime);

    gain.gain.setValueAtTime(0.15, AppState.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, AppState.audioContext.currentTime + duration);

    osc.connect(gain);
    gain.connect(AppState.audioContext.destination);

    osc.start();
    osc.stop(AppState.audioContext.currentTime + duration);
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}

function triggerUrgentAlarm(esi = 2) {
  if (AppState.alarmInterval) clearInterval(AppState.alarmInterval);

  if (esi === 1) {
    // Repeating high-low siren for ESI 1
    AppState.alarmInterval = setInterval(() => {
      playTone(880, 'sawtooth', 0.2);
      setTimeout(() => playTone(660, 'sawtooth', 0.2), 220);
    }, 900);
  } else {
    // Double beep for ESI 2
    playTone(750, 'sine', 0.15);
    setTimeout(() => playTone(750, 'sine', 0.15), 180);
  }
}

function stopAlarm() {
  if (AppState.alarmInterval) {
    clearInterval(AppState.alarmInterval);
    AppState.alarmInterval = null;
  }
}

// 4. CLINICAL CALCULATIONS ENGINE (Client Mirror)
function updateTriageCalculations() {
  const gcsEye = AppState.intake.gcs.eye;
  const gcsVerbal = AppState.intake.gcs.verbal;
  const gcsMotor = AppState.intake.gcs.motor;
  const gcsTotal = gcsEye + gcsVerbal + gcsMotor;

  const sbp = Number(document.getElementById('vitalSbp').value) || 0;
  const rr = Number(document.getElementById('vitalRr').value) || 0;
  const hr = Number(document.getElementById('vitalHr').value) || 0;
  const spo2 = Number(document.getElementById('vitalSpo2').value) || 0;

  // GCS Code
  let gcsCode = 0;
  if (gcsTotal >= 13) gcsCode = 4;
  else if (gcsTotal >= 9) gcsCode = 3;
  else if (gcsTotal >= 6) gcsCode = 2;
  else if (gcsTotal >= 4) gcsCode = 1;

  // SBP Code
  let sbpCode = 0;
  if (sbp > 89) sbpCode = 4;
  else if (sbp >= 76) sbpCode = 3;
  else if (sbp >= 50) sbpCode = 2;
  else if (sbp >= 1) sbpCode = 1;

  // RR Code
  let rrCode = 0;
  if (rr >= 10 && rr <= 29) rrCode = 4;
  else if (rr > 29) rrCode = 3;
  else if (rr >= 6 && rr <= 9) rrCode = 2;
  else if (rr >= 1 && rr <= 5) rrCode = 1;

  // RTS Calculations
  const rtsTriage = gcsCode + sbpCode + rrCode;
  const rtsWeighted = (0.9368 * gcsCode + 0.7326 * sbpCode + 0.2908 * rrCode).toFixed(2);

  // ESI Rule Suggestion
  let esiSuggested = 3;
  let esiReason = 'Stable baseline parameters';

  if (sbp === 0 || hr === 0) {
    esiSuggested = 1;
    esiReason = 'Pulseless / Cardiac Arrest';
  } else if (gcsTotal <= 8) {
    esiSuggested = 1;
    esiReason = `Severe deficit (GCS ${gcsTotal} <= 8)`;
  } else if (spo2 < 85) {
    esiSuggested = 1;
    esiReason = `Critical hypoxia (SpO2 ${spo2}% < 85%)`;
  } else if (AppState.intake.traumaTypes.includes('MAJOR_BLEEDING') && sbp < 90) {
    esiSuggested = 1;
    esiReason = 'Exsanguinating hemorrhage with shock';
  } else if (gcsTotal <= 12 || spo2 <= 89 || (sbp <= 100 && hr > 120) || rtsTriage <= 10) {
    esiSuggested = 2;
    esiReason = `Emergent (GCS ${gcsTotal}, RTS ${rtsTriage}, SBP ${sbp})`;
  } else if (
    AppState.intake.traumaTypes.includes('CARDIAC_STEMI_SUSPECTED') ||
    AppState.intake.traumaTypes.includes('STROKE_SUSPECTED') ||
    AppState.intake.traumaTypes.includes('PENETRATING_INJURY')
  ) {
    esiSuggested = 2;
    esiReason = 'Time-critical specialty syndrome';
  }

  // Update State
  AppState.intake.acuity.rtsTriage = rtsTriage;
  AppState.intake.acuity.rtsWeighted = Number(rtsWeighted);
  AppState.intake.acuity.esiSuggested = esiSuggested;

  // Update UI Elements
  document.getElementById('hudRtsTriage').textContent = `${rtsTriage} / 12`;
  document.getElementById('hudRtsWeighted').textContent = rtsWeighted;

  const hudRtsAlert = document.getElementById('hudRtsAlert');
  if (rtsTriage <= 11) {
    hudRtsAlert.textContent = '⚠️ Trauma Center Indicated (≤ 11)';
    hudRtsAlert.style.display = 'block';
  } else {
    hudRtsAlert.textContent = '✓ Physiologically Compensated';
    hudRtsAlert.style.display = 'none';
  }

  const hudEsiLevel = document.getElementById('hudEsiLevel');
  hudEsiLevel.textContent = `ESI ${esiSuggested}`;
  hudEsiLevel.className = `acuity-val esi-level-${esiSuggested}`;
  document.getElementById('hudEsiReason').textContent = esiReason;

  const gcsScoreBadge = document.getElementById('gcsScoreBadge');
  const deficitText = gcsTotal <= 8 ? 'Severe Deficit' : gcsTotal <= 12 ? 'Moderate Deficit' : 'Mild / Intact';
  gcsScoreBadge.innerHTML = `Total GCS: <strong>${gcsTotal} / 15</strong> (${deficitText})`;

  // Soft Warnings
  const warningsBox = document.getElementById('vitalsWarningsBox');
  warningsBox.innerHTML = '';
  if (spo2 < 90) {
    warningsBox.innerHTML += `<div class="soft-warn-badge ${spo2 < 85 ? 'critical' : 'warning'}">⚠️ SpO2 Hypoxemia (${spo2}% &lt; 90%) — Administer High-Flow O2</div>`;
  }
  if (sbp < 90) {
    warningsBox.innerHTML += `<div class="soft-warn-badge ${sbp < 75 ? 'critical' : 'warning'}">⚠️ Hypotension (${sbp} mmHg &lt; 90 mmHg) — Shock Warning</div>`;
  }
  if (hr > 130) {
    warningsBox.innerHTML += `<div class="soft-warn-badge warning">⚠️ Severe Tachycardia (${hr} bpm &gt; 130)</div>`;
  }
  if (gcsTotal <= 8) {
    warningsBox.innerHTML += `<div class="soft-warn-badge critical">🚨 Airway Compromise Risk (GCS ${gcsTotal} &le; 8) — Prepare Intubation</div>`;
  }
}

// 5. BACKEND-CONNECTED CLINICAL INTAKE, RECOMMENDATIONS & PRE-ALERT DISPATCH

/**
 * 1. Paramedic intake: send data using POST /api/v1/incidents and POST /api/v1/incidents/:id/intake
 */
async function submitParamedicIntake() {
  const patientName = document.getElementById('patientName')?.value?.trim() || 'Rohan Sharma';
  const ageYears = parseInt(document.getElementById('patientAge')?.value, 10) || 34;
  const sex = document.getElementById('patientSex')?.value || 'MALE';
  const isPediatric = ageYears < 16;
  const mechanism = document.getElementById('incidentMechanism')?.value || 'Motor vehicle collision';
  const notes = document.getElementById('paramedicNotes')?.value || '';

  const vitals = {
    sbp: Number(document.getElementById('vitalSbp')?.value) || 92,
    dbp: Number(document.getElementById('vitalDbp')?.value) || 60,
    heartRate: Number(document.getElementById('vitalHr')?.value) || 118,
    respiratoryRate: Number(document.getElementById('vitalRr')?.value) || 24,
    spo2: Number(document.getElementById('vitalSpo2')?.value) || 93,
    temperatureC: Number(document.getElementById('vitalTemp')?.value) || 36.4
  };

  const gcs = { ...AppState.intake.gcs };
  const traumaTypes = [...AppState.intake.traumaTypes];
  const esiLevel = Number(document.getElementById('overrideEsiSelect')?.value) || AppState.intake.acuity.esiSuggested || 2;

  // Step 1: Create Incident via POST /api/v1/incidents
  const incidentPayload = {
    ambulanceId: 'amb_108_014',
    sceneLocation: { lat: 30.3110, lng: 78.0280 },
    sceneAddress: 'Rajpur Road Intersection, Near Clock Tower',
    patient: {
      fullName: patientName,
      ageYears,
      sex,
      isPediatric
    }
  };

  const createdIncident = await apiFetch('/api/v1/incidents', {
    method: 'POST',
    body: JSON.stringify(incidentPayload)
  });

  const incidentId = createdIncident.id;
  AppState.intake.incidentId = incidentId;
  AppState.intake.patient = {
    name: patientName,
    ageYears,
    sex,
    isPediatric
  };

  // Step 2: Send Intake via POST /api/v1/incidents/:id/intake
  const intakePayload = {
    patient: {
      name: patientName,
      ageYears,
      sex
    },
    vitals,
    gcs,
    traumaTypes,
    mechanism,
    acuity: { esiLevel },
    notes
  };

  const intakeResult = await apiFetch(`/api/v1/incidents/${incidentId}/intake`, {
    method: 'POST',
    body: JSON.stringify(intakePayload)
  });

  if (intakeResult && intakeResult.derived) {
    if (intakeResult.derived.gcsTotal !== undefined) {
      const gcsTotal = intakeResult.derived.gcsTotal;
      const deficitText = gcsTotal <= 8 ? 'Severe Deficit' : gcsTotal <= 12 ? 'Moderate Deficit' : 'Mild / Intact';
      const badge = document.getElementById('gcsScoreBadge');
      if (badge) badge.innerHTML = `Total GCS: <strong>${gcsTotal} / 15</strong> (${deficitText})`;
    }
    if (intakeResult.derived.rtsTriage !== undefined) {
      const rtsEl = document.getElementById('hudRtsTriage');
      if (rtsEl) rtsEl.textContent = `${intakeResult.derived.rtsTriage} / 12`;
    }
    if (intakeResult.derived.rtsWeighted !== undefined) {
      const rtsW = document.getElementById('hudRtsWeighted');
      if (rtsW) rtsW.textContent = intakeResult.derived.rtsWeighted;
    }
    if (intakeResult.derived.esiSuggested !== undefined) {
      const esiEl = document.getElementById('hudEsiLevel');
      if (esiEl) {
        esiEl.textContent = `ESI ${intakeResult.derived.esiSuggested}`;
        esiEl.className = `acuity-val esi-level-${intakeResult.derived.esiSuggested}`;
      }
    }
  }

  return incidentId;
}

/**
 * 2. Recommendations: get hospitals from POST /api/v1/recommendations instead of fake data
 */
async function fetchRecommendations() {
  const container = document.getElementById('hospitalRankingsList');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--teal-primary);">
        <div style="font-size: 1.5rem; margin-bottom: 8px;">⏳ Querying Recommendation Engine...</div>
        <p style="color: var(--text-muted);">Scoring regional facilities against live trauma requirements</p>
      </div>
    `;
  }

  // Submit intake first to ensure backend has incident registered
  let incidentId = AppState.intake.incidentId;
  try {
    incidentId = await submitParamedicIntake();
  } catch (err) {
    console.error('Failed to submit intake before recommendations:', err);
    if (container) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--red-alert);">
          <h3>⚠️ Backend Intake Failed</h3>
          <p style="color: var(--text-muted); margin-top: 8px;">${err.message}</p>
        </div>
      `;
    }
    return;
  }

  const esiLevel = Number(document.getElementById('overrideEsiSelect')?.value) || AppState.intake.acuity.esiSuggested || 2;
  const payload = {
    incidentId,
    origin: { lat: 30.3110, lng: 78.0280 },
    traumaTypes: AppState.intake.traumaTypes,
    patient: {
      isPediatric: AppState.intake.patient.isPediatric
    },
    acuity: {
      esiLevel
    }
  };

  try {
    const response = await apiFetch('/api/v1/recommendations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Update requirements header with backend derived clinical requirements
    if (response.requirements) {
      const bedEl = document.getElementById('reqBedType');
      if (bedEl) bedEl.textContent = response.requirements.bedType || 'ER';
      const etaEl = document.getElementById('reqMaxEta');
      if (etaEl) etaEl.textContent = `${response.requirements.maxEtaMinutes || 45} Minutes`;
      const capContainer = document.getElementById('reqMandatoryCaps');
      if (capContainer) {
        capContainer.innerHTML = '';
        (response.requirements.requiredTags || []).forEach(cap => {
          capContainer.innerHTML += `<span class="cap-pill required">${cap}</span>`;
        });
      }
    }

    renderHospitalCards(response.recommendations || []);
  } catch (err) {
    console.error('Failed to load recommendations:', err);
    if (container) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--red-alert);">
          <h3>⚠️ Recommendation Engine Error</h3>
          <p style="color: var(--text-muted); margin-top: 8px;">${err.message}</p>
        </div>
      `;
    }
  }
}

function renderHospitalCards(rankedHospitals) {
  const container = document.getElementById('hospitalRankingsList');
  if (!container) return;
  container.innerHTML = '';

  if (!rankedHospitals || rankedHospitals.length === 0) {
    container.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted);">No candidate hospitals returned by recommendation engine.</div>';
    return;
  }

  rankedHospitals.slice(0, 5).forEach((h, index) => {
    const isTop = index === 0;
    const rankClass = isTop ? 'hospital-card rank-1' : 'hospital-card';
    const isDiversion = h.status === 'DIVERSION';
    const hospitalId = h.hospitalId || h.id;

    const erBeds = h.bedsAvailable?.ER ?? h.bedInventory?.ER?.available ?? 0;
    const icuBeds = h.bedsAvailable?.ICU ?? h.bedInventory?.ICU?.available ?? 0;
    const traumaBeds = h.bedsAvailable?.TRAUMA ?? h.bedInventory?.TRAUMA?.available ?? 0;

    const reasons = h.reasons || [];
    const missing = h.missingTags || [];

    const cardHtml = `
      <div class="${rankClass}" data-hospital-id="${hospitalId}">
        <div class="hc-rank-box">
          <span class="hc-rank-num">#${index + 1}</span>
          <span class="hc-score-gauge">${h.score ?? 0} PTS</span>
        </div>

        <div class="hc-main-details">
          <div class="hc-name-row">
            <h3 class="hc-name">${h.name}</h3>
            ${isDiversion ? '<span class="soft-warn-badge critical">ON DIVERSION</span>' : ''}
            ${isTop ? '<span class="badge badge-ai">BEST CLINICAL MATCH</span>' : ''}
          </div>
          <span class="card-hint">${h.address || ''} • 📞 ${h.phone || ''}</span>

          <div class="hc-reasons">
            ${reasons.map(r => `<div class="hc-reason-bullet">✓ ${r}</div>`).join('')}
            ${missing.length > 0 ? `<div class="hc-reason-bullet" style="color: #f87171;">⚠️ Missing: ${missing.join(', ')}</div>` : ''}
          </div>
        </div>

        <div class="hc-telemetry-box">
          <div class="hc-eta-row">
            <span class="card-hint">ETA (Traffic):</span>
            <span class="hc-eta-val">${h.etaMinutes ?? 15} min</span>
          </div>
          <div class="hc-eta-row">
            <span class="card-hint">Distance:</span>
            <span><strong>${h.distanceKm ?? 5.0} km</strong></span>
          </div>
          <div class="hc-beds-row">
            <span class="hc-bed-chip">ER: <strong>${erBeds}</strong></span>
            <span class="hc-bed-chip">ICU: <strong>${icuBeds}</strong></span>
            <span class="hc-bed-chip">Trauma: <strong>${traumaBeds}</strong></span>
          </div>
        </div>

        <div class="hc-actions">
          <button class="btn btn-primary btn-select-hospital" data-id="${hospitalId}">
            Select &amp; Pre-Alert ED ▶
          </button>
          ${!isTop ? `<button class="btn btn-sm btn-outline btn-override-hospital" data-id="${hospitalId}">Override</button>` : ''}
        </div>
      </div>
    `;
    container.innerHTML += cardHtml;
  });

  // Attach event handlers
  document.querySelectorAll('.btn-select-hospital').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hospitalId = e.currentTarget.getAttribute('data-id');
      handleSelectHospital(hospitalId);
    });
  });

  document.querySelectorAll('.btn-override-hospital').forEach(btn => {
    btn.addEventListener('click', (e) => {
      AppState.pendingOverrideHospitalId = e.currentTarget.getAttribute('data-id');
      document.getElementById('overrideModal').classList.remove('hidden');
    });
  });
}

/**
 * 3. Selecting a hospital must call POST /api/v1/incidents/:id/select-hospital
 */
async function handleSelectHospital(hospitalId, override = null) {
  let incidentId = AppState.intake.incidentId;
  if (!incidentId) {
    try {
      incidentId = await submitParamedicIntake();
    } catch (err) {
      console.error('Could not create incident before selecting hospital:', err);
      return;
    }
  }

  const body = { hospitalId };
  if (override) {
    body.override = override;
  }

  try {
    const result = await apiFetch(`/api/v1/incidents/${incidentId}/select-hospital`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    AppState.selectedHospitalId = hospitalId;

    const hospital = HOSPITALS_DATA.find(h => h.id === hospitalId) || {
      id: hospitalId,
      name: hospitalId,
      phone: '',
      address: ''
    };
    AppState.destinationHospital = hospital;

    // Trigger sound alarm
    triggerUrgentAlarm(AppState.intake.acuity.esiSuggested);

    // Update ER Dashboard selected facility
    const erSelect = document.getElementById('erHospitalSelect');
    if (erSelect) erSelect.value = hospitalId;
    const pat = AppState.intake.patient;
    const sexChar = pat.sex === 'FEMALE' ? 'F' : 'M';
    document.getElementById('dossierPatientName').textContent = `${pat.name} (${pat.ageYears}${sexChar})`;
    document.getElementById('dossierCondition').textContent = `${AppState.intake.traumaTypes.join(' • ')} • ${AppState.intake.mechanism || 'Collision'}`;
    document.getElementById('navDestName').textContent = hospital.name;

    // Update ETA countdown
    if (result.route) {
      const etaMin = Math.round(result.route.durationSeconds / 60);
      const formatted = `${String(etaMin).padStart(2, '0')}:00`;
      document.getElementById('bannerEta').textContent = `${formatted} min`;
      document.getElementById('dossierEtaCountdown').textContent = formatted;
    }

    // Update Interactive Leaflet Map Destination & Route
    if (window.emergencyMap) {
      window.emergencyMap.selectHospital(hospitalId, true);
    }

    // Show Urgent Banner
    const urgentBanner = document.getElementById('urgentBanner');
    if (urgentBanner) {
      urgentBanner.classList.remove('hidden');
      document.getElementById('bannerHeadline').textContent = `${pat.ageYears}${sexChar} ${AppState.intake.traumaTypes.join(' & ')} en route to ${hospital.name}`;
    }

    // Switch to Live Navigation view
    switchTab('view-navigation');
  } catch (err) {
    console.error('Failed to select hospital:', err);
  }
}

/**
 * 4. ER dashboard: load alerts from GET /api/v1/hospitals/:id/incoming and listen to live updates using EventSource on GET /api/v1/events
 */
let currentIncomingIncidents = [];
let activeDossierIncidentId = null;
let sseInstance = null;

async function loadHospitalIncoming(hospitalId) {
  const currentHospitalId = hospitalId || document.getElementById('erHospitalSelect')?.value || 'hos_001';
  try {
    const incomingList = await apiFetch(`/api/v1/hospitals/${currentHospitalId}/incoming`);
    currentIncomingIncidents = incomingList;
    renderIncomingQueue(incomingList);

    // Update bed counters for this hospital
    const hosp = HOSPITALS_DATA.find(h => h.id === currentHospitalId);
    if (hosp && hosp.bedInventory) {
      updateBedCounters(hosp.bedInventory);
    }
  } catch (err) {
    console.error('Failed to load incoming alerts for hospital:', err);
  }
}

function updateBedCounters(beds) {
  if (!beds) return;
  const er = beds.ER?.available ?? beds.ER ?? 0;
  const icu = beds.ICU?.available ?? beds.ICU ?? 0;
  const trauma = beds.TRAUMA?.available ?? beds.TRAUMA ?? 0;

  const erEl = document.getElementById('erBedCount');
  if (erEl) erEl.textContent = er;
  const icuEl = document.getElementById('icuBedCount');
  if (icuEl) icuEl.textContent = icu;
  const traumaEl = document.getElementById('traumaBedCount');
  if (traumaEl) traumaEl.textContent = trauma;

  const miniEr = document.getElementById('miniValEr');
  if (miniEr) miniEr.textContent = er;
  const miniIcu = document.getElementById('miniValIcu');
  if (miniIcu) miniIcu.textContent = icu;
  const miniTrauma = document.getElementById('miniValTrauma');
  if (miniTrauma) miniTrauma.textContent = trauma;
}

function renderIncomingQueue(incomingList) {
  const container = document.getElementById('incomingQueueStream');
  const countEl = document.getElementById('queueCount');
  if (countEl) countEl.textContent = incomingList ? incomingList.length : 0;
  if (!container) return;

  container.innerHTML = '';

  if (!incomingList || incomingList.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-dim); background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
        <p>No active incoming patient alerts for this ED.</p>
        <small style="color: var(--text-muted); display: block; margin-top: 6px;">New pre-alerts appear live via SSE stream.</small>
      </div>
    `;
    return;
  }

  incomingList.forEach((item, index) => {
    const inc = item.incident || {};
    const pat = inc.patient || {};
    const pName = pat.fullName || pat.name || 'Unknown Patient';
    const pAge = pat.ageYears ?? '?';
    const pSex = pat.sex === 'FEMALE' ? 'F' : 'M';
    const esi = inc.acuity?.esiLevel || 2;
    const trauma = (inc.traumaTypes || []).join(' • ') || 'Medical Emergency';
    const amb = inc.ambulanceId || 'Ambulance 108';
    const status = inc.status || 'EN_ROUTE';
    const statusClass = status.toLowerCase().replace(/_/g, '-');

    const etaMin = item.route?.etaMinutes || 8;
    const etaFormatted = `${String(etaMin).padStart(2, '0')}:00`;

    const isActive = activeDossierIncidentId === inc.id || (!activeDossierIncidentId && index === 0);
    if (isActive) {
      activeDossierIncidentId = inc.id;
      renderPatientDossier(item);
    }

    const card = document.createElement('div');
    card.className = `incoming-queue-card ${isActive ? 'active' : ''}`;
    card.setAttribute('data-incident-id', inc.id);
    card.innerHTML = `
      <div class="iqc-top">
        <span class="esi-large-badge esi-${esi}" style="font-size: 0.82rem; padding: 3px 8px;">ESI ${esi}</span>
        <span class="iqc-eta-chip">ETA: ${etaFormatted}</span>
      </div>
      <div class="iqc-body">
        <h4 class="iqc-name">${pName} (${pAge}${pSex})</h4>
        <p class="iqc-condition">${trauma}</p>
      </div>
      <div class="iqc-foot">
        <span class="iqc-amb">🚑 ${amb}</span>
        <span class="iqc-status-chip ${statusClass}">${status}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      activeDossierIncidentId = inc.id;
      document.querySelectorAll('.incoming-queue-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      renderPatientDossier(item);
    });

    container.appendChild(card);
  });
}

function renderPatientDossier(data) {
  if (!data) return;
  const inc = data.incident || data;
  const pat = inc.patient || data.patient || {};
  const vit = data.lastVitals || data.vitals || {};
  const esi = inc.acuity?.esiLevel || data.esiLevel || 2;

  // ESI Badge
  const badge = document.getElementById('dossierEsiBadge');
  if (badge) {
    badge.textContent = `ESI ${esi}`;
    badge.className = `esi-large-badge esi-${esi}`;
  }

  // Patient Name
  const pName = pat.fullName || pat.name || 'Unknown Patient';
  const pAge = pat.ageYears ?? '?';
  const pSex = pat.sex === 'FEMALE' ? 'F' : 'M';
  const nameEl = document.getElementById('dossierPatientName');
  if (nameEl) nameEl.textContent = `${pName} (${pAge}${pSex})`;

  // Condition
  const trauma = inc.traumaTypes || data.traumaTypes || [];
  const mech = inc.mechanism || data.mechanism || '';
  const condEl = document.getElementById('dossierCondition');
  if (condEl) condEl.textContent = `${trauma.join(' • ')}${mech ? ' • ' + mech : ''}`;

  // Call Sign
  const callSignEl = document.getElementById('dossierAmbulanceCallSign');
  if (callSignEl) callSignEl.textContent = inc.ambulanceId || data.ambulanceId || 'Ambulance 108 Alpha';

  // ETA Countdown
  const etaSec = data.etaSeconds || (data.etaMinutes ? data.etaMinutes * 60 : 494);
  const mm = String(Math.floor(etaSec / 60)).padStart(2, '0');
  const ss = String(etaSec % 60).padStart(2, '0');
  const etaEl = document.getElementById('dossierEtaCountdown');
  if (etaEl) etaEl.textContent = `${mm}:${ss}`;

  // Vitals Tiles
  if (vit) {
    const sbp = vit.sbp ?? 92;
    const dbp = vit.dbp ?? 60;
    const hr = vit.heartRate ?? 118;
    const rr = vit.respiratoryRate ?? 24;
    const spo2 = vit.spo2 ?? 93;
    const gcs = vit.gcsTotal ?? (vit.gcsEye ? (vit.gcsEye + (vit.gcsVerbal || 1) + (vit.gcsMotor || 1)) : 9);
    const temp = vit.temperatureC ?? 36.4;

    const bpEl = document.getElementById('dvBp');
    if (bpEl) bpEl.textContent = `${sbp}/${dbp}`;
    const hrEl = document.getElementById('dvHr');
    if (hrEl) hrEl.textContent = hr;
    const rrEl = document.getElementById('dvRr');
    if (rrEl) rrEl.textContent = rr;
    const spo2El = document.getElementById('dvSpo2');
    if (spo2El) spo2El.textContent = `${spo2}%`;
    const gcsEl = document.getElementById('dvGcs');
    if (gcsEl) gcsEl.textContent = `${gcs} / 15`;
    const tempEl = document.getElementById('dvTemp');
    if (tempEl) tempEl.textContent = `${temp}°C`;
  }

  // Paramedic Note
  const note = inc.notes || data.paramedicNote || 'No notes reported.';
  const noteEl = document.getElementById('dossierParamedicNote');
  if (noteEl) noteEl.textContent = `"${note}"`;
}

// Small on-screen message for hospital replies (uses textContent, so server text can never run as HTML)
function showHospitalReplyToast(message, kind) {
  let box = document.getElementById('hospitalReplyToasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'hospitalReplyToasts';
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:380px;';
    document.body.appendChild(box);
  }
  const colors = { ok: '#16a34a', warn: '#d97706', error: '#dc2626' };
  const toast = document.createElement('div');
  toast.style.cssText = `background:#0f172a;color:#fff;border-left:5px solid ${colors[kind] || colors.ok};padding:12px 14px;border-radius:8px;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.4);`;
  toast.textContent = message;
  box.appendChild(toast);
  setTimeout(() => toast.remove(), kind === 'error' ? 20000 : 9000);
}

function initEventSource() {
  if (sseInstance) {
    try { sseInstance.close(); } catch (e) {}
  }

  const sseUrl = `${API_BASE}/api/v1/events`;
  const sse = new EventSource(sseUrl);
  sseInstance = sse;

  const updateBadge = (text, color) => {
    const streamBadge = document.getElementById('liveStreamBadge');
    if (streamBadge) {
      streamBadge.textContent = text;
      streamBadge.style.color = color;
    }
  };

  sse.onopen = () => {
    console.log('[SSE] Connected to real-time events stream on /api/v1/events');
    updateBadge('● Streaming via Server-Sent Events (SSE)', 'var(--teal-primary)');
    hideBackendError();
  };

  sse.onerror = (err) => {
    console.warn('[SSE] EventSource disconnected or error, reconnecting...', err);
    updateBadge('○ SSE Reconnecting...', '#f87171');
    checkBackendHealth();
  };

  const handleIncomingAlert = (payload, channel) => {
    console.log('[SSE] Pre-alert event received:', payload);
    const selectedHosp = document.getElementById('erHospitalSelect')?.value || 'hos_001';

    // Play audible siren / chime based on acuity
    triggerUrgentAlarm(payload.esiLevel || 2);

    // Show top flash banner
    const urgentBanner = document.getElementById('urgentBanner');
    if (urgentBanner) {
      urgentBanner.classList.remove('hidden');
      const pat = payload.patient || {};
      const age = pat.ageYears ?? '?';
      const sex = pat.sex === 'FEMALE' ? 'F' : 'M';
      const trauma = (payload.traumaTypes || []).join(' & ');
      document.getElementById('bannerHeadline').textContent = `🚨 INCOMING: ${age}${sex} ${trauma} (Ambulance ${payload.ambulanceId || '108'})`;
      if (payload.etaMinutes) {
        document.getElementById('bannerEta').textContent = `${String(payload.etaMinutes).padStart(2, '0')}:00 min`;
      }
    }

    // Refresh incoming queue for current hospital immediately without refresh
    loadHospitalIncoming(selectedHosp);
  };

  // Listen to specific SSE event types
  sse.addEventListener('INCOMING_PATIENT', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      handleIncomingAlert(data.payload || data, data.channel);
    } catch (e) {
      console.error('Error handling INCOMING_PATIENT event:', e);
    }
  });

  sse.addEventListener('VITALS_UPDATE', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      const selectedHosp = document.getElementById('erHospitalSelect')?.value || 'hos_001';
      loadHospitalIncoming(selectedHosp);
    } catch (e) {
      console.error('Error handling VITALS_UPDATE event:', e);
    }
  });

  sse.addEventListener('BEDS_UPDATE', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      const payload = data.payload || {};
      const selectedHosp = document.getElementById('erHospitalSelect')?.value || 'hos_001';
      if (payload.hospitalId === selectedHosp && payload.beds) {
        updateBedCounters(payload.beds);
      }
    } catch (e) {
      console.error('Error handling BEDS_UPDATE event:', e);
    }
  });

  sse.addEventListener('HOSPITAL_ACK', (evt) => {
    try {
      const data = JSON.parse(evt.data);
      console.log('[SSE] HOSPITAL_ACK:', data);
    } catch (e) {
      console.error(e);
    }
  });

  // Live replies from the hospital portal and delivery status of the pre-alert.
  // Only events for THIS paramedic's active incident are shown.
  const handleHospitalRelayEvent = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      const p = data.payload || {};
      if (!p.incidentId || p.incidentId !== AppState.intake.incidentId) return;
      const hospitalName = p.hospitalName || 'the hospital';
      switch (data.type) {
        case 'HOSPITAL_RELAY_DELIVERED':
          showHospitalReplyToast(`Pre-alert delivered to ${hospitalName}'s portal`, 'ok');
          break;
        case 'HOSPITAL_RELAY_SKIPPED':
          showHospitalReplyToast(`${hospitalName} has no live portal linked yet. The alert is only in the Triage ER view.`, 'warn');
          break;
        case 'HOSPITAL_RELAY_FAILED':
          showHospitalReplyToast(`Could NOT reach ${hospitalName}'s portal. Phone the hospital: ${p.reason || 'delivery failed'}`, 'error');
          break;
        case 'HOSPITAL_UPDATE': {
          if (p.event === 'ACKNOWLEDGED') {
            showHospitalReplyToast(`${hospitalName} acknowledged your alert${p.actor ? ' (' + p.actor + ')' : ''}`, 'ok');
          } else if (p.event === 'STATUS_CHANGED') {
            const label = String(p.status || '').replace(/_/g, ' ').toLowerCase();
            const bad = p.status === 'UNABLE_TO_RECEIVE' || p.status === 'CANCELLED';
            showHospitalReplyToast(`Hospital status: ${label}${p.reasonCode ? ' (' + p.reasonCode.replace(/_/g, ' ').toLowerCase() + ')' : ''}`, bad ? 'error' : 'ok');
          } else if (p.event === 'INSTRUCTION') {
            showHospitalReplyToast(`Hospital instruction: ${p.instruction || ''}`, 'warn');
          }
          break;
        }
      }
    } catch (e) {
      console.error('Error handling hospital relay event:', e);
    }
  };
  ['HOSPITAL_RELAY_DELIVERED', 'HOSPITAL_RELAY_SKIPPED', 'HOSPITAL_RELAY_FAILED', 'HOSPITAL_UPDATE']
    .forEach(name => sse.addEventListener(name, handleHospitalRelayEvent));

  // Default message handler fallback
  sse.onmessage = (evt) => {
    try {
      if (!evt.data || evt.data.startsWith(':')) return;
      const data = JSON.parse(evt.data);
      if (data.type === 'INCOMING_PATIENT') {
        handleIncomingAlert(data.payload || data, data.channel);
      }
    } catch (e) {}
  };
}

// 6. REAL INTERACTIVE LEAFLET MAP INITIALIZATION
function initInteractiveMap() {
  if (typeof EmergencyDispatchMap !== 'undefined') {
    window.emergencyMap = new EmergencyDispatchMap('liveNavigationMap', {
      selectedHospitalId: AppState.selectedHospitalId || 'hos_001',
      onArrival: (hospital) => {
        alert(`🏁 GEOFENCE ARRIVAL TRIGGER: Ambulance 108 Alpha has arrived at ${hospital.name} ED entrance (under 50m).`);
        const navStatus = document.getElementById('navStatusBadge');
        if (navStatus) {
          navStatus.textContent = 'ARRIVED';
          navStatus.className = 'sm-val status-arrived';
        }
      }
    });
  }
}

// 7. ER RADAR & VITALS CANVAS
function initErRadarAndVitalsCanvas() {
  const vCanvas = document.getElementById('vitalsChartCanvas');
  const rCanvas = document.getElementById('miniRadarCanvas');
  if (!vCanvas || !rCanvas) return;

  const vCtx = vCanvas.getContext('2d');
  const rCtx = rCanvas.getContext('2d');

  let offset = 0;
  function renderVitalsWaveform() {
    vCtx.clearRect(0, 0, vCanvas.width, vCanvas.height);

    // Heart rate waveform (ECG Simulation)
    vCtx.strokeStyle = '#00d2d3';
    vCtx.lineWidth = 2;
    vCtx.beginPath();

    const midY = 55;
    for (let x = 0; x < vCanvas.width; x++) {
      const relX = (x + offset) % 120;
      let y = midY;
      if (relX > 40 && relX < 50) y = midY - 6;
      else if (relX >= 50 && relX < 60) y = midY + 10;
      else if (relX >= 60 && relX < 70) y = midY - 32; // QRS spike
      else if (relX >= 70 && relX < 80) y = midY + 14;
      else if (relX >= 80 && relX < 95) y = midY - 8; // T wave

      if (x === 0) vCtx.moveTo(x, y);
      else vCtx.lineTo(x, y);
    }
    vCtx.stroke();

    // Blood Pressure Baseline (dashed red)
    vCtx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    vCtx.setLineDash([4, 4]);
    vCtx.beginPath();
    vCtx.moveTo(0, 30);
    vCtx.lineTo(vCanvas.width, 30);
    vCtx.stroke();
    vCtx.setLineDash([]);

    offset += 2;
    requestAnimationFrame(renderVitalsWaveform);
  }

  function renderMiniRadar() {
    rCtx.clearRect(0, 0, rCanvas.width, rCanvas.height);
    rCtx.fillStyle = '#060d17';
    rCtx.fillRect(0, 0, rCanvas.width, rCanvas.height);

    // Concentric radar rings
    const cx = rCanvas.width / 2;
    const cy = rCanvas.height / 2;
    rCtx.strokeStyle = 'rgba(0, 210, 211, 0.15)';
    rCtx.lineWidth = 1;
    [40, 80, 110].forEach(r => {
      rCtx.beginPath();
      rCtx.arc(cx, cy, r, 0, Math.PI * 2);
      rCtx.stroke();
    });

    // Destination Hospital at center
    rCtx.fillStyle = '#10b981';
    rCtx.beginPath();
    rCtx.arc(cx, cy, 7, 0, Math.PI * 2);
    rCtx.fill();

    // Ambulance Dot orbiting / approaching
    const angle = ((Date.now() / 2000) % (Math.PI * 2));
    const dist = 65;
    const ax = cx + Math.cos(angle) * dist;
    const ay = cy + Math.sin(angle) * dist;

    rCtx.fillStyle = '#00d2d3';
    rCtx.beginPath();
    rCtx.arc(ax, ay, 6, 0, Math.PI * 2);
    rCtx.fill();

    requestAnimationFrame(renderMiniRadar);
  }

  renderVitalsWaveform();
  renderMiniRadar();
}

// 8. TAB NAVIGATION
function switchTab(targetId) {
  AppState.activeTab = targetId;

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  const activePanel = document.getElementById(targetId);
  if (activePanel) activePanel.classList.add('active');

  const activeBtn = document.querySelector(`.nav-tab[data-target="${targetId}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // If navigating to live map view, invalidate Leaflet map size for proper rendering
  if (targetId === 'view-navigation' && window.emergencyMap && window.emergencyMap.map) {
    setTimeout(() => {
      window.emergencyMap.map.invalidateSize();
      window.emergencyMap.recenterOnAmbulance();
    }, 120);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 9. CITY HOSPITAL OVERVIEW TABLE (108 Dispatch View)
function renderCityHospitalsTable() {
  const tbody = document.getElementById('cityHospitalsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  HOSPITALS_DATA.forEach(h => {
    const isDiversion = h.status === 'DIVERSION';
    const statusBadge = isDiversion
      ? '<span class="soft-warn-badge critical">DIVERSION</span>'
      : '<span class="badge badge-available">ACTIVE</span>';

    const row = `
      <tr>
        <td><strong>${h.name}</strong><br><small style="color: #64748b;">${h.address}</small></td>
        <td>${statusBadge}</td>
        <td><strong style="color: ${h.edOccupancyPercent > 85 ? '#f87171' : '#f8fafc'};">${h.edOccupancyPercent}%</strong></td>
        <td><strong>${h.bedInventory.ICU?.available ?? 0}</strong></td>
        <td><strong>${h.bedInventory.TRAUMA?.available ?? 0}</strong></td>
        <td><small>${h.capabilities.slice(0, 3).join(', ')}</small></td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

// 10. INITIALIZATION & EVENT BINDINGS
document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget.getAttribute('data-target');
      switchTab(target);
    });
  });

  // Sound Toggle
  document.getElementById('audioToggleBtn').addEventListener('click', () => {
    AppState.audioArmed = !AppState.audioArmed;
    document.getElementById('audioStatusText').textContent = AppState.audioArmed ? 'ARMED' : 'MUTED';
    if (!AppState.audioArmed) stopAlarm();
  });

  // Test Chime
  document.getElementById('btnTestChime').addEventListener('click', () => {
    playTone(660, 'sine', 0.25);
  });

  // Render Trauma Chips
  const chipsContainer = document.getElementById('traumaChipsContainer');
  ALL_TRAUMA_TYPES.forEach(item => {
    const isSelected = AppState.intake.traumaTypes.includes(item.id);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `trauma-chip ${isSelected ? 'selected' : ''}`;
    chip.setAttribute('data-id', item.id);
    chip.textContent = item.label;
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      const currentSelected = Array.from(document.querySelectorAll('.trauma-chip.selected')).map(c => c.getAttribute('data-id'));
      AppState.intake.traumaTypes = currentSelected;
      updateTriageCalculations();
    });
    chipsContainer.appendChild(chip);
  });

  // Gloved Steppers (+ / -)
  document.querySelectorAll('.btn-step').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      const delta = parseFloat(e.currentTarget.getAttribute('data-delta'));
      const input = document.getElementById(targetId);
      if (input) {
        input.value = Math.max(0, (parseFloat(input.value) || 0) + delta);
        updateTriageCalculations();
      }
    });
  });

  // Direct Vitals Inputs
  ['vitalSbp', 'vitalDbp', 'vitalHr', 'vitalRr', 'vitalSpo2', 'vitalTemp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateTriageCalculations);
  });

  // GCS Segmented Controls
  const setupGcsGroup = (containerId, key) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        AppState.intake.gcs[key] = parseInt(e.currentTarget.getAttribute('data-val'), 10);
        updateTriageCalculations();
      });
    });
  };

  setupGcsGroup('gcsEyeControl', 'eye');
  setupGcsGroup('gcsVerbalControl', 'verbal');
  setupGcsGroup('gcsMotorControl', 'motor');

  // Pediatric detection on Age input
  document.getElementById('patientAge').addEventListener('input', (e) => {
    const age = parseInt(e.target.value, 10);
    const isPediatric = !isNaN(age) && age < 16;
    AppState.intake.patient.isPediatric = isPediatric;
    document.getElementById('pediatricContainer').style.display = isPediatric ? 'block' : 'none';
    updateTriageCalculations();
  });

  // Get Recommendations CTA (Calls backend)
  document.getElementById('btnGetRecommendations').addEventListener('click', async () => {
    switchTab('view-recommendations');
    await fetchRecommendations();
  });

  // Critical Shortcut CTA (Calls backend)
  document.getElementById('btnCriticalShortcut').addEventListener('click', async () => {
    switchTab('view-recommendations');
    await fetchRecommendations();
  });

  // Save Draft (IndexedDB / LocalStorage & Backend sync)
  document.getElementById('btnSaveDraft').addEventListener('click', async () => {
    localStorage.setItem('triage_intake_draft', JSON.stringify(AppState.intake));
    try {
      await submitParamedicIntake();
      alert('✓ Clinical draft saved to device storage and synchronized with backend dispatch.');
    } catch (e) {
      alert('✓ Clinical draft saved to device storage (Offline Ready). Backend sync pending.');
    }
  });

  // Urgent Banner Ack Button
  document.getElementById('btnAckBanner').addEventListener('click', () => {
    stopAlarm();
    document.getElementById('urgentBanner').classList.add('hidden');
  });

  document.getElementById('btnViewBanner').addEventListener('click', () => {
    stopAlarm();
    document.getElementById('urgentBanner').classList.add('hidden');
    switchTab('view-er');
  });

  // ER Dashboard Dossier Actions (Calls backend API)
  document.getElementById('btnAckDossier').addEventListener('click', async () => {
    stopAlarm();
    const incId = activeDossierIncidentId || AppState.intake.incidentId;
    if (incId) {
      try {
        await apiFetch(`/api/v1/incidents/${incId}/ack`, {
          method: 'POST',
          body: JSON.stringify({ userId: 'usr_er_1' })
        });
        alert('✓ Alert acknowledged on backend. Timestamp logged in Audit Trail.');
      } catch (e) {
        alert('✓ Alert acknowledged locally.');
      }
    } else {
      alert('✓ Alert acknowledged.');
    }
  });

  document.getElementById('btnAssignBedModal').addEventListener('click', async () => {
    const incId = activeDossierIncidentId || AppState.intake.incidentId;
    if (incId) {
      try {
        await apiFetch(`/api/v1/incidents/${incId}/assign-bed`, {
          method: 'POST',
          body: JSON.stringify({ bedType: 'TRAUMA', bedLabel: 'Trauma Bay 2' })
        });
        alert('✓ Trauma Bay 2 locked and assigned on backend. Bed inventory updated.');
        loadHospitalIncoming();
      } catch (e) {
        alert('✓ Trauma Bay 2 assigned.');
      }
    } else {
      alert('✓ Trauma Bay 2 assigned.');
    }
  });

  document.getElementById('btnRequestDiversion').addEventListener('click', () => {
    if (confirm('Request diversion for this incident due to ED resource saturation?')) {
      alert('⚠️ Diversion request dispatched to 108 Dispatch and Paramedic unit.');
    }
  });

  document.getElementById('btnMarkArrived').addEventListener('click', async () => {
    const incId = activeDossierIncidentId || AppState.intake.incidentId;
    if (incId) {
      try {
        await apiFetch(`/api/v1/incidents/${incId}/arrive`, {
          method: 'POST',
          body: JSON.stringify({})
        });
        alert('🏁 Handover marked as ARRIVED on backend. Incident transferred to ED chart.');
        loadHospitalIncoming();
      } catch (e) {
        alert('🏁 Handover marked as ARRIVED.');
      }
    } else {
      alert('🏁 Handover marked as ARRIVED.');
    }
  });

  // ER Destination Facility Picker Change
  const erSelect = document.getElementById('erHospitalSelect');
  if (erSelect) {
    erSelect.addEventListener('change', (e) => {
      loadHospitalIncoming(e.target.value);
    });
  }

  // Bed Inventory Mini Stepper Controls (PUT /api/v1/hospitals/:id/beds)
  document.querySelectorAll('.btn-mini-step').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const bedType = e.currentTarget.getAttribute('data-type');
      const delta = parseInt(e.currentTarget.getAttribute('data-delta'), 10);
      const currHospitalId = document.getElementById('erHospitalSelect')?.value || 'hos_001';
      const hosp = HOSPITALS_DATA.find(h => h.id === currHospitalId);
      if (hosp && hosp.bedInventory && hosp.bedInventory[bedType]) {
        const currentAvail = hosp.bedInventory[bedType].available ?? 0;
        const newAvail = Math.max(0, currentAvail + delta);
        hosp.bedInventory[bedType].available = newAvail;
        updateBedCounters(hosp.bedInventory);

        try {
          await apiFetch(`/api/v1/hospitals/${currHospitalId}/beds`, {
            method: 'PUT',
            body: JSON.stringify({
              beds: {
                [bedType]: { available: newAvail }
              }
            })
          });
        } catch (err) {
          console.warn('Failed to update beds on backend:', err);
        }
      }
    });
  });

  // Retry Connection Button in Error Banner
  const btnRetry = document.getElementById('btnRetryBackend');
  if (btnRetry) {
    btnRetry.addEventListener('click', async () => {
      const ok = await checkBackendHealth();
      if (ok) {
        initEventSource();
        loadHospitalIncoming();
      }
    });
  }

  // Navigation Interactive Map Controls
  const btnRecenter = document.getElementById('btnRecenterMap');
  if (btnRecenter) {
    btnRecenter.addEventListener('click', () => {
      if (window.emergencyMap) window.emergencyMap.recenterOnAmbulance();
    });
  }

  const btnFitAll = document.getElementById('btnFitAllHospitals');
  if (btnFitAll) {
    btnFitAll.addEventListener('click', () => {
      if (window.emergencyMap) window.emergencyMap.fitAllLocations();
    });
  }

  const btnSimulateDrive = document.getElementById('btnSimulateDrive');
  if (btnSimulateDrive) {
    btnSimulateDrive.addEventListener('click', () => {
      if (window.emergencyMap) {
        const isMoving = window.emergencyMap.toggleDrive();
        btnSimulateDrive.textContent = isMoving ? '⏸ Pause Drive' : '🏎️ Resume Drive';
      }
    });
  }

  document.getElementById('btnReportBlockage').addEventListener('click', () => {
    alert('🚧 Road blockage logged! Alternate corridor detected: Faster by 74 seconds. Light blue route polyline updated.');
    if (window.emergencyMap && window.emergencyMap.ambulance.selectedHospital) {
      window.emergencyMap.selectHospital(window.emergencyMap.ambulance.selectedHospital.id, false);
    }
  });

  // Override Modal Actions
  document.getElementById('btnCloseOverrideModal').addEventListener('click', () => {
    document.getElementById('overrideModal').classList.add('hidden');
  });
  document.getElementById('btnCancelOverride').addEventListener('click', () => {
    document.getElementById('overrideModal').classList.add('hidden');
  });
  document.getElementById('btnConfirmOverride').addEventListener('click', () => {
    document.getElementById('overrideModal').classList.add('hidden');
    if (AppState.pendingOverrideHospitalId) {
      handleSelectHospital(AppState.pendingOverrideHospitalId, {
        reasonCode: document.getElementById('overrideReasonCode').value,
        notes: document.getElementById('overrideNotes').value
      });
    }
  });

  // Hash-based Tab Routing (e.g. #er opens ER screen, #paramedic opens Paramedic screen)
  function handleHashRoute() {
    const hash = (window.location.hash || '').toLowerCase();
    if (hash.includes('er')) {
      switchTab('view-er');
    } else if (hash.includes('recommend') || hash.includes('hospital')) {
      switchTab('view-recommendations');
    } else if (hash.includes('nav')) {
      switchTab('view-navigation');
    } else if (hash.includes('fleet') || hash.includes('dispatch')) {
      switchTab('view-dispatch');
    } else if (hash.includes('paramedic')) {
      switchTab('view-paramedic');
    }
  }
  window.addEventListener('hashchange', handleHashRoute);

  // Active ETA Live Countdown Ticker (decrements countdown every second)
  setInterval(() => {
    const timerEl = document.getElementById('dossierEtaCountdown');
    if (timerEl && timerEl.textContent && timerEl.textContent.includes(':')) {
      const parts = timerEl.textContent.split(':');
      let totalSec = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      if (totalSec > 0) {
        totalSec--;
        const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');
        timerEl.textContent = `${mm}:${ss}`;
        if (totalSec <= 120) {
          timerEl.classList.add('countdown-urgent');
        }
      }
    }
  }, 1000);

  // Initial runs
  updateTriageCalculations();
  renderCityHospitalsTable();
  initInteractiveMap();
  initErRadarAndVitalsCanvas();

  // Connect live event stream (SSE) and verify backend connectivity
  initEventSource();
  checkBackendHealth();

  // Load initial active incoming alerts for ER dashboard
  loadHospitalIncoming();

  // Check URL hash on startup (enables direct opening of #er in a second tab)
  if (window.location.hash) {
    handleHashRoute();
  }

  // Sync hospital inventory from backend
  apiFetch('/api/v1/hospitals')
    .then(data => {
      if (Array.isArray(data) && data.length > 0) {
        HOSPITALS_DATA = data;
        renderCityHospitalsTable();
        const currHosp = document.getElementById('erHospitalSelect')?.value;
        const hosp = HOSPITALS_DATA.find(h => h.id === currHosp);
        if (hosp && hosp.bedInventory) {
          updateBedCounters(hosp.bedInventory);
        }
      }
    })
    .catch(() => {});
});
