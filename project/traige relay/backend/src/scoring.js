/**
 * Triage Relay: Smart Hospital Recommendation Engine
 * Source: 03_RECOMMENDATION_ENGINE.md
 *
 * Implements clinical decision-support hospital ranking:
 * 1. Requirement derivation (trauma types -> capabilities, bed types)
 * 2. Candidate filtering (geofence radius, ACTIVE status, required capabilities, max ETA)
 * 3. Clinical scoring formula (0-100 weighted score by acuity)
 * 4. Fallback rules (zero beds, specialty gap, nearest stabilization ED)
 */

const { Capability, BedType, HospitalStatus } = require('./types');

// Default scoring weights by acuity (sum to 1.0)
const DEFAULT_WEIGHTS = {
  1: { eta: 0.45, spec: 0.30, cap: 0.20, load: 0.05 },
  2: { eta: 0.35, spec: 0.35, cap: 0.20, load: 0.10 },
  3: { eta: 0.25, spec: 0.25, cap: 0.25, load: 0.25 },
  4: { eta: 0.25, spec: 0.25, cap: 0.25, load: 0.25 },
  5: { eta: 0.25, spec: 0.25, cap: 0.25, load: 0.25 }
};

const DEFAULT_MAX_ETA_MINUTES = {
  1: 45,
  2: 45,
  3: 90,
  4: 90,
  5: 90
};

/**
 * Derives clinical requirements from trauma conditions and patient demographic
 * @param {string[]} traumaTypes - list of condition strings
 * @param {boolean} isPediatric - whether patient age < 16
 * @param {number} esiLevel - acuity (1-5)
 * @returns {Object} { requiredTags: string[], preferredTags: string[], bedType: string, maxEtaMinutes: number }
 */
function deriveRequirements(traumaTypes = [], isPediatric = false, esiLevel = 2) {
  const types = Array.isArray(traumaTypes) ? traumaTypes : [];
  const requiredTags = new Set();
  const preferredTags = new Set();
  let bedType = BedType.ER;

  // Pediatric rule (File 03 Section 4)
  if (isPediatric && types.length > 0) {
    requiredTags.add('PEDIATRIC_TRAUMA');
    if (esiLevel <= 2) {
      bedType = BedType.PEDIATRIC_ICU;
    }
  }

  // Condition mappings
  if (types.includes('CARDIAC_STEMI_SUSPECTED')) {
    requiredTags.add('CATH_LAB');
    requiredTags.add('ER_24X7');
    if (bedType !== BedType.PEDIATRIC_ICU) bedType = BedType.ICU;
  }

  if (types.includes('STROKE_SUSPECTED')) {
    requiredTags.add('CT_24X7');
    // Stroke needs Comprehensive or Primary Stroke Center (we represent group as tag or capability)
    requiredTags.add('PRIMARY_STROKE_CENTER'); // baseline
    preferredTags.add('COMPREHENSIVE_STROKE_CENTER');
    preferredTags.add('NEUROSURGERY');
    if (bedType !== BedType.PEDIATRIC_ICU) bedType = BedType.ICU;
  }

  if (types.includes('HEAD_INJURY')) {
    requiredTags.add('NEUROSURGERY');
    requiredTags.add('CT_24X7');
    preferredTags.add('TRAUMA_CENTER_L1');
    if (bedType !== BedType.PEDIATRIC_ICU) bedType = BedType.ICU;
  }

  const majorTraumaConditions = [
    'MAJOR_BLEEDING',
    'PENETRATING_INJURY',
    'PELVIC_FRACTURE',
    'ABDOMINAL_TRAUMA',
    'CHEST_TRAUMA'
  ];
  if (majorTraumaConditions.some(c => types.includes(c))) {
    requiredTags.add('BLOOD_BANK');
    requiredTags.add('TRAUMA_CENTER_L2'); // Trauma L1 or L2 required
    preferredTags.add('VASCULAR_SURGERY');
    if (bedType === BedType.ER) bedType = BedType.TRAUMA;
  }

  if (types.includes('LIMB_FRACTURE') || types.includes('AMPUTATION')) {
    requiredTags.add('ORTHOPEDICS');
    preferredTags.add('VASCULAR_SURGERY');
  }

  if (types.includes('BURNS')) {
    requiredTags.add('BURN_UNIT');
    preferredTags.add('TRAUMA_CENTER_L1');
    bedType = BedType.BURN;
  }

  if (types.includes('OBSTETRIC_EMERGENCY')) {
    requiredTags.add('OBSTETRICS_EMERGENCY');
  }

  // Default fallback requirement: Always 24x7 ER
  if (requiredTags.size === 0) {
    requiredTags.add('ER_24X7');
  }

  const maxEtaMinutes = DEFAULT_MAX_ETA_MINUTES[esiLevel] || 45;

  return {
    requiredTags: Array.from(requiredTags),
    preferredTags: Array.from(preferredTags),
    bedType,
    maxEtaMinutes
  };
}

