/**
 * Hospital Emergency Portal - Security & Validation Test Suite
 * Tests required hardening controls:
 * 1. script in emergency_type is stored but rendered as text
 * 2. invalid priority -> 400
 * 3. oversized body -> 413
 * 4. simulator disabled in production
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Ensure development environment for baseline server tests
process.env.NODE_ENV = 'development';
process.env.RELAY_SHARED_SECRET = 'test-relay-secret';
const RELAY_KEY = process.env.RELAY_SHARED_SECRET;
process.env.PORT = '4100';
process.env.ALLOWED_ORIGINS = 'http://localhost:4100,http://127.0.0.1:4100';

const app = require('../src/server');

// Load frontend sanitization & rendering helpers for XSS test
const utilScript = fs.readFileSync(path.resolve(__dirname, '../../frontend/js/util.js'), 'utf8');
const cardScript = fs.readFileSync(path.resolve(__dirname, '../../frontend/js/components/caseCard.js'), 'utf8');

const frontendContext = {
  window: {},
  document: {
    getElementById: () => null,
    querySelectorAll: () => []
  }
};

const runInFrontendContext = new Function('window', 'document', `
  ${utilScript}
  ${cardScript}
  return {
    escapeHtml: window.escapeHtml,
    renderCaseCard: window.renderCaseCard
  };
`);

const { escapeHtml, renderCaseCard } = runInFrontendContext(frontendContext.window, frontendContext.document);

describe('Hospital Relay Hardening Test Suite', () => {

  it('1. script in emergency_type is stored as-is in backend but rendered as safe text in frontend', async () => {
    const maliciousScript = '<script>alert("XSS")</script>';
    const payload = {
      priority: 'CRITICAL',
      emergency_type: maliciousScript,
      patient_condition_summary: 'Severe trauma'
    };

    // 1. Backend stores the script without modifying or truncating it
    const res = await request(app)
      .post('/api/cases')
      .set('X-Relay-Key', RELAY_KEY)
      .send(payload)
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.case.emergency_type, maliciousScript, 'Backend must store script in emergency_type intact');

    // Fetch the case back from the API
    const getRes = await request(app)
      .get(`/api/cases/${res.body.case_id}`)
      .expect(200);

    assert.strictEqual(getRes.body.case.emergency_type, maliciousScript, 'Stored case returned by API contains original payload');

    // 2. Frontend escapes it during rendering to prevent script execution
    const renderedCardHtml = renderCaseCard(getRes.body.case);
    assert.ok(
      !renderedCardHtml.includes('<script>'),
      'Rendered card HTML must NOT contain unescaped <script> tag'
    );
    assert.ok(
      renderedCardHtml.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;') ||
      renderedCardHtml.includes('&lt;script&gt;'),
      'Rendered HTML must contain properly escaped HTML entities'
    );
  });

  it('2. invalid priority returns 400 with { error, details: [{ field, message }] }', async () => {
    const invalidPayload = {
      priority: 'SUPER_URGENT', // Invalid priority
      emergency_type: 'Acute Myocardial Infarction'
    };

    const res = await request(app)
      .post('/api/cases')
      .set('X-Relay-Key', RELAY_KEY)
      .send(invalidPayload)
      .expect(400);

    assert.ok(res.body.error, 'Response must have an error property');
    assert.ok(Array.isArray(res.body.details), 'Response must have a details array');
    assert.ok(res.body.details.length > 0, 'Details array must have at least one error');

    const priorityIssue = res.body.details.find(d => d.field === 'priority');
    assert.ok(priorityIssue, 'Details must specify "priority" as the invalid field');
    assert.ok(priorityIssue.message, 'Details must include an error message for priority');
  });

  it('3. oversized body (> 100 KB) returns 413', async () => {
    // Generate a payload over 100 KB (105 KB)
    const largeNote = 'A'.repeat(108 * 1024);
    const oversizedPayload = {
      priority: 'HIGH',
      emergency_type: 'Traffic Collision',
      notes: largeNote
    };

    const res = await request(app)
      .post('/api/cases')
      .set('X-Relay-Key', RELAY_KEY)
      .send(oversizedPayload)
      .expect(413);

    assert.strictEqual(res.status, 413, 'Server must respond with status 413 for bodies exceeding 100 KB');
    assert.ok(res.body.error, 'Response must include error property');
    assert.strictEqual(res.body.error, 'Payload Too Large');
  });

  it('4. simulator is disabled in production (returns 404)', async () => {
    // Set NODE_ENV to production and spin up a production instance of the express app
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Clear module cache to reload server under production environment
    delete require.cache[require.resolve('../src/server')];
    delete require.cache[require.resolve('../src/routes/simulator')];
    const prodApp = require('../src/server');

    try {
      const simRes = await request(prodApp)
        .post('/api/simulator/send-case')
        .send({ preset: 'TRAUMA' });

      assert.strictEqual(
        simRes.status,
        404,
        'Simulator route /api/simulator/send-case must return 404 in production'
      );

      const resetRes = await request(prodApp)
        .post('/api/simulator/reset')
        .send({});

      assert.strictEqual(
        resetRes.status,
        404,
        'Simulator route /api/simulator/reset must return 404 in production'
      );
    } finally {
      process.env.NODE_ENV = savedEnv;
      delete require.cache[require.resolve('../src/server')];
    }
  });

  it('5. extra validation checks: reject unknown fields (400) and bad JSON (400)', async () => {
    // 5a. Reject unknown fields
    const unknownFieldPayload = {
      priority: 'CRITICAL',
      emergency_type: 'Severe Burn',
      unrecognized_field: 'injected_val'
    };

    const resUnknown = await request(app)
      .post('/api/cases')
      .set('X-Relay-Key', RELAY_KEY)
      .send(unknownFieldPayload)
      .expect(400);

    assert.ok(resUnknown.body.details.some(d => d.field === 'unrecognized_field'));

    // 5b. Bad JSON returns 400
    const resBadJson = await request(app)
      .post('/api/cases')
      .set('X-Relay-Key', RELAY_KEY)
      .set('Content-Type', 'application/json')
      .send('{"badJson": unquoted}')
      .expect(400);

    assert.strictEqual(resBadJson.body.error, 'Invalid JSON payload');
  });

  it('6. URL id validation rejects invalid id format with 400', async () => {
    const res = await request(app)
      .get('/api/cases/invalid$id!@#')
      .expect(400);

    assert.ok(res.body.error);
    assert.ok(Array.isArray(res.body.details));
    assert.ok(res.body.details.some(d => d.field === 'id'));
  });

  it('7. fixed placeholder identity is written to audit log, ignoring client identity headers', async () => {
    // Get an existing case
    const listRes = await request(app).get('/api/cases').expect(200);
    assert.ok(listRes.body.cases.length > 0);
    const targetCaseId = listRes.body.cases[0].case_id;

    // Attempt to forge identity using headers
    await request(app)
      .get(`/api/cases/${targetCaseId}`)
      .set('X-User-Id', 'untrusted_attacker_id')
      .set('X-User-Name', 'Untrusted Attacker')
      .set('X-User-Role', 'ADMIN')
      .expect(200);

    // Fetch audit log
    const auditRes = await request(app)
      .get('/api/audit')
      .expect(200);

    const latestViewLog = auditRes.body.logs.find(l => l.action === 'CASE_VIEWED' && l.target_id === targetCaseId);
    assert.ok(latestViewLog, 'Audit log must record CASE_VIEWED');
    assert.strictEqual(latestViewLog.user_id, 'usr_marcus_vance', 'Must record fixed placeholder identity id');
    assert.strictEqual(latestViewLog.user_name, 'Marcus Vance, BSN, RN', 'Must record fixed placeholder identity name');
    assert.strictEqual(latestViewLog.role, 'EMERGENCY_STAFF', 'Must record fixed placeholder identity role');
  });

  it('8. CORS allow-list rejects disallowed origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://malicious-domain.com')
      .expect(403);

    assert.strictEqual(res.body.error, 'Origin not allowed by CORS policy');

    // Allowed origin passes
    await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:4100')
      .expect(200);
  });

  it('9. 500 errors never leak internal messages or stack traces', async () => {
    const store = require('../src/store/state');
    const originalGetCases = store.getCases;

    // Simulate an unexpected internal database error
    store.getCases = () => {
      throw new Error('Sensitive database credentials and internal stack trace leak');
    };

    try {
      const res = await request(app)
        .get('/api/cases')
        .expect(500);

      assert.strictEqual(res.body.error, 'Internal Emergency Relay Server Error');
      assert.strictEqual(res.body.details, undefined);
      assert.strictEqual(res.body.stack, undefined);
      assert.strictEqual(JSON.stringify(res.body).includes('Sensitive database credentials'), false);
    } finally {
      // Restore original function
      store.getCases = originalGetCases;
    }
  });

});
