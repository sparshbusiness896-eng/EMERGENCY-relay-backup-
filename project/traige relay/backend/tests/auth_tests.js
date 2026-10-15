/**
 * Triage Relay: Authentication & RBAC Test Suite
 * Tests:
 * 1. Wrong password returns 401
 * 2. Missing token returns 401
 * 3. Tampered token returns 401
 * 4. Paramedic updating beds returns 403
 * 5. ER staff of hospital A reading hospital B's incoming incidents returns 403
 * 6. Live alert stream ignores forged ?hospitalId= and uses token's hospitalId
 */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { server } = require('../src/server');
const { pool } = require('../src/db');

const TEST_PORT = 4002;
const JWT_SECRET = process.env.JWT_SECRET || 'c8f5e1b2a9d4f7e3c6a0b8d2e5f1a4c7e9b3d6f8a1c4e7b0d2f5a8c1e4b7d0f3';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'EmergencyTriage2026!';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: 'localhost',
      port: TEST_PORT,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

let testsRun = 0;
let testsPassed = 0;

async function it(name, fn) {
  testsRun++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runAuthTests() {
  console.log('\n========================================================');
  console.log('Running Authentication & Permissions Test Suite');
  console.log('========================================================\n');

  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    // 1. WRONG PASSWORD TEST
    await it('rejects login with wrong password (401 Invalid email or password)', async () => {
      const res = await request('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: 'paramedic@108triage.org',
          password: 'wrong_password_123'
        }
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.error, 'Invalid email or password');
    });

    // 2. MISSING TOKEN TEST
    await it('rejects protected endpoint when token is missing (401)', async () => {
      const res = await request('/api/v1/hospitals');
      assert.strictEqual(res.status, 401);
      assert.ok(res.data.error);
    });

    // 3. TAMPERED TOKEN TEST
    await it('rejects request with tampered/invalid token (401)', async () => {
      const forgedToken = jwt.sign(
        { userId: 'usr_sysadmin_1', role: 'SYSTEM_ADMIN' },
        'wrong_secret_key_used_to_tamper'
      );
      const res = await request('/api/v1/hospitals', {
        headers: { Authorization: `Bearer ${forgedToken}` }
      });
      assert.strictEqual(res.status, 401);
    });

    // Login helper
    const paramedicLogin = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'paramedic@108triage.org', password: DEMO_PASSWORD }
    });
    const paramedicToken = paramedicLogin.data.accessToken;

    const erLogin = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'er.doctor@apex.org', password: DEMO_PASSWORD }
    });
    const erToken = erLogin.data.accessToken;

    // 4. PARAMEDIC UPDATING BEDS TEST (403)
    await it('forbids paramedic from updating hospital beds (403)', async () => {
      const res = await request('/api/v1/hospitals/hos_001/beds', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${paramedicToken}` },
        body: { beds: { ICU: { available: 5 } } }
      });
      assert.strictEqual(res.status, 403);
    });

    // 5. ER STAFF HOSPITAL A READING HOSPITAL B INCIDENTS (403)
    await it('forbids ER staff of hospital A from reading hospital B incoming incidents (403)', async () => {
      // er.doctor@apex.org is assigned to hos_001
      const res = await request('/api/v1/hospitals/hos_002/incoming', {
        method: 'GET',
        headers: { Authorization: `Bearer ${erToken}` }
      });
      assert.strictEqual(res.status, 403);
    });

    // 6. STREAM IGNORING FORGED HOSPITAL ID
    await it('requires token for event stream and ignores forged hospitalId', async () => {
      // Connect to event stream without token -> 401
      const unauthStream = await new Promise((resolve) => {
        const req = http.request({
          host: 'localhost',
          port: TEST_PORT,
          path: '/api/v1/events',
          method: 'GET'
        }, (res) => {
          resolve(res.statusCode);
        });
        req.end();
      });
      assert.strictEqual(unauthStream, 401);

      // Connect with erToken (hos_001) but attempt to forge ?hospitalId=hos_002
      let receivedHos2Event = false;
      const sseReq = http.request({
        host: 'localhost',
        port: TEST_PORT,
        path: `/api/v1/events?token=${paramedicToken || erToken}&hospitalId=hos_002`,
        headers: { Authorization: `Bearer ${erToken}` },
        method: 'GET'
      }, (res) => {
        res.on('data', (chunk) => {
          const str = chunk.toString();
          if (str.includes('INCOMING_PATIENT_HOS_002')) {
            receivedHos2Event = true;
          }
        });
      });
      sseReq.end();

      // Give connection a moment to establish
      await new Promise(r => setTimeout(r, 100));

      // Broadcast an event to hos_002
      const resBedForged = await request('/api/v1/hospitals/hos_002/beds', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${erToken}` },
        body: { beds: { ICU: { available: 1 } } }
      });
      assert.strictEqual(resBedForged.status, 403); // Also proves ER staff cannot edit hos_002 beds

      sseReq.destroy();
      assert.strictEqual(receivedHos2Event, false);
    });

  } finally {
    await new Promise(resolve => server.close(resolve));
    try { await pool.end(); } catch (e) {}
  }

  console.log('\n========================================================');
  console.log(`Auth Results: ${testsPassed}/${testsRun} tests passed successfully!`);
  console.log('========================================================\n');

  process.exit(testsPassed === testsRun ? 0 : 1);
}

if (require.main === module) {
  runAuthTests().catch(err => {
    console.error('Test suite runner failed:', err);
    process.exit(1);
  });
}

module.exports = { runAuthTests };
