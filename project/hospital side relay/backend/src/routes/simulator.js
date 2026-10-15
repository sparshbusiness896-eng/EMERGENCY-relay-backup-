const express = require('express');
const router = express.Router();
const store = require('../store/state');
const { validateBody } = require('../middleware/validate');
const {
  simulatorSendCaseSchema,
  simulatorCancelCaseSchema,
  simulatorResetSchema
} = require('../middleware/schemas');

// Preset emergency scenarios for fast testing
const SIMULATION_PRESETS = {
  TRAUMA: {
    priority: 'CRITICAL',
    emergency_type: 'Pedestrian vs SUV (Critical Trauma)',
    patient_condition_summary: 'Adult female (approx. 29y), unresponsive on scene, bilateral femur deformities, hypotension',
    patient: { age: 29, age_group: 'ADULT', sex: 'female' },
    vital_signs: [
      { type: 'heart_rate', value: 140, unit: 'bpm', measured_at: new Date().toISOString() },
      { type: 'blood_pressure', value: '78/42', unit: 'mmHg', measured_at: new Date().toISOString() },
      { type: 'oxygen_saturation', value: 90, unit: '%', measured_at: new Date().toISOString() },
      { type: 'glasgow_coma_scale', value: '8 (E2 V2 M4)', unit: 'points', measured_at: new Date().toISOString() }
    ],
    notes: 'Pedestrian struck at high velocity. Bilateral open femur fractures, massive external bleeding controlled with CAT tourniquets. Immediate surgical resuscitation needed.',
    treatment_given: 'Tourniquets applied, 2x 14G peripheral lines, TXA 1g IV running, Cervical immobilization',
    paramedic: { unit_id: 'RESCUE-MEDIC-04', name_or_code: 'Paramedic Lt. D. Vance', callback_phone: '+1 (555) 911-3304' },
    eta_minutes: 8,
    resources_requested: [
      { type: 'TRAUMA_TEAM', detail: 'Full Trauma Activation Level 1', status: 'REQUESTED' },
      { type: 'BLOOD_PRODUCT', detail: 'MTP 6U PRBC, 6U FFP', status: 'REQUESTED' },
      { type: 'OPERATING_THEATER', detail: 'Trauma OR Bay 1 or 2', status: 'REQUESTED' }
    ]
  },
  CARDIAC: {
    priority: 'CRITICAL',
    emergency_type: 'Out-of-Hospital Cardiac Arrest (ROSC Achieved)',
    patient_condition_summary: 'Adult male (64y), VF arrest, 3 shocks delivered, ROSC achieved at scene 10 mins ago',
    patient: { age: 64, age_group: 'ADULT', sex: 'male' },
    vital_signs: [
      { type: 'heart_rate', value: 110, unit: 'bpm', measured_at: new Date().toISOString() },
      { type: 'blood_pressure', value: '110/70', unit: 'mmHg', measured_at: new Date().toISOString() },
      { type: 'oxygen_saturation', value: 95, unit: '%', measured_at: new Date().toISOString() }
    ],
    notes: 'Bystander CPR performed. Defibrillated x3 with LUCAS mechanical compression. Post-ROSC ECG reveals marked ST elevations.',
    treatment_given: 'Defibrillation x3, Amiodarone 300mg IV, Endotracheal intubation confirmed with capnography',
    paramedic: { unit_id: 'ADVANCED-MEDIC-12', name_or_code: 'Paramedic K. Lindqvist', callback_phone: '+1 (555) 911-3312' },
    eta_minutes: 10,
    resources_requested: [
      { type: 'SPECIALIST', detail: 'Interventional Cardiologist', status: 'REQUESTED' },
      { type: 'EQUIPMENT', detail: 'Targeted Temperature Management / ICU Bed', status: 'REQUESTED' }
    ]
  },
  STROKE: {
    priority: 'HIGH',
    emergency_type: 'Suspected Basilar Artery Stroke',
    patient_condition_summary: 'Adult female (57y), acute vertigo, ataxia, quadriplegia, onset 35m ago',
    patient: { age: 57, age_group: 'ADULT', sex: 'female' },
    vital_signs: [
      { type: 'heart_rate', value: 84, unit: 'bpm', measured_at: new Date().toISOString() },
      { type: 'blood_pressure', value: '185/100', unit: 'mmHg', measured_at: new Date().toISOString() },
      { type: 'oxygen_saturation', value: 98, unit: '%', measured_at: new Date().toISOString() }
    ],
    notes: 'Last known normal 35 minutes ago witnessed by coworker. Rapid neurological decline. Severe dysarthria.',
    treatment_given: 'Head positioned at 15 degrees, Supplemental O2, IV access',
    paramedic: { unit_id: 'CITY-MEDIC-22', name_or_code: 'Paramedic M. Jackson', callback_phone: '+1 (555) 911-3322' },
    eta_minutes: 14,
    resources_requested: [
      { type: 'SPECIALIST', detail: 'Comprehensive Stroke Team', status: 'REQUESTED' },
      { type: 'EQUIPMENT', detail: 'Emergency CT Angiography', status: 'REQUESTED' }
    ]
  },
  PEDIATRIC: {
    priority: 'MEDIUM',
    emergency_type: 'Pediatric Status Epilepticus (Post-Ictal)',
    patient_condition_summary: 'Child male (4y), generalized tonic-clonic seizure lasting 18 mins, ceased post Midazolam',
    patient: { age: 4, age_group: 'CHILD', sex: 'male' },
    vital_signs: [
      { type: 'heart_rate', value: 130, unit: 'bpm', measured_at: new Date().toISOString() },
      { type: 'blood_pressure', value: '96/60', unit: 'mmHg', measured_at: new Date().toISOString() },
      { type: 'oxygen_saturation', value: 94, unit: '%', measured_at: new Date().toISOString() }
    ],
    notes: 'Febrile illness for 24 hours (temperature 39.4C). Seizure terminated 6 minutes ago after IN Midazolam.',
    treatment_given: 'Midazolam 0.2mg/kg IN, Blow-by oxygen, Acetaminophen suppository',
    paramedic: { unit_id: 'PEDIATRIC-AMB-09', name_or_code: 'Paramedic E. Thorne', callback_phone: '+1 (555) 911-3309' },
    eta_minutes: 16,
    resources_requested: [
      { type: 'SPECIALIST', detail: 'Pediatric Intensivist / ED Physician', status: 'REQUESTED' }
    ]
  }
};

