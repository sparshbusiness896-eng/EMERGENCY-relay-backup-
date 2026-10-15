# File: 05_NAVIGATION_MODULE.md

# Navigation & Live Telemetry Module

Route: `/paramedic/incidents/[incidentId]/navigate`. Role: `PARAMEDIC`. Package: `/packages/routing`.

## 1. Provider Abstraction
```ts
export interface RoutingProvider {
  getRoute(origin: LatLng, dest: LatLng, opts?: { avoid?: string[] }): Promise<Route>;
  getEtaMatrix(origin: LatLng, dests: LatLng[]): Promise<EtaResult[]>;
}
// Implementations: MapboxProvider (default, profile "driving-traffic"), GoogleMapsProvider, HaversineFallbackProvider
```
```ts
interface Route {
  distanceMeters: number; durationSeconds: number; durationTypicalSeconds: number;
  geometry: GeoJSON.LineString; steps: Step[]; etaSource: 'LIVE_TRAFFIC' | 'ESTIMATED';
}
interface Step { instruction: string; distanceMeters: number; maneuver: { type: string; modifier?: string; location: [number, number] } }
```
Keys live only in server env; the browser uses a restricted public Mapbox token (URL-restricted) for map tiles, and the API proxies routing calls.

## 2. Screen Layout (mobile-first)
```
┌ Top banner: next maneuver (big arrow + street + distance) ┐
│ Full-screen map (Mapbox GL JS), ambulance puck, route line  │
│ Bottom sheet: ETA, distance remaining, hospital, status     │
│   [Hospital called]  [Change hospital]  [Mark arrived]      │
└ Floating: recenter, mute voice, night mode, report blockage ┘
```
- Voice guidance via the Web Speech API (`speechSynthesis`), English/Hindi, mutable.
- Keep screen awake with the Screen Wake Lock API.
- Large type, high contrast, night theme auto-switch.

## 3. Location Tracking (client)
- Use `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`, `maximumAge: 1000`.
- Send updates every **3 s** (or every 25 m moved); throttle to every 10 s if the ambulance is stationary.
- Snap puck to the route line client-side (nearest point on polyline) for smooth display.
- Offline: buffer up to 200 location points in memory/IndexedDB, flush in a batch on reconnect (messages carry original `ts`).

## 4. Live Location WebSocket
Endpoint: `WS /api/v1/navigation/live-location?incidentId=<id>&token=<JWT>` (paramedic connection).

Client -> Server:
```json
{
  "type": "LOCATION",
  "id": "loc_000123",
  "ts": "2026-10-07T10:16:05.120Z",
  "payload": {
    "lat": 30.3101, "lng": 78.0299,
    "speedMps": 14.2, "headingDeg": 182, "accuracyM": 6,
    "routeProgressMeters": 1830
  }
}
```
Server -> Client:
```json
{ "type": "ROUTE_UPDATE", "id": "rt_55", "ts": "...", "payload": { "reason": "TRAFFIC_DELAY", "route": { "...Route" }, "etaSeconds": 540, "deltaSeconds": -90 } }
{ "type": "ARRIVAL_TRIGGER", "id": "arr_1", "ts": "...", "payload": { "stage": "APPROACHING" | "ARRIVED", "distanceMeters": 480 } }
{ "type": "HOSPITAL_ACK", "id": "ack_9", "ts": "...", "payload": { "hospitalId": "hos_001", "ackBy": "Dr. Rao" } }
{ "type": "DIVERSION_NOTICE", "id": "div_2", "ts": "...", "payload": { "hospitalId": "hos_001", "reason": "ED at capacity" } }
```

Server behavior on each `LOCATION` message:
1. Validate, store in `location_pings` (batched inserts every 5 s) and in Redis `ambulance:{id}:last`.
2. Publish `ETA_UPDATE` to the destination hospital's alert channel (file 04), at most every 5 s.
3. Run re-route check (section 5).
4. Run arrival triggers (section 6).

## 5. Automated Traffic Re-Routing
- Re-fetch the route every **30 s** while moving, plus immediately when the vehicle deviates from the route polyline by more than 50 m for more than 5 s (off-route).
- Switch to the new route only if it is faster by at least **60 seconds** or **10%** (anti-flapping), or the current route is blocked/closed (Mapbox incident/closure data).
- Always send a `ROUTE_UPDATE` with `reason`: `TRAFFIC_DELAY | OFF_ROUTE | CLOSURE | MANUAL`.
- The paramedic can tap **"Report blockage"** to request an immediate re-route avoiding the current road segment.
- If the routing API fails, keep the last route, show "Live traffic unavailable", and compute ETA by remaining distance / recent average speed (min 20 km/h).

## 6. Arrival Triggers
| Trigger | Condition | Effect |
|---|---|---|
| `APPROACHING` | within 500 m or ETA <= 120 s | Push to ED (card turns "ARRIVING"), tell crew to prepare handover |
| `ARRIVED` | within 50 m of hospital ED entrance geofence and speed < 3 m/s | Set incident status `ARRIVED`, stop tracking, prompt handover form |
| `STALLED` | no movement > 3 min while not at destination | Alert dispatcher and ED |
| `SIGNAL_LOST` | no ping > 30 s | Show last-known location with age on ED map; alert dispatcher after 90 s |

Each hospital stores an `edEntranceLocation` and `arrivalRadiusMeters` (default 50).

## 7. Change Hospital Mid-Route
Paramedic taps **Change hospital** -> re-opens recommendations (file 03) with the current GPS position; on selection: old hospital receives `INCIDENT_STATUS: REDIRECTED`, new hospital receives `INCOMING_PATIENT`, route is recomputed.

## 8. REST Endpoints
- `GET /api/v1/navigation/route?incidentId=...` - current route (initial fetch).
- `POST /api/v1/navigation/reroute` - body `{ incidentId, reason, avoidPoint? }`.
- `GET /api/v1/navigation/:incidentId/track` - location history (dispatcher and audit use).
Contracts in file 06.

## 9. Dispatcher View
`/dispatch/live-map`: all active ambulances on one map (subscribe via `WS /api/v1/dispatch/fleet`), color by ESI, click for incident summary.

## 10. Security & Privacy
- A paramedic may only stream for incidents assigned to their ambulance.
- Location history is retained for 90 days by default, then deleted.
- Rate limit: max 1 message/s per connection.

## 11. Components to Generate
`NavigationPage`, `MapView`, `ManeuverBanner`, `EtaSheet`, `LocationStreamer` (hook `useLiveLocation`), `RouteManager`, `VoiceGuide`, `ArrivalHandler`, `FleetMap`.

## 12. Acceptance Criteria
- Location messages reach the ED dashboard within 2 s.
- Simulated traffic delay triggers re-route with a `ROUTE_UPDATE` within 35 s; no more than one switch per 60 s unless a closure occurs.
- `APPROACHING` and `ARRIVED` fire exactly once per incident.
- Airplane-mode test: buffered points sync in order after reconnect.
- Includes a GPS **simulator script** (`/infra/scripts/simulate-ambulance.ts`) that replays a route so the whole flow can be demoed without a real vehicle.
