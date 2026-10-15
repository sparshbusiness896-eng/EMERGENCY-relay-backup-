/**
 * Triage Relay: Live GPS Ambulance Route Simulator
 * Source: 05_NAVIGATION_MODULE.md Section 12
 *
 * Replays simulated ambulance movement along a route towards the destination hospital,
 * emitting location pings, speed, heading, and testing the APPROACHING and ARRIVED triggers.
 */

const { RoutingService } = require('./routing');

async function runSimulation() {
  console.log('=====================================================');
  console.log('   Triage Relay: Live GPS Ambulance Telemetry Simulator');
  console.log('=====================================================');

  const routingService = new RoutingService();
  const origin = { lat: 30.3110, lng: 78.0280 };
  const dest = { lat: 30.3168, lng: 78.0325, name: 'Apex Hospital ED' };

  console.log(`Calculating route from scene [${origin.lat}, ${origin.lng}] to [${dest.lat}, ${dest.lng}]...`);
  const route = await routingService.getRoute(origin, dest);

  console.log(`Route acquired: Total distance = ${route.distanceMeters}m, Est duration = ${route.durationSeconds}s, Steps = ${route.steps.length}`);
  console.log('\nStarting simulated in-transit drive (interval: 1.5s per waypoint)...');

  let stepIndex = 0;
  for (let i = 0; i < route.waypoints.length; i++) {
    const pt = route.waypoints[i];
    const progressPercent = Math.round((i / (route.waypoints.length - 1)) * 100);
    const remainingDistanceM = Math.round(route.distanceMeters * (1 - i / (route.waypoints.length - 1)));
    const remainingEtaSec = Math.max(0, Math.round(route.durationSeconds * (1 - i / (route.waypoints.length - 1))));
    const speedMps = i === route.waypoints.length - 1 ? 1.5 : 12.5;

    const locPing = {
      lat: pt.lat,
      lng: pt.lng,
      speedMps,
      headingDeg: 45,
      routeProgressMeters: route.distanceMeters - remainingDistanceM
    };

    const trigger = routingService.checkArrivalTriggers(locPing, dest, remainingEtaSec, 50);

    const triggerTag = trigger ? ` >>> [TRIGGER: ${trigger.trigger}] <<<` : '';
    console.log(
      `[Ping #${i + 1}/${route.waypoints.length}] Pos: (${pt.lat}, ${pt.lng}) | Rem: ${remainingDistanceM}m | ETA: ${remainingEtaSec}s | Speed: ${(speedMps * 3.6).toFixed(1)} km/h${triggerTag}`
    );

    if (trigger?.trigger === 'ARRIVED') {
      console.log('\n[SUCCESS] Handover Geofence Reached! Incident status updated to ARRIVED.');
      break;
    }
  }

  console.log('=====================================================');
  console.log('   Simulation Complete.');
  console.log('=====================================================');
}

if (require.main === module) {
  runSimulation();
}

module.exports = { runSimulation };