// POST /api/simulator/send-case - Simulate incoming paramedic transmission
router.post('/send-case', validateBody(simulatorSendCaseSchema), (req, res, next) => {
  try {
    const { preset, custom } = req.body;
    const base = (preset && SIMULATION_PRESETS[preset.toUpperCase()]) || SIMULATION_PRESETS.TRAUMA;
    const payload = custom ? { ...base, ...custom } : base;

    const caseId = `case_sim_${Math.random().toString(16).substring(2, 8)}`;
    const etaMinutes = payload.eta_minutes || 12;
    const etaTime = new Date(Date.now() + etaMinutes * 60000).toISOString();

    const caseData = {
      case_id: caseId,
      idempotency_key: `${caseId}-relay-1`,
      version: 1,
      hospital_id: 'hosp_metro_01',
      submitted_at: new Date().toISOString(),
      priority: payload.priority,
      emergency_type: payload.emergency_type,
      patient_condition_summary: payload.patient_condition_summary,
      patient: payload.patient,
      vital_signs: payload.vital_signs,
      notes: payload.notes,
      treatment_given: payload.treatment_given,
      paramedic: payload.paramedic,
      eta: etaTime,
      resources_requested: payload.resources_requested || []
    };

    const result = store.createCase(caseData);

    res.status(201).json({
      success: true,
      simulated: true,
      case_id: result.case.case_id,
      delivery_state: 'DELIVERED',
      case: result.case
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/simulator/cancel-case - Simulate paramedic redirect/cancellation
router.post('/cancel-case', validateBody(simulatorCancelCaseSchema), (req, res, next) => {
  try {
    const { case_id, reason } = req.body;
    const c = store.getCase(case_id);
    if (!c) {
      return res.status(404).json({ error: 'Case not found' });
    }

    c.response_status = 'CANCELLED';
    c.delivery_state = 'CANCELLED';
    c.closed_at = new Date().toISOString();
    c.timeline.push({
      timestamp: new Date().toISOString(),
      actor: c.paramedic ? c.paramedic.unit_id : 'Paramedic Unit',
      action: 'CASE_CANCELLED',
      detail: reason || 'Paramedic diverted patient to alternative facility per field physician instructions'
    });

    store.broadcast('CASE_STATUS_UPDATED', c);
    res.json({ success: true, case: c });
  } catch (err) {
    next(err);
  }
});

// POST /api/simulator/reset - Reset everything back to original seed state
router.post('/reset', validateBody(simulatorResetSchema), (req, res, next) => {
  try {
    store.reset();
    store.broadcast('STORE_RESET', { message: 'Data reset to seed fixtures' });
    res.json({ success: true, message: 'All hospital datasets reset to default seed values' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
