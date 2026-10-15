/**
 * Hospital Emergency Coordination Portal - Backend Server
 * High Reliability Emergency Coordination Engine & Relay Bridge
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env configuration
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');

const { identityMiddleware } = require('./middleware/identity');
const casesRouter = require('./routes/cases');
const capacityRouter = require('./routes/capacity');
const resourcesRouter = require('./routes/resources');
const hospitalRouter = require('./routes/hospital');
const staffRouter = require('./routes/staff');
const auditRouter = require('./routes/audit');
const eventsRouter = require('./routes/events');
const simulatorRouter = require('./routes/simulator');

const app = express();
const PORT = process.env.PORT || 4100;

// CORS Allow-List from ALLOWED_ORIGINS in .env
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Requests with no origin (e.g. server-to-server, curl, same-origin, or test callers)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin denied'));
  }
};

app.use(cors(corsOptions));

// Body limits: 100 KB limit as required
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Middleware for parsing errors (bad JSON syntax or oversized body)
app.use((err, req, res, next) => {
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      details: [{ field: 'body', message: 'Request payload exceeds 100 KB limit' }]
    });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON payload',
      details: [{ field: 'body', message: 'Malformed JSON syntax' }]
    });
  }
  next(err);
});

// Single fixed placeholder identity middleware
app.use(identityMiddleware);

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.startsWith('/api/events')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Hospital Emergency Coordination Portal Relay Engine',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    capabilities: [
      'LIVE_ALERT_DISPATCH',
      'SERVER_SIDE_IDEMPOTENT_ACK',
      'REAL_TIME_SSE_STREAM',
      'CAPACITY_STALENESS_DETECTION',
      'AUDIT_LOGGING_COMPLIANCE'
    ]
  });
});

// Mount API routes
app.use('/api/cases', casesRouter);
app.use('/api/capacity', capacityRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/hospital', hospitalRouter);
app.use('/api/staff', staffRouter);
app.use('/api/audit', auditRouter);
app.use('/api/events', eventsRouter);

// SIMULATOR: only mount /api/simulator when NODE_ENV is not production
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/simulator', simulatorRouter);
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Serve Frontend static assets
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// Fallback for SPA routing to index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.url.startsWith('/api')) {
    return res.sendFile(path.join(frontendDir, 'index.html'));
  }
  next();
});

// Global error handler - 500 errors must NEVER show internal messages
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      details: [{ field: 'body', message: 'Request payload exceeds 100 KB limit' }]
    });
  }
  if (err.status === 400 || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({
      error: 'Invalid JSON payload',
      details: [{ field: 'body', message: 'Malformed JSON syntax' }]
    });
  }
  if (err.message === 'CORS origin denied') {
    return res.status(403).json({
      error: 'Origin not allowed by CORS policy',
      details: [{ field: 'origin', message: 'Forbidden origin' }]
    });
  }
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    error: 'Internal Emergency Relay Server Error'
  });
});

// Start listening if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🏥 HOSPITAL EMERGENCY COORDINATION RELAY SERVER READY`);
    console.log(`======================================================`);
    console.log(`📡 Local Server URL:  http://localhost:${PORT}`);
    console.log(`🔗 API Endpoint:      http://localhost:${PORT}/api/health`);
    console.log(`⚡ Live Event Stream: http://localhost:${PORT}/api/events`);
    console.log(`🚑 Paramedic Relay:   http://localhost:${PORT}/api/cases (POST)`);
    console.log(`💻 Web Portal UI:     http://localhost:${PORT}/`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