/**
 * Checks if candidate hospital has all required capability tags
 */
function checkCapabilities(candidate, requirements) {
  const candidateCaps = new Set(candidate.capabilities || []);
  const matchedTags = [];
  const missingTags = [];

  for (const tag of requirements.requiredTags) {
    // Special handling for Stroke Center: either PRIMARY or COMPREHENSIVE satisfies
    if (tag === 'PRIMARY_STROKE_CENTER') {
      if (candidateCaps.has('COMPREHENSIVE_STROKE_CENTER') || candidateCaps.has('PRIMARY_STROKE_CENTER')) {
        matchedTags.push(candidateCaps.has('COMPREHENSIVE_STROKE_CENTER') ? 'COMPREHENSIVE_STROKE_CENTER' : 'PRIMARY_STROKE_CENTER');
      } else {
        missingTags.push('STROKE_CENTER');
      }
      continue;
    }

    // Special handling for Trauma L1/L2: L1 satisfies L2
    if (tag === 'TRAUMA_CENTER_L2') {
      if (candidateCaps.has('TRAUMA_CENTER_L1') || candidateCaps.has('TRAUMA_CENTER_L2')) {
        matchedTags.push(candidateCaps.has('TRAUMA_CENTER_L1') ? 'TRAUMA_CENTER_L1' : 'TRAUMA_CENTER_L2');
      } else {
        missingTags.push('TRAUMA_CENTER_L1_OR_L2');
      }
      continue;
    }

    if (candidateCaps.has(tag)) {
      matchedTags.push(tag);
    } else {
      missingTags.push(tag);
    }
  }

  // Check preferred matches
  const matchedPreferred = [];
  for (const tag of requirements.preferredTags) {
    if (candidateCaps.has(tag)) {
      matchedPreferred.push(tag);
    }
  }

  return {
    hasAllRequired: missingTags.length === 0,
    matchedTags,
    missingTags,
    matchedPreferred
  };
}

/**
 * Calculates confidence penalty based on freshness of bed inventory and ETA source
 */
function calculateConfidencePenalty(candidate) {
  let penalty = 1.0;

  // Stale bed check
  if (candidate.bedsUpdatedAt) {
    const ageMinutes = (Date.now() - new Date(candidate.bedsUpdatedAt).getTime()) / (1000 * 60);
    if (ageMinutes > 60) {
      penalty = 0.75;
    } else if (ageMinutes > 15) {
      penalty = 0.90;
    }
  }

  // ETA source check
  if (candidate.etaSource === 'ESTIMATED') {
    penalty *= 0.85;
  }

  return penalty;
}

/**
 * Calculates 0-100 score for a single candidate hospital
 * Formula from File 03 Section 6:
 * score = 100 * ( wEta*S_eta + wCap*S_cap + wSpec*S_spec + wLoad*S_load ) * confidencePenalty
 */
