const express = require('express');
const router = express.Router();
const store = require('../store/state');
const { validateBody, validateParams } = require('../middleware/validate');
const { idParamSchema, staffInviteSchema, staffUpdateSchema } = require('../middleware/schemas');

// GET /api/staff - List all staff
router.get('/', (req, res, next) => {
  try {
    const staff = store.getStaff();
    res.json({ success: true, count: staff.length, staff });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff - Invite new staff
router.post('/', validateBody(staffInviteSchema), (req, res, next) => {
  try {
    const { full_name, email, role, title } = req.body;
    const created = store.inviteStaff({ full_name, email, role, title });
    res.status(201).json({ success: true, staff: created });
  } catch (err) {
    next(err);
  }
});

// PUT /api/staff/:id - Update staff role/status
router.put('/:id', validateParams(idParamSchema), validateBody(staffUpdateSchema), (req, res, next) => {
  try {
    const updated = store.updateStaff(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    res.json({ success: true, staff: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
