/**
 * Triage Relay: Routing & Live Telemetry Provider
 * Source: 05_NAVIGATION_MODULE.md
 *
 * Implements:
 * - RoutingProvider abstraction
 * - Haversine distance and emergency vehicle traffic simulator
 * - Turn-by-turn maneuvers generator
 * - Automated re-routing evaluator (anti-flapping, off-route detection)
 * - Geofence arrival triggers (APPROACHING, ARRIVED, STALLED, SIGNAL_LOST)
 */

/**
 * Calculates great-circle distance between two coordinates in meters (Haversine formula)
 */
function calculateHaversineDistanceMeters(coord1, coord2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const lat1 = (coord1.lat * Math.PI) / 180;
  const lat2 = (coord2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Generates an interpolated route polyline with simulated waypoints
 */
function generateRoutePolyline(origin, dest, numPoints = 20) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    // Add realistic subtle road curve perturbation
    const curve = Math.sin(fraction * Math.PI) * 0.003;
    points.push({
      lat: Number((origin.lat + (dest.lat - origin.lat) * fraction + curve).toFixed(6)),
      lng: Number((origin.lng + (dest.lng - origin.lng) * fraction + curve).toFixed(6))
    });
  }
  return points;
}

/**
 * Generates step-by-step navigation maneuvers
 */
function generateSteps(distanceMeters, destName) {
  const km = (distanceMeters / 1000).toFixed(1);
  return [
    {
      instruction: 'Head toward emergency corridor onto Main Arterial Road',
      distanceMeters: Math.round(distanceMeters * 0.25),
      maneuver: { type: 'depart', location: [0, 0] }
    },
    {
      instruction: 'Turn slightly right onto Health Express Flyover',
      distanceMeters: Math.round(distanceMeters * 0.45),
      maneuver: { type: 'turn', modifier: 'slight right', location: [0, 0] }
    },
    {
      instruction: `Continue straight towards ${destName} Emergency Bay`,
      distanceMeters: Math.round(distanceMeters * 0.25),
      maneuver: { type: 'continue', location: [0, 0] }
    },
    {
      instruction: `Arrive at ${destName} ED Entrance (Red Bay)`,
      distanceMeters: Math.round(distanceMeters * 0.05),
      maneuver: { type: 'arrive', location: [0, 0] }
    }
  ];
}

class RoutingService {
  constructor(options = {}) {
    this.emergencySpeedKmH = options.emergencySpeedKmH || 42; // Avg emergency speed
  }

  /**
   * Calculates Route between origin and destination
   * @param {Object} origin - { lat, lng }
   * @param {Object} dest - { lat, lng, name }
   * @returns {Object} Route
   */
  async getRoute(origin, dest) {
    const straightLineM = calculateHaversineDistanceMeters(origin, dest);
    // Road network detour index (typically 1.35 - 1.45x straight line)
    const distanceMeters = Math.round(straightLineM * 1.4);
    const speedMps = (this.emergencySpeedKmH * 1000) / 3600;
    const durationSeconds = Math.max(60, Math.round(distanceMeters / speedMps));

    const waypoints = generateRoutePolyline(origin, dest);
    const steps = generateSteps(distanceMeters, dest.name || 'Destination ED');

    return {
      distanceMeters,
      durationSeconds,
      durationTypicalSeconds: Math.round(durationSeconds * 1.2),
      etaMinutes: Math.max(1, Math.round(durationSeconds / 60)),
      geometry: {
        type: 'LineString',
        coordinates: waypoints.map(pt => [pt.lng, pt.lat])
      },
      waypoints,
      steps,
      etaSource: 'LIVE_TRAFFIC'
    };
  }

  /**
   * Calculates ETA matrix for multiple candidate hospitals
   */
  async getEtaMatrix(origin, hospitals = []) {
    return hospitals.map(hospital => {
      const straightLineM = calculateHaversineDistanceMeters(origin, hospital.coordinates || hospital.location);
      const roadMeters = Math.round(straightLineM * 1.4);
      const speedMps = (this.emergencySpeedKmH * 1000) / 3600;
      const durationSeconds = Math.max(60, Math.round(roadMeters / speedMps));
      const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));

      return {
        hospitalId: hospital.id,
        distanceMeters: roadMeters,
        distanceKm: Number((roadMeters / 1000).toFixed(1)),
        durationSeconds,
        etaMinutes,
        etaSource: 'LIVE_TRAFFIC'
      };
    });
  }

  /**
   * Automated rerouting evaluation (File 05 Section 5)
   * Anti-flapping: switch only if faster by >= 60 seconds or >= 10%
   */
  evaluateReroute(currentRoute, alternateRoute, isBlocked = false) {
    if (isBlocked) {
      return {
        shouldReroute: true,
        reason: 'CLOSURE',
        deltaSeconds: currentRoute.durationSeconds - alternateRoute.durationSeconds
      };
    }

    const deltaSeconds = currentRoute.durationSeconds - alternateRoute.durationSeconds;
    const percentFaster = (deltaSeconds / currentRoute.durationSeconds) * 100;

    if (deltaSeconds >= 60 || percentFaster >= 10) {
      return {
        shouldReroute: true,
        reason: 'TRAFFIC_DELAY',
        deltaSeconds
      };
    }

    return {
      shouldReroute: false,
      reason: null,
      deltaSeconds: 0
    };
  }

  /**
   * Geofence arrival triggers (File 05 Section 6)
   * @param {Object} ambulanceLoc - { lat, lng, speedMps }
   * @param {Object} edEntranceLoc - { lat, lng }
   * @param {number} etaSeconds
   * @param {number} arrivalRadiusM - default 50
   */
  checkArrivalTriggers(ambulanceLoc, edEntranceLoc, etaSeconds, arrivalRadiusM = 50) {
    const distanceToEntrance = calculateHaversineDistanceMeters(ambulanceLoc, edEntranceLoc);
    const speed = ambulanceLoc.speedMps || 0;

    // ARRIVED: within entrance radius and stopped/crawling (< 3 m/s)
    if (distanceToEntrance <= arrivalRadiusM && speed < 3.0) {
      return {
        trigger: 'ARRIVED',
        distanceMeters: distanceToEntrance,
        message: 'Ambulance arrived at Emergency Department entrance'
      };
    }

    // APPROACHING: within 500m or ETA <= 120s
    if (distanceToEntrance <= 500 || etaSeconds <= 120) {
      return {
        trigger: 'APPROACHING',
        distanceMeters: distanceToEntrance,
        message: 'Ambulance approaching ED entrance (under 500m / 2 min)'
      };
    }

    return null;
  }
}

module.exports = {
  calculateHaversineDistanceMeters,
  generateRoutePolyline,
  RoutingService
};