function scoreHospital(candidate, requirements, weights) {
  const { hasAllRequired, matchedPreferred } = checkCapabilities(candidate, requirements);

  // S_eta = max(0, 1 - etaMin / maxEtaMinutes)
  const etaMinutes = candidate.etaMinutes || 15;
  const sEta = Math.max(0, 1 - etaMinutes / requirements.maxEtaMinutes);

  // S_cap = 0 if available = 0; else min(1, available / 3) for needed bed type
  const bedsAvailable = getAvailableBedsForType(candidate, requirements.bedType);
  const sCap = bedsAvailable <= 0 ? 0 : Math.min(1, bedsAvailable / 3);

  // S_spec = 1.0 if all required present; + 0.1 per preferred matched, capped at 1.0
  const preferredCount = matchedPreferred.length;
  const sSpec = Math.min(1.0, (hasAllRequired ? 1.0 : 0.0) + 0.1 * preferredCount);

  // S_load = 1 - edOccupancyPercent/100
  const occupancy = candidate.edOccupancyPercent ?? 50;
  const sLoad = Math.max(0, 1 - occupancy / 100);

  const rawScore = weights.eta * sEta + weights.cap * sCap + weights.spec * sSpec + weights.load * sLoad;
  const penalty = calculateConfidencePenalty(candidate);

  return Math.round(100 * rawScore * penalty);
}

/**
 * Helper to fetch available bed count for requested bed type
 */
function getAvailableBedsForType(candidate, bedType) {
  if (!candidate.bedInventory) return 0;
  if (candidate.bedInventory[bedType]) {
    return candidate.bedInventory[bedType].available ?? 0;
  }
  // Fallback to ER bed if specific bed type is unlisted
  return candidate.bedInventory.ER ? (candidate.bedInventory.ER.available ?? 0) : 0;
}

/**
 * Generates clinical rationale and warnings for a candidate hospital
 */
function generateReasonsAndWarnings(candidate, requirements, capResult) {
  const reasons = [];
  const warnings = [];

  // Reasons
  if (capResult.matchedTags.includes('CATH_LAB')) reasons.push('24x7 Cath Lab on active standby');
  if (capResult.matchedTags.includes('NEUROSURGERY')) reasons.push('On-call neurosurgical surgical team');
  if (capResult.matchedTags.includes('TRAUMA_CENTER_L1')) reasons.push('Level-1 Trauma resuscitation bay');
  if (capResult.matchedTags.includes('BURN_UNIT')) reasons.push('Specialized burn intensive care unit');
  if (capResult.matchedTags.includes('PEDIATRIC_TRAUMA')) reasons.push('Dedicated pediatric emergency team');

  const bedsFree = getAvailableBedsForType(candidate, requirements.bedType);
  if (bedsFree > 0) {
    reasons.push(`${bedsFree} ${requirements.bedType} bed(s) confirmed available`);
  }

  if (candidate.etaMinutes <= 15) {
    reasons.push(`Rapid transit: ~${candidate.etaMinutes} min ETA`);
  }

  // Warnings
  if (candidate.status === HospitalStatus.DIVERSION) {
    warnings.push('HOSPITAL_ON_DIVERSION: Emergency department diversion reported');
  }
  if (bedsFree === 0) {
    warnings.push(`NO_BEDS_REPORTED: Zero ${requirements.bedType} beds reported free`);
  }
  if (candidate.edOccupancyPercent >= 90) {
    warnings.push(`HIGH_OCCUPANCY: ER at ${candidate.edOccupancyPercent}% occupancy`);
  }
  if (capResult.missingTags.length > 0) {
    warnings.push(`SPECIALTY_GAP: Missing ${capResult.missingTags.join(', ')}`);
  }

  return { reasons, warnings };
}

/**
 * Main Recommendation Engine Pipeline
 * @param {Array} candidates - list of hospitals with ETAs and bed counts
 * @param {Object} input - { traumaTypes, isPediatric, acuity: { esiLevel }, origin }
 * @param {Object} [config] - optional custom weights and rules
 * @returns {Object} recommendation response
 */
