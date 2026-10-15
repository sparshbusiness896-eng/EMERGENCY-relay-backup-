const express = require('express');
const router = express.Router();
const store = require('../store/state');

// GET /api/events - Server-Sent Events (SSE) live connection
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connected ping
  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ time: new Date().toISOString(), status: 'ONLINE' })}\n\n`);

  store.subscribe(res);

  // Heartbeat every 25 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: HEARTBEAT\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    store.unsubscribe(res);
  });
});

module.exports = router;
