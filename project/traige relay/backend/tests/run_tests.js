/**
 * Triage Relay: Backend Automated Unit Test Suite
 * Sources: 01_PROJECT_OVERVIEW.md Section 9, 02_PARAMEDIC_INTAKE_MODULE.md Section 11, 03_RECOMMENDATION_ENGINE.md Section 11
 */

const assert = require('assert');
const {
  calculateGcsTotal,
  getGcsCode,
  getSbpCode,
  getRrCode,
  calculateRtsTriage,
  calculateRtsWeighted,
  suggestEsiLevel
} = require('../src/triage');

const {
  deriveRequirements,
  checkCapabilities,
  scoreHospital,
  rankHospitals,
  DEFAULT_WEIGHTS
} = require('../src/scoring');

const { calculateHaversineDistanceMeters, RoutingService } = require('../src/routing');

let testsRun = 0;
let testsPassed = 0;

function it(name, fn) {
  testsRun++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('========================================================');
console.log('Running Triage Relay Test Suite');
console.log('========================================================\n');

// 1. GCS TESTS
console.log('[1] Glasgow Coma Scale (GCS) Tests:');
it('calculates minimum GCS score (1 + 1 + 1 = 3)', () => {
  assert.strictEqual(calculateGcsTotal(1, 1, 1), 3);
});

it('calculates maximum GCS score (4 + 5 + 6 = 15)', () => {
  assert.strictEqual(calculateGcsTotal(4, 5, 6), 15);
});

it('calculates intermediate GCS score correctly (3 + 3 + 3 = 9)', () => {
  assert.strictEqual(calculateGcsTotal(3, 3, 3), 9);
});

// 2. RTS TESTS
console.log('\n[2] Revised Trauma Score (RTS) Tests:');
it('maps GCS boundary codes accurately', () => {
  assert.strictEqual(getGcsCode(15), 4);
  assert.strictEqual(getGcsCode(13), 4);
  assert.strictEqual(getGcsCode(12), 3);
  assert.strictEqual(getGcsCode(9), 3);
  assert.strictEqual(getGcsCode(8), 2);
  assert.strictEqual(getGcsCode(5), 1);
  assert.strictEqual(getGcsCode(3), 0);
});

it('maps SBP boundary codes accurately', () => {
  assert.strictEqual(getSbpCode(120), 4);
  assert.strictEqual(getSbpCode(90), 4);
  assert.strictEqual(getSbpCode(89), 3);
  assert.strictEqual(getSbpCode(76), 3);
  assert.strictEqual(getSbpCode(75), 2);
  assert.strictEqual(getSbpCode(50), 2);
  assert.strictEqual(getSbpCode(49), 1);
  assert.strictEqual(getSbpCode(0), 0);
});

it('calculates perfect RTS triage score (4 + 4 + 4 = 12)', () => {
  assert.strictEqual(calculateRtsTriage(15, 120, 16), 12);
});

it('calculates weighted RTS correctly for boundary cases', () => {
  // GCS=15 (4), SBP=120 (4), RR=16 (4) -> 0.9368*4 + 0.7326*4 + 0.2908*4 = 7.8408 -> 7.841
  const weighted = calculateRtsWeighted(15, 120, 16);
  assert.strictEqual(weighted, 7.841);
});

// 3. ESI DECISION-SUPPORT TESTS
console.log('\n[3] ESI Decision-Support Rule Engine Tests:');
it('suggests ESI 1 for pulseless patient (HR=0 or SBP=0)', () => {
  const result = suggestEsiLevel({ vitals: { sbp: 0, heartRate: 0 } });
  assert.strictEqual(result.suggestedLevel, 1);
});

it('suggests ESI 1 for severe unconsciousness (GCS <= 8)', () => {
  const result = suggestEsiLevel({ vitals: { sbp: 110, heartRate: 90 }, gcsTotal: 7 });
  assert.strictEqual(result.suggestedLevel, 1);
});

it('suggests ESI 2 for suspected STEMI', () => {
  const result = suggestEsiLevel({
    vitals: { sbp: 110, heartRate: 85, spo2: 96 },
    gcsTotal: 15,
    traumaTypes: ['CARDIAC_STEMI_SUSPECTED']
  });
  assert.strictEqual(result.suggestedLevel, 2);
});

// 4. RECOMMENDATION ENGINE TESTS
console.log('\n[4] Smart Recommendation Engine Tests:');
it('derives CATH_LAB requirement for STEMI condition', () => {
  const req = deriveRequirements(['CARDIAC_STEMI_SUSPECTED'], false, 2);
  assert.ok(req.requiredTags.includes('CATH_LAB'));
  assert.strictEqual(req.bedType, 'ICU');
});

it('derives PEDIATRIC_TRAUMA and PEDIATRIC_ICU for pediatric patient with trauma', () => {
  const req = deriveRequirements(['HEAD_INJURY'], true, 1);
  assert.ok(req.requiredTags.includes('PEDIATRIC_TRAUMA'));
  assert.strictEqual(req.bedType, 'PEDIATRIC_ICU');
});

it('ranks hospital with required capabilities higher than generic ER', () => {
  const candidates = [
    {
      id: 'hos_cardiac',
      name: 'Cardiac Center',
      status: 'ACTIVE',
      capabilities: ['ER_24X7', 'CATH_LAB'],
      bedInventory: { ICU: { available: 4 } },
      etaMinutes: 10,
      edOccupancyPercent: 50
    },
    {
      id: 'hos_general',
      name: 'General Clinic',
      status: 'ACTIVE',
      capabilities: ['ER_24X7'],
      bedInventory: { ICU: { available: 4 } },
      etaMinutes: 8,
      edOccupancyPercent: 50
    }
  ];

  const result = rankHospitals(candidates, {
    traumaTypes: ['CARDIAC_STEMI_SUSPECTED'],
    acuity: { esiLevel: 2 }
  });

  assert.strictEqual(result.recommendations[0].hospitalId, 'hos_cardiac');
});

// 5. ROUTING & GEOFENCE TESTS
console.log('\n[5] Routing & Geofence Triggers Tests:');
it('computes accurate Haversine distance between two known points', () => {
  const p1 = { lat: 30.3165, lng: 78.0322 };
  const p2 = { lat: 30.3168, lng: 78.0325 };
  const distM = calculateHaversineDistanceMeters(p1, p2);
  assert.ok(distM > 0 && distM < 100);
});

it('triggers ARRIVED when within 50m and speed < 3 m/s', () => {
  const routing = new RoutingService();
  const ambulance = { lat: 30.31652, lng: 78.03222, speedMps: 1.2 };
  const entrance = { lat: 30.31650, lng: 78.03220 };
  const trigger = routing.checkArrivalTriggers(ambulance, entrance, 20, 50);
  assert.strictEqual(trigger?.trigger, 'ARRIVED');
});

console.log('\n========================================================');
console.log(`Results: ${testsPassed}/${testsRun} tests passed successfully!`);
console.log('========================================================\n');