function rankHospitals(candidates = [], input = {}, config = null) {
  const esiLevel = input.acuity?.esiLevel || 2;
  const isPediatric = input.patient?.isPediatric || false;
  const traumaTypes = input.traumaTypes || [];

  const requirements = deriveRequirements(traumaTypes, isPediatric, esiLevel);
  const weights = config?.weights?.[esiLevel] || DEFAULT_WEIGHTS[esiLevel] || DEFAULT_WEIGHTS[2];

  // Pipeline Step 1 & 2: Process candidate hospitals
  const scoredList = [];
  const zeroBedList = [];
  const partialSpecialtyList = [];

  for (const hospital of candidates) {
    const capResult = checkCapabilities(hospital, requirements);
    const availableBeds = getAvailableBedsForType(hospital, requirements.bedType);
    const isDiversion = hospital.status === HospitalStatus.DIVERSION;
    const isClosed = hospital.status === HospitalStatus.CLOSED;

    // Hard filter: CLOSED hospitals never accepted
    if (isClosed) continue;

    const score = scoreHospital(hospital, requirements, weights);
    const { reasons, warnings } = generateReasonsAndWarnings(hospital, requirements, capResult);

    const bedsSummary = {};
    if (hospital.bedInventory) {
      for (const [k, v] of Object.entries(hospital.bedInventory)) {
        bedsSummary[k] = v.available ?? 0;
      }
    }

    const item = {
      hospitalId: hospital.id,
      name: hospital.name,
      address: hospital.address,
      phone: hospital.phone,
      coordinates: hospital.coordinates,
      status: hospital.status,
      score,
      etaMinutes: hospital.etaMinutes,
      etaSource: hospital.etaSource || 'LIVE_TRAFFIC',
      distanceKm: hospital.distanceKm,
      bedsAvailable: bedsSummary,
      bedsUpdatedAt: hospital.bedsUpdatedAt,
      matchedTags: capResult.matchedTags,
      missingTags: capResult.missingTags,
      warnings,
      reasons
    };

    if (isDiversion) {
      // Diverted hospital goes to bottom fallback pool
      zeroBedList.push(item);
    } else if (capResult.hasAllRequired && availableBeds > 0) {
      scoredList.push(item);
    } else if (capResult.hasAllRequired && availableBeds === 0) {
      // Fallback 1: Capacity full but specialty present
      zeroBedList.push(item);
    } else if (capResult.missingTags.length === 1) {
      // Fallback 2: Missing only 1 required tag
      partialSpecialtyList.push(item);
    }
  }

  // Sorting function: score descending, then ETA ascending, then beds descending
  const sorter = (a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.etaMinutes !== b.etaMinutes) return a.etaMinutes - b.etaMinutes;
    const aBeds = a.bedsAvailable?.[requirements.bedType] || 0;
    const bBeds = b.bedsAvailable?.[requirements.bedType] || 0;
    return bBeds - aBeds;
  };

  scoredList.sort(sorter);
  zeroBedList.sort(sorter);
  partialSpecialtyList.sort(sorter);

  // Combine results with fallbacks if primary list has fewer than 3 options
  let combined = [...scoredList];
  if (combined.length < 3) {
    combined = combined.concat(zeroBedList);
  }
  if (combined.length < 3) {
    combined = combined.concat(partialSpecialtyList);
  }

  // Fallback 3: Critical and far (ESI 1 and best ETA > 20 min) -> nearest stabilization ED
  let nearestStabilization = null;
  if (esiLevel === 1 && combined.length > 0 && combined[0].etaMinutes > 20) {
    const nearest24x7 = candidates
      .filter(h => h.capabilities?.includes('ER_24X7') && h.status === HospitalStatus.ACTIVE)
      .sort((a, b) => (a.etaMinutes || 99) - (b.etaMinutes || 99))[0];

    if (nearest24x7 && nearest24x7.id !== combined[0].hospitalId) {
      nearestStabilization = {
        hospitalId: nearest24x7.id,
        name: nearest24x7.name,
        etaMinutes: nearest24x7.etaMinutes,
        message: 'Consider stabilization at nearest ED, then secondary transfer. Requires paramedic confirmation.'
      };
    }
  }

  // Format final ranked list
  const maxResults = input.maxResults || 5;
  const recommendations = combined.slice(0, maxResults).map((rec, index) => ({
    rank: index + 1,
    ...rec
  }));

  return {
    incidentId: input.incidentId || 'inc_draft',
    generatedAt: new Date().toISOString(),
    requirements: {
      requiredTags: requirements.requiredTags,
      preferredTags: requirements.preferredTags,
      bedType: requirements.bedType,
      maxEtaMinutes: requirements.maxEtaMinutes
    },
    recommendations,
    fallbacks: {
      nearestStabilization
    }
  };
}

module.exports = {
  DEFAULT_WEIGHTS,
  DEFAULT_MAX_ETA_MINUTES,
  deriveRequirements,
  checkCapabilities,
  calculateConfidencePenalty,
  scoreHospital,
  rankHospitals
};
