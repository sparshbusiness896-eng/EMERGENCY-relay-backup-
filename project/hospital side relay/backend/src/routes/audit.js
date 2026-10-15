const express = require('express');
const router = express.Router();
const store = require('../store/state');

// GET /api/audit - List audit trail logs
router.get('/', (req, res) => {
  const { action, target_id, user_id } = req.query;
  const logs = store.getAuditLogs({ action, target_id, user_id });
  res.json({ success: true, count: logs.length, logs });
});

module.exports = router;
