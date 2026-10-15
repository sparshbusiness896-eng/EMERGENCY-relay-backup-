const express = require('express');
const router = express.Router();
const store = require('../store/state');
const { validateBody } = require('../middleware/validate');
const { capacityUpdateSchema, capacityConfirmSchema } = require('../middleware/schemas');

// GET /api/capacity - Get current capacity snapshot with freshness
router.get('/', (req, res, next) => {
  try {
    const cap = store.getCapacity();
    res.json({ success: true, capacity: cap });
  } catch (err) {
    next(err);
  }
});

// POST /api/capacity - Update capacity
router.post('/', validateBody(capacityUpdateSchema), (req, res, next) => {
  try {
    const user = req.user;
    const updates = {
      available_beds: req.body.available_beds,
      occupied_beds: req.body.occupied_beds,
      total_beds: req.body.total_beds !== undefined ? req.body.total_beds : 120,
      icu_beds_vacant: req.body.icu_beds_vacant,
      icu_beds_total: req.body.icu_beds_total !== undefined ? req.body.icu_beds_total : 20,
      operating_theaters_available: req.body.operating_theaters_available,
      operating_theaters_total: req.body.operating_theaters_total !== undefined ? req.body.operating_theaters_total : 6,
      trauma_bays_available: req.body.trauma_bays_available !== undefined ? req.body.trauma_bays_available : 4,
      trauma_bays_total: req.body.trauma_bays_total !== undefined ? req.body.trauma_bays_total : 4
    };

    const updated = store.updateCapacity(updates, user);
    res.json({ success: true, capacity: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/capacity/confirm - Confirm capacity is still accurate (refreshes freshness)
router.post('/confirm', validateBody(capacityConfirmSchema), (req, res, next) => {
  try {
    const user = req.user;
    const updated = store.confirmCapacityAccurate(user);
    res.json({ success: true, capacity: updated, message: 'Capacity confirmed accurate' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
