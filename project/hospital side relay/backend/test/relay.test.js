/**
 * Triage Relay <-> Hospital Relay link: hospital-side tests
 * 1. POST /api/cases needs the relay key (401 without / wrong key)
 * 2. a case from the Triage Relay keeps source=TRIAGE_RELAY
 * 3. acknowledge / status / instruction are reported back to the Triage Relay
 * 4. cases that did not come from the Triage Relay are NOT reported back
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const request = require('supertest');

process.env.NODE_ENV = 'development';
process.env.PORT = '4100';
process.env.ALLOWED_ORIGINS = 'http://localhost:4100,http://127.0.0.1:4100';
process.env.RELAY_SHARED_SECRET = 'test-relay-secret';

const received = [];
let stub;

const app = require('../src/server');

function waitFor(predicate, ms = 2000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (predicate()) return resolve();
      if (Date.now() - start > ms) return reject(new Error('timed out waiting'));
      setTimeout(poll, 25);
    })();
  });
}

const goodCase = (id) => ({
  case_id: id,
  idempotency_key: `triage_${id}`,
  source: 'TRIAGE_RELAY',
  priority: 'HIGH',
  emergency_type: 'Head Injury, Major Bleeding (Road accident)',
  paramedic: { unit_id: 'amb_108_014' },
  eta_minutes: 6
});

describe('Hospital side of the Triage link', () => {
  before(async () => {
    stub = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        received.push({ url: req.url, key: req.headers['x-relay-key'], body: JSON.parse(body || '{}') });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"received":true}');
      });
    });
    await new Promise(r => stub.listen(0, '127.0.0.1', r));
    process.env.TRIAGE_URL = `http://127.0.0.1:${stub.address().port}`;
  });

  after(() => new Promise(r => stub.close(r)));

  it('1a. rejects a case with no relay key (401)', async () => {
    await request(app).post('/api/cases').send(goodCase('inc_nokey')).expect(401);
  });

  it('1b. rejects a case with a wrong relay key (401)', async () => {
    await request(app).post('/api/cases').set('X-Relay-Key', 'wrong').send(goodCase('inc_wrong')).expect(401);
  });

  it('2. accepts a case with the right key and keeps source=TRIAGE_RELAY', async () => {
    const res = await request(app).post('/api/cases').set('X-Relay-Key', 'test-relay-secret').send(goodCase('inc_a1')).expect(201);
    assert.strictEqual(res.body.case.source, 'TRIAGE_RELAY');
    assert.strictEqual(res.body.case_id, 'inc_a1');
  });

  it('3a. acknowledging reports ACKNOWLEDGED to Triage with the relay key', async () => {
    received.length = 0;
    await request(app).post('/api/cases/inc_a1/acknowledge').send({}).expect(200);
    await waitFor(() => received.length >= 1);
    assert.strictEqual(received[0].url, '/api/v1/integrations/hospital-update');
    assert.strictEqual(received[0].key, 'test-relay-secret');
    assert.strictEqual(received[0].body.incidentId, 'inc_a1');
    assert.strictEqual(received[0].body.event, 'ACKNOWLEDGED');
    assert.strictEqual(received[0].body.status, 'RECEIVED');
  });

  it('3b. a status change reports STATUS_CHANGED, including the reason', async () => {
    received.length = 0;
    await request(app).post('/api/cases/inc_a1/status').send({ status: 'UNABLE_TO_RECEIVE', reason_code: 'NO_CAPACITY' }).expect(200);
    await waitFor(() => received.length >= 1);
    assert.strictEqual(received[0].body.event, 'STATUS_CHANGED');
    assert.strictEqual(received[0].body.status, 'UNABLE_TO_RECEIVE');
    assert.strictEqual(received[0].body.reason_code, 'NO_CAPACITY');
  });

  it('3c. an instruction reports INSTRUCTION with its text', async () => {
    await request(app).post('/api/cases').set('X-Relay-Key', 'test-relay-secret').send(goodCase('inc_a2')).expect(201);
    received.length = 0;
    await request(app).post('/api/cases/inc_a2/instructions').send({ instruction: 'Go to trauma bay 2' }).expect(200);
    await waitFor(() => received.length >= 1);
    assert.strictEqual(received[0].body.event, 'INSTRUCTION');
    assert.strictEqual(received[0].body.instruction, 'Go to trauma bay 2');
  });

  it('4. a manually created (non-Triage) case is not reported to Triage', async () => {
    const seed = await request(app).get('/api/cases').expect(200);
    const manual = seed.body.cases.find(c => c.source !== 'TRIAGE_RELAY' && c.response_status === 'NEW');
    assert.ok(manual, 'expected a seeded NEW case');
    received.length = 0;
    await request(app).post(`/api/cases/${manual.case_id}/acknowledge`).send({}).expect(200);
    await new Promise(r => setTimeout(r, 300));
    assert.strictEqual(received.length, 0);
  });
});
