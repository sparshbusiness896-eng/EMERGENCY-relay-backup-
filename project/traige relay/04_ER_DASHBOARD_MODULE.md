# File: 04_ER_DASHBOARD_MODULE.md

# ER Pre-Alert Dashboard Module

Route: `/er/dashboard` (desktop/wall display, also usable on tablet). Roles: `ER_STAFF`, `HOSPITAL_ADMIN`.

## 1. Purpose
When a paramedic selects a hospital, that hospital's ED immediately sees an incoming-patient card with live vitals, ETA and needed resources, so the team is ready before arrival.

## 2. Layout
```
┌ Header: Hospital name | connection status | bed summary (ER/ICU/Trauma free) | mute toggle ┐
├ Left (30%): INCOMING queue (cards sorted by ESI then ETA)                                  │
├ Center (45%): Selected patient detail                                                      │
│    - Patient summary, trauma types, mechanism, notes                                       │
│    - Vitals tiles (BP, HR, RR, SpO2, GCS, Temp) with trend arrows                          │
│    - Vitals chart (last 30 min, sparkline per vital)                                       │
│    - Resource checklist (Trauma team, CT, Blood, OR, Cath Lab, Neurosurgeon on call)       │
├ Right (25%): Live ambulance map + ETA countdown + bed assignment panel                     │
└ Footer: Acknowledge / Assign bed / Request diversion / Mark arrived                        ┘
```

## 3. Incoming Patient Card
Shows: ESI badge (color: 1 red, 2 orange, 3 yellow, 4 green, 5 blue), age/sex, headline (for example "34M head injury + major bleeding"), **ETA countdown** (mm:ss, turns red under 2 min), ambulance ID, status chip (`EN_ROUTE`, `ARRIVING`, `ARRIVED`), acknowledgement state.

## 4. Notifications (audio + visual)
- New alert: full-width flashing banner + sound by acuity: ESI 1 = repeating urgent tone until acknowledged; ESI 2 = double beep every 10 s until acknowledged; ESI 3-5 = single soft chime.
- Browser Notification API (if permitted) and tab-title flash `(1) INCOMING ESI 1`.
- Unacknowledged for 60 s (ESI 1-2): escalate, flag the card red and notify `HOSPITAL_ADMIN` via a second alert.
- Audio requires one user gesture to unlock; show an **"Enable alert sounds"** banner on first load.
- Mute toggle only mutes ESI 3-5 sounds; ESI 1-2 cannot be fully muted.

## 5. WebSocket Contract
Endpoint: `WS /api/v1/hospitals/:hospitalId/alerts?token=<JWT>`. Server verifies the role and hospital ownership on connect. Heartbeat: server `ping` every 20 s; client reconnects with exponential backoff (1 s up to 30 s) and calls `GET /api/v1/hospitals/:id/incoming` on reconnect to resync.

All messages use this envelope:
```ts
interface WsEnvelope<T> { type: string; id: string; ts: string; payload: T }
```

### Server -> Client messages
`INCOMING_PATIENT`
```json
{
  "type": "INCOMING_PATIENT", "id": "msg_01", "ts": "2026-10-07T10:16:02Z",
  "payload": {
    "incidentId": "inc_01HZX", "ambulanceId": "amb_108_014",
    "esiLevel": 2,
    "patient": { "ageYears": 34, "sex": "MALE", "isPediatric": false },
    "traumaTypes": ["HEAD_INJURY", "MAJOR_BLEEDING"],
    "mechanism": "Two-wheeler vs truck",
    "vitals": { "sbp": 92, "dbp": 60, "heartRate": 118, "respiratoryRate": 24, "spo2": 93, "gcsTotal": 9, "temperatureC": 36.4, "takenAt": "2026-10-07T10:14:50Z" },
    "scores": { "rtsTriage": 9, "rtsWeighted": 6.9 },
    "resourcesSuggested": ["TRAUMA_TEAM", "CT_SCAN", "BLOOD_O_NEG", "NEUROSURGEON"],
    "etaMinutes": 11, "etaSeconds": 660, "etaSource": "LIVE_TRAFFIC",
    "ambulanceLocation": { "lat": 30.31, "lng": 78.03 },
    "paramedicNote": "Intubation not performed. IV x2."
  }
}
```
`VITALS_UPDATE` payload: `{ incidentId, vitals, scores, esiLevel }`.
`ETA_UPDATE` payload: `{ incidentId, etaSeconds, distanceMeters, ambulanceLocation }` (at most every 5 s).
`INCIDENT_STATUS` payload: `{ incidentId, status: 'EN_ROUTE'|'ARRIVING'|'ARRIVED'|'CANCELLED'|'REDIRECTED', reason? }`.
`BEDS_UPDATE` payload: `{ hospitalId, beds: { ER: {total, available}, ICU: {...}, TRAUMA: {...} }, updatedAt }`.

### Client -> Server messages
- `ACK` `{ incidentId, userId }` - alert acknowledged (stops the sound, records time and user).
- `ASSIGN_BED` `{ incidentId, bedType, bedLabel }` - decrements availability, notifies paramedic.
- `RESOURCE_STATUS` `{ incidentId, resource, status: 'READY'|'PENDING'|'UNAVAILABLE' }` - visible to paramedic.
- `REQUEST_DIVERSION` `{ incidentId, reason }` - hospital cannot accept; the paramedic app prompts to re-run recommendations. Requires `HOSPITAL_ADMIN` or ED doctor confirmation.

## 6. Paramedic-side Echo
Paramedic app receives `ACK_RECEIVED`, `BED_ASSIGNED`, `RESOURCE_READY` and `DIVERSION_REQUESTED` so the crew knows the ED is ready.

## 7. REST Endpoints Used
- `GET /api/v1/hospitals/:id/incoming` - active incoming incidents.
- `PUT /api/v1/hospitals/:id/beds` - manual bed edit.
- `POST /api/v1/incidents/:id/ack`, `POST /api/v1/incidents/:id/assign-bed`.
- Full contracts in file 06.

## 8. Vitals Charts
Use Recharts. One sparkline per vital for the last 30 min of readings, threshold bands (for example SpO2 < 90 red), tooltip with exact value/time, and automatic update on `VITALS_UPDATE`.

## 9. Bed Panel
Toggle controls per bed type: `+` / `-` buttons and "Set exact number". Every change is audit-logged and broadcast through `BEDS_UPDATE`. Show `last updated` time and a prompt if older than 30 min.

## 10. Privacy
Show full patient identity only to `ER_STAFF` of the destination hospital. After `ARRIVED` + 24 h the card moves to history. Audit-log every view of a patient detail.

## 11. Components to Generate
`ErDashboardPage`, `IncomingQueue`, `PatientCard`, `PatientDetail`, `VitalTile`, `VitalsChart`, `EtaCountdown`, `AmbulanceMiniMap`, `ResourceChecklist`, `BedPanel`, `AlertBanner`, `SoundManager`, `useHospitalSocket` hook.

## 12. Acceptance Criteria
- Alert reaches the dashboard in under 2 s after hospital selection (measured in e2e test).
- ESI 1 alert sound repeats until acknowledged; escalation fires at 60 s.
- Dropped connection auto-recovers and resyncs without duplicates (dedupe by message `id`).
- A user from hospital A can never receive hospital B's alerts (negative test).
