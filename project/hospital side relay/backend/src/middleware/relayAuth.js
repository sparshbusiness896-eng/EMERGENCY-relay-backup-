/**
 * Relay Key Authentication (server-to-server)
 *
 * The Triage Relay server proves that it is really the Triage Relay by sending
 * the shared secret in the "X-Relay-Key" header. Browsers never see this secret.
 * The secret comes from the RELAY_SHARED_SECRET environment variable
 * (the root launcher "npm start" sets it automatically for both servers).
 */

const crypto = require('crypto');

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireRelayKey(req, res, next) {
  const secret = process.env.RELAY_SHARED_SECRET;
  if (!secret) {
    return res.status(503).json({
      error: 'Relay not configured',
      details: [{ field: 'RELAY_SHARED_SECRET', message: 'Server has no RELAY_SHARED_SECRET set. Start both servers with "npm start" from the project root.' }]
    });
  }
  const provided = req.get('X-Relay-Key');
  if (!provided || !safeEqual(provided, secret)) {
    return res.status(401).json({
      error: 'Unauthorized',
      details: [{ field: 'X-Relay-Key', message: 'Missing or invalid relay key' }]
    });
  }
  next();
}

module.exports = { requireRelayKey };
