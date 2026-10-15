/**
 * Server Placeholder Identity Middleware
 * Replaces untrusted client identity headers and body attributes with a verified fixed placeholder identity.
 */

const SERVER_IDENTITY = {
  id: 'usr_marcus_vance',
  name: 'Marcus Vance, BSN, RN',
  role: 'EMERGENCY_STAFF'
};

function identityMiddleware(req, res, next) {
  req.user = { ...SERVER_IDENTITY };
  next();
}

module.exports = {
  SERVER_IDENTITY,
  identityMiddleware
};
