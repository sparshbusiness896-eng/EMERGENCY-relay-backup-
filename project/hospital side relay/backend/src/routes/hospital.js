const express = require('express');
const router = express.Router();
const store = require('../store/state');
const { validateBody } = require('../middleware/validate');
const { hospitalUpdateSchema } = require('../middleware/schemas');

// GET /api/hospital - Hospital profile
router.get('/', (req, res, next) => {
  try {
    const hospital = store.getHospital();
    res.json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
});

// PUT /api/hospital - Update hospital profile
router.put('/', validateBody(hospitalUpdateSchema), (req, res, next) => {
  try {
    const hospital = store.updateHospital('hosp_metro_01', req.body);
    res.json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
