/**
 * Triage Relay -> Hospital Relay link: Triage-side tests (no database needed)
 *   - data conversion (ESI -> priority, vitals, patient, hospital id)
 *   - forwarding: delivered / unmapped hospital skipped / bad key not retried / hospital down retried then failed
 *   - hospital-update endpoint: needs the relay key, validates input, pushes a live event
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

process.env.RELAY_SHARED_SECRET = 'test-relay-secret';

const {
  buildHospitalCase,
  forwardIncidentToHospital,
  esiToPriority
} = require('../src/hospital_relay');

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    console.error(`  FAIL - ${name}\n    ${err.stack}`);
    process.exitCode = 1;
  }
}

const samplePayload = {
  incidentId: 'inc_test_01',
  ambulanceId: 'amb_108_014',
  esiLevel: 2,
  patient: { fullName: 'Secret Name', ageYears: 34, sex: 'MALE', isPediatric: false },
  traumaTypes: ['HEAD_INJURY', 'MAJOR_BLEEDING'],
  mechanism: 'Road accident',
  vitals: { takenAt: '2026-10-08T10:00:00.000Z', sbp: 92, dbp: 60, heartRate: 118, respiratoryRate: 24, spo2: 93, temperatureC: 36.4, gcsTotal: 12 },
  etaMinutes: 6,
  paramedicNote: 'Conscious, bleeding controlled'
};

function startStubHospital(handler) {
  return new Promise(resolve => {
    const requests = [];
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        requests.push({ url: req.url, key: req.headers['x-relay-key'], body: JSON.parse(body || '{}') });
        handler(req, res, requests.length);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, requests, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}

function request(port, method, urlPath, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers: { 'Content-Type': 'application/json', ...headers } }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  console.log('Triage -> Hospital link tests');

  await test('ESI levels map to hospital priorities', () => {
    assert.strictEqual(esiToPriority(1), 'CRITICAL');
    assert.strictEqual(esiToPriority(2), 'HIGH');
    assert.strictEqual(esiToPriority(3), 'MEDIUM');
    assert.strictEqual(esiToPriority(4), 'LOW');
    assert.strictEqual(esiToPriority(5), 'LOW');
  });

  await test('incident is converted to the hospital case format', () => {
    const c = buildHospitalCase(samplePayload, 'hos_001');
    assert.strictEqual(c.case_id, 'inc_test_01');
    assert.strictEqual(c.hospital_id, 'hosp_metro_01');
    assert.strictEqual(c.source, 'TRIAGE_RELAY');
    assert.strictEqual(c.priority, 'HIGH');
    assert.strictEqual(c.emergency_type, 'Head Injury, Major Bleeding (Road accident)');
    assert.strictEqual(c.paramedic.unit_id, 'amb_108_014');
    assert.deepStrictEqual(c.patient, { age: 34, age_group: 'ADULT', sex: 'male' });
    const bp = c.vital_signs.find(v => v.type === 'blood_pressure');
    assert.strictEqual(bp.value, '92/60');
    assert.ok(c.vital_signs.find(v => v.type === 'glasgow_coma_scale'));
    assert.strictEqual(c.eta_minutes, 6);
    assert.ok(new Date(c.eta).getTime() > Date.now());
  });

  await test('the patient name is never sent to the hospital', () => {
    const json = JSON.stringify(buildHospitalCase(samplePayload, 'hos_001'));
    assert.ok(!json.includes('Secret Name'));
  });

  await test('forwarding delivers the case with the relay key', async () => {
    const { srv, requests, url } = await startStubHospital((req, res) => { res.writeHead(201, { 'Content-Type': 'application/json' }); res.end('{"success":true}'); });
    process.env.HOSPITAL_RELAY_URL = url;
    const result = await forwardIncidentToHospital(samplePayload, 'hos_001');
    srv.close();
    assert.strictEqual(result.state, 'DELIVERED');
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].url, '/api/cases');
    assert.strictEqual(requests[0].key, 'test-relay-secret');
    assert.strictEqual(requests[0].body.case_id, 'inc_test_01');
  });

  await test('a hospital with no portal is skipped (nothing is sent)', async () => {
    const { srv, requests, url } = await startStubHospital((req, res) => { res.writeHead(201); res.end('{}'); });
    process.env.HOSPITAL_RELAY_URL = url;
    const result = await forwardIncidentToHospital(samplePayload, 'hos_005');
    srv.close();
    assert.strictEqual(result.state, 'SKIPPED');
    assert.strictEqual(requests.length, 0);
  });

  await test('a rejected case (HTTP 4xx) fails at once without retrying', async () => {
    const { srv, requests, url } = await startStubHospital((req, res) => { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"error":"Unauthorized"}'); });
    process.env.HOSPITAL_RELAY_URL = url;
    const result = await forwardIncidentToHospital(samplePayload, 'hos_001');
    srv.close();
    assert.strictEqual(result.state, 'FAILED');
    assert.strictEqual(requests.length, 1);
  });

  await test('a hospital server error (HTTP 5xx) is retried and then succeeds', async () => {
    const { srv, requests, url } = await startStubHospital((req, res, n) => {
      if (n < 2) { res.writeHead(500); return res.end('{}'); }
      res.writeHead(201, { 'Content-Type': 'application/json' }); res.end('{}');
    });
    process.env.HOSPITAL_RELAY_URL = url;
    const result = await forwardIncidentToHospital(samplePayload, 'hos_001');
    srv.close();
    assert.strictEqual(result.state, 'DELIVERED');
    assert.strictEqual(requests.length, 2);
  });

  await test('a hospital server that is down fails after 3 tries with a clear reason', async () => {
    process.env.HOSPITAL_RELAY_URL = 'http://127.0.0.1:9';
    const result = await forwardIncidentToHospital(samplePayload, 'hos_001');
    assert.strictEqual(result.state, 'FAILED');
    assert.strictEqual(result.attempts, 3);
    assert.ok(/unreachable|answer in time/i.test(result.reason));
  });

  // ---- real Triage server (no database needed for this endpoint) ----
  const port = 4390;
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), RELAY_SHARED_SECRET: 'test-relay-secret' },
    stdio: 'ignore'
  });
  try {
    for (let i = 0; i < 40; i++) {
      try { await request(port, 'GET', '/api/v1/health'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); }
    }

    await test('hospital-update without the relay key is rejected (401)', async () => {
      const r = await request(port, 'POST', '/api/v1/integrations/hospital-update', { body: { incidentId: 'inc_1', event: 'ACKNOWLEDGED' } });
      assert.strictEqual(r.status, 401);
    });

    await test('hospital-update with a wrong relay key is rejected (401)', async () => {
      const r = await request(port, 'POST', '/api/v1/integrations/hospital-update', { headers: { 'X-Relay-Key': 'nope' }, body: { incidentId: 'inc_1', event: 'ACKNOWLEDGED' } });
      assert.strictEqual(r.status, 401);
    });

    await test('hospital-update with bad data is rejected (400)', async () => {
      const r = await request(port, 'POST', '/api/v1/integrations/hospital-update', { headers: { 'X-Relay-Key': 'test-relay-secret' }, body: { incidentId: '../x', event: 'HACK' } });
      assert.strictEqual(r.status, 400);
      assert.ok(r.body.details.length >= 2);
    });

    await test('a valid hospital-update is pushed live to connected paramedic screens', async () => {
      const events = await new Promise((resolve, reject) => {
        const got = [];
        const req = http.get({ host: '127.0.0.1', port, path: '/api/v1/events' }, res => {
          res.setEncoding('utf8');
          res.on('data', chunk => {
            got.push(chunk);
            if (got.join('').includes('HOSPITAL_ACK')) { req.destroy(); resolve(got.join('')); }
          });
          setTimeout(async () => {
            const r = await request(port, 'POST', '/api/v1/integrations/hospital-update', {
              headers: { 'X-Relay-Key': 'test-relay-secret' },
              body: { incidentId: 'inc_live_1', event: 'ACKNOWLEDGED', status: 'RECEIVED', actor: 'Dr. Test' }
            });
            if (r.status !== 200) reject(new Error('endpoint answered ' + r.status));
          }, 200);
        });
        req.on('error', e => { if (e.code !== 'ECONNRESET') reject(e); });
        setTimeout(() => reject(new Error('no live event received')), 4000);
      });
      assert.ok(events.includes('event: HOSPITAL_UPDATE'));
      assert.ok(events.includes('inc_live_1'));
      assert.ok(events.includes('Dr. Test'));
    });
  } finally {
    child.kill();
  }

  console.log(`\n${passed} link tests passed${process.exitCode ? ' (some FAILED)' : ''}`);
})();
