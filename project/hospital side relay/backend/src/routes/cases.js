const express = require('express');
const router = express.Router();
const store = require('../store/state');
const { validateBody, validateParams } = require('../middleware/validate');
const { requireRelayKey } = require('../middleware/relayAuth');
const { notifyTriage } = require('../triageNotify');
const {
  idParamSchema,
  createCaseSchema,
  acknowledgeCaseSchema,
  caseStatusSchema,
  caseInstructionsSchema
} = require('../middleware/schemas');

// GET /api/cases - List cases with optional filters
router.get('/', (req, res, next) => {
  try {
    const { status, priority, search } = req.query;
    const cases = store.getCases({ status, priority, search });
    res.json({
      success: true,
      count: cases.length,
      cases: cases
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cases/:id - Get single case
router.get('/:id', validateParams(idParamSchema), (req, res, next) => {
  try {
    const c = store.getCase(req.params.id);
    if (!c) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Log case view for audit compliance using fixed server identity
    const user = req.user;
    store.addAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: 'CASE_VIEWED',
      targetType: 'CASE',
      targetId: c.case_id,
      details: { priority: c.priority, emergency_type: c.emergency_type }
    });

    res.json({ success: true, case: c });
  } catch (err) {
    next(err);
  }
});

// POST /api/cases - Ingest paramedic case (server acknowledgment contract)
// Only the Triage Relay server (holding the shared relay key) may inject cases.
router.post('/', requireRelayKey, validateBody(createCaseSchema), (req, res, next) => {
  try {
    const caseData = req.body;
    const result = store.createCase(caseData);

    // Standard Server Acknowledgment format according to spec 4.2
    return res.status(201).json({
      success: true,
      case_id: result.case.case_id,
      delivery_state: 'DELIVERED',
      received_at: result.case.received_at,
      hospital_id: result.case.hospital_id,
      duplicate: result.duplicate,
      case: result.case
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/cases/:id/acknowledge - Staff acknowledgment (NEW -> RECEIVED)
router.post('/:id/acknowledge', validateParams(idParamSchema), validateBody(acknowledgeCaseSchema), (req, res, next) => {
  try {
    const user = req.user;
    const updated = store.acknowledgeCase(req.params.id, user);
    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }
    notifyTriage(updated, 'ACKNOWLEDGED', { actor: user.name });
    res.json({ success: true, case: updated });
  } catch (err) {
    res.status(400).json({
      error: 'Failed to acknowledge case',
      details: [{ field: 'id', message: err.message }]
    });
  }
});

// POST /api/cases/:id/status - Status transitions
router.post('/:id/status', validateParams(idParamSchema), validateBody(caseStatusSchema), (req, res, next) => {
  try {
    const { status, reason_code, reason_note } = req.body;
    const user = req.user;

    const updated = store.updateCaseStatus(
      req.params.id,
      status,
      { reason_code, reason_note },
      user
    );

    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }

    notifyTriage(updated, 'STATUS_CHANGED', { actor: user.name, reason_code, reason_note });
    res.json({ success: true, case: updated });
  } catch (err) {
    res.status(400).json({
      error: 'Status transition failed',
      details: [{ field: 'status', message: err.message }]
    });
  }
});

// POST /api/cases/:id/instructions - Send instructions / request resources
router.post('/:id/instructions', validateParams(idParamSchema), validateBody(caseInstructionsSchema), (req, res, next) => {
  try {
    const { instruction, resources } = req.body;
    const user = req.user;

    const updated = store.sendInstructions(req.params.id, instruction, resources, user);
    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }

    notifyTriage(updated, 'INSTRUCTION', { actor: user.name, instruction });
    res.json({ success: true, case: updated });
  } catch (err) {
    res.status(400).json({
      error: 'Failed to send instructions',
      details: [{ field: 'instruction', message: err.message }]
    });
  }
});

module.exports = router;
