# File: 06_DATABASE_AND_API_SCHEMA.md

# Database & API Schema

Database: PostgreSQL 16 + PostGIS. IDs are ULIDs with a prefix (`inc_`, `hos_`, `amb_`, `pat_`, `usr_`). All timestamps are `timestamptz` in UTC. Use Prisma for models; use raw SQL for geo queries and the migration below as the source of truth.

## 1. Entity Overview
`users` -> `hospitals` (ER staff/admin belong to one hospital) -> `hospital_capabilities`, `bed_inventory`.
`ambulances` -> `incidents` -> `patients`, `vitals_readings`, `recommendations_log`, `routing_logs`, `location_pings`, `alerts`.
Plus `audit_logs`, `recommendation_config`.

## 2. SQL Schema
```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE user_role AS ENUM ('PARAMEDIC','ER_STAFF','HOSPITAL_ADMIN','DISPATCHER','SYSTEM_ADMIN');
CREATE TYPE incident_status AS ENUM ('CREATED','DISPATCHED','PATIENT_LOADED','INTAKE_DONE','HOSPITAL_SELECTED','EN_ROUTE','ARRIVING','ARRIVED','CANCELLED','REDIRECTED');
CREATE TYPE bed_type AS ENUM ('ER','ICU','TRAUMA','PEDIATRIC_ICU','BURN','OR');
CREATE TYPE hospital_status AS ENUM ('ACTIVE','DIVERSION','CLOSED');

CREATE TABLE hospitals (
  id text PRIMARY KEY, name text NOT NULL, address text, phone text,
  location geography(Point,4326) NOT NULL,
  ed_entrance_location geography(Point,4326) NOT NULL,
  arrival_radius_m int NOT NULL DEFAULT 50,
  status hospital_status NOT NULL DEFAULT 'ACTIVE',
  ed_occupancy_percent int NOT NULL DEFAULT 0 CHECK (ed_occupancy_percent BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hospitals_location_gix ON hospitals USING GIST (location);

CREATE TABLE hospital_capabilities (
  hospital_id text REFERENCES hospitals(id) ON DELETE CASCADE,
  tag text NOT NULL,                       -- Capability enum from file 03
  PRIMARY KEY (hospital_id, tag)
);

CREATE TABLE bed_inventory (
  hospital_id text REFERENCES hospitals(id) ON DELETE CASCADE,
  bed_type bed_type NOT NULL,
  total int NOT NULL CHECK (total >= 0),
  available int NOT NULL CHECK (available >= 0 AND available <= total),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  PRIMARY KEY (hospital_id, bed_type)
);

CREATE TABLE users (
  id text PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
  full_name text NOT NULL, role user_role NOT NULL,
  hospital_id text REFERENCES hospitals(id),       -- for ER_STAFF / HOSPITAL_ADMIN
  ambulance_id text,                                -- for PARAMEDIC (current assignment)
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ambulances (
  id text PRIMARY KEY, call_sign text UNIQUE NOT NULL, plate_number text,
  type text NOT NULL DEFAULT 'ALS',                 -- ALS / BLS
  is_available boolean NOT NULL DEFAULT true
);

CREATE TABLE incidents (
  id text PRIMARY KEY,
  ambulance_id text REFERENCES ambulances(id),
  dispatcher_id text REFERENCES users(id),
  paramedic_id text REFERENCES users(id),
  status incident_status NOT NULL DEFAULT 'CREATED',
  scene_location geography(Point,4326) NOT NULL,
  scene_address text,
  esi_level smallint CHECK (esi_level BETWEEN 1 AND 5),
  esi_suggested smallint,
  trauma_types text[] NOT NULL DEFAULT '{}',
  mechanism text, notes text,
  selected_hospital_id text REFERENCES hospitals(id),
  override_reason_code text, override_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  picked_up_at timestamptz, hospital_selected_at timestamptz, arrived_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_status_idx ON incidents(status);
CREATE INDEX incidents_hospital_idx ON incidents(selected_hospital_id);

CREATE TABLE patients (
  id text PRIMARY KEY, incident_id text UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
  full_name text DEFAULT 'Unknown', age_years int, sex text DEFAULT 'UNKNOWN',
  weight_kg numeric(5,1), is_pediatric boolean GENERATED ALWAYS AS (age_years < 16) STORED
);

CREATE TABLE vitals_readings (                       -- append-only
  id text PRIMARY KEY, incident_id text REFERENCES incidents(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL, recorded_by text REFERENCES users(id),
  sbp int, dbp int, heart_rate int, respiratory_rate int, spo2 int,
  temperature_c numeric(4,1), glucose_mg_dl int,
  gcs_eye smallint, gcs_verbal smallint, gcs_motor smallint, gcs_total smallint,
  rts_triage smallint, rts_weighted numeric(5,3)
);
CREATE INDEX vitals_incident_time_idx ON vitals_readings(incident_id, taken_at);

CREATE TABLE recommendations_log (
  id text PRIMARY KEY, incident_id text REFERENCES incidents(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  requirements jsonb NOT NULL, results jsonb NOT NULL, config_version int NOT NULL
);

CREATE TABLE routing_logs (
  id text PRIMARY KEY, incident_id text REFERENCES incidents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,                              -- INITIAL|TRAFFIC_DELAY|OFF_ROUTE|CLOSURE|MANUAL
  destination_hospital_id text REFERENCES hospitals(id),
  distance_m int, duration_s int, eta_source text, geometry jsonb
);

CREATE TABLE location_pings (
  id bigserial PRIMARY KEY, incident_id text REFERENCES incidents(id) ON DELETE CASCADE,
  ambulance_id text, ts timestamptz NOT NULL,
  location geography(Point,4326) NOT NULL,
  speed_mps real, heading_deg real, accuracy_m real
);
CREATE INDEX pings_incident_ts_idx ON location_pings(incident_id, ts);

CREATE TABLE alerts (
  id text PRIMARY KEY, incident_id text REFERENCES incidents(id) ON DELETE CASCADE,
  hospital_id text REFERENCES hospitals(id), sent_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz, acknowledged_by text REFERENCES users(id),
  escalated_at timestamptz
);

CREATE TABLE audit_logs (                            -- append-only: no UPDATE/DELETE grants
  id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(),
  user_id text, action text NOT NULL, entity text, entity_id text, ip inet, details jsonb
);

CREATE TABLE recommendation_config (
  version serial PRIMARY KEY, created_at timestamptz DEFAULT now(), created_by text,
  config jsonb NOT NULL                              -- weights, thresholds, requirement map (file 03)
);
```

## 3. Common Conventions
- Base path `/api/v1`. JSON only. Auth header `Authorization: Bearer <JWT>`.
- Error shape: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ ... ] } }`.
- Pagination: `?limit=50&cursor=<id>`.
- Rate limits: 100 req/min per user (REST), 1 msg/s per WS connection.
- Every endpoint validates input with Zod from `/packages/shared`.

## 4. REST Endpoints
### Auth
| Method & path | Role | Description |
|---|---|---|
| `POST /auth/login` | public | `{ email, password }` -> `{ accessToken, user }`, sets refresh cookie |
| `POST /auth/refresh` | public | Rotate tokens |
| `POST /auth/logout` | any | Revoke refresh token |

### Incidents
| Method & path | Role | Description |
|---|---|---|
| `POST /incidents` | DISPATCHER | Create incident `{ sceneLocation:{lat,lng}, sceneAddress?, ambulanceId }` |
| `GET /incidents/:id` | participants/destination ED | Full incident |
| `POST /incidents/:id/intake` | PARAMEDIC | Save intake (file 02) |
| `POST /incidents/:id/vitals` | PARAMEDIC | Add a vitals reading |
| `POST /incidents/:id/select-hospital` | PARAMEDIC | `{ hospitalId, recommendationId?, override? }` -> creates alert and starts navigation |
| `POST /incidents/:id/override` | PARAMEDIC | Record override reason |
| `POST /incidents/:id/ack` | ER_STAFF | Acknowledge pre-alert |
| `POST /incidents/:id/assign-bed` | ER_STAFF | `{ bedType, bedLabel }` |
| `POST /incidents/:id/arrive` | PARAMEDIC/ER_STAFF | Mark arrived |
| `GET /dispatch/incidents/active` | DISPATCHER | All active incidents |

### Hospitals
| Method & path | Role | Description |
|---|---|---|
| `GET /hospitals` | any auth | List with capabilities and beds |
| `GET /hospitals/:id/incoming` | ER_STAFF | Active incoming incidents |
| `PUT /hospitals/:id/beds` | HOSPITAL_ADMIN/ER_STAFF | Update bed counts |
| `PUT /hospitals/:id/status` | HOSPITAL_ADMIN | `ACTIVE|DIVERSION|CLOSED` |
| `PUT /hospitals/:id/capabilities` | HOSPITAL_ADMIN | Replace tag list |

### Recommendations & Navigation
`POST /recommendations` (file 03), `GET /navigation/route`, `POST /navigation/reroute`, `GET /navigation/:incidentId/track` (file 05).

### Admin
`CRUD /admin/users`, `CRUD /admin/hospitals`, `CRUD /admin/ambulances`, `GET /admin/audit-logs`, `PUT /admin/recommendation-config`.

## 5. Key Request/Response Examples
### `POST /incidents/:id/intake`
```json
{
  "patient": { "ageYears": 34, "sex": "MALE", "name": "Unknown" },
  "vitals": { "sbp": 92, "dbp": 60, "heartRate": 118, "respiratoryRate": 24, "spo2": 93, "temperatureC": 36.4 },
  "gcs": { "eye": 3, "verbal": 3, "motor": 3 },
  "traumaTypes": ["HEAD_INJURY", "MAJOR_BLEEDING"],
  "mechanism": "Two-wheeler vs truck",
  "acuity": { "esiLevel": 2 },
  "notes": "IV x2 established"
}
```
Response `200`:
```json
{ "incidentId": "inc_01HZX", "status": "INTAKE_DONE",
  "derived": { "gcsTotal": 9, "rtsTriage": 9, "rtsWeighted": 6.9, "esiSuggested": 2 } }
```

### `POST /incidents/:id/select-hospital`
Request: `{ "hospitalId": "hos_001", "recommendationId": "rec_77" }`
Response `200`:
```json
{ "incidentId": "inc_01HZX", "status": "HOSPITAL_SELECTED", "alertId": "alr_9",
  "route": { "durationSeconds": 660, "distanceMeters": 6200, "etaSource": "LIVE_TRAFFIC" },
  "websocket": "/api/v1/navigation/live-location?incidentId=inc_01HZX" }
```
Side effects: write `alerts` row, publish `INCOMING_PATIENT` to the hospital channel (file 04), write audit log, create first `routing_logs` row.

### `PUT /hospitals/:id/beds`
Request: `{ "beds": { "ER": { "total": 20, "available": 6 }, "ICU": { "total": 8, "available": 2 }, "TRAUMA": { "total": 4, "available": 1 } } }`
Response `200`: `{ "hospitalId": "hos_001", "updatedAt": "2026-10-07T10:12:00Z" }`

## 6. WebSocket Endpoints (summary)
| Endpoint | Who | Messages |
|---|---|---|
| `WS /api/v1/hospitals/:hospitalId/alerts` | ER_STAFF | `INCOMING_PATIENT`, `VITALS_UPDATE`, `ETA_UPDATE`, `INCIDENT_STATUS`, `BEDS_UPDATE`; client sends `ACK`, `ASSIGN_BED`, `RESOURCE_STATUS`, `REQUEST_DIVERSION` (file 04) |
| `WS /api/v1/navigation/live-location?incidentId=` | PARAMEDIC | client `LOCATION`; server `ROUTE_UPDATE`, `ARRIVAL_TRIGGER`, `HOSPITAL_ACK`, `DIVERSION_NOTICE` (file 05) |
| `WS /api/v1/dispatch/fleet` | DISPATCHER | `FLEET_SNAPSHOT`, `FLEET_UPDATE` |

All WS messages use envelope `{ type, id, ts, payload }`. Fan-out through Redis channels: `hospital:{id}:alerts`, `incident:{id}:events`, `fleet`.

## 7. Access Control Matrix (enforce in middleware)
- `PARAMEDIC`: only incidents where `paramedic_id = self`.
- `ER_STAFF` / `HOSPITAL_ADMIN`: only incidents where `selected_hospital_id = own hospital_id`; only own hospital's beds.
- `DISPATCHER`: read all active incidents; create incidents.
- `SYSTEM_ADMIN`: everything; cannot edit audit logs.
- Every read of patient/vitals data writes an `audit_logs` row.

## 8. Security Requirements
- Passwords: argon2id. JWT secrets from env. CORS allow-list. Helmet headers. TLS only.
- Encrypt sensitive columns (`patients.full_name`) at the application level or with `pgcrypto`.
- Parameterized queries only. Input validated at every boundary.
- Retention job (cron): delete `location_pings` and identifiable patient fields older than 90 days (configurable).

## 9. Seed Data (`/infra/seed.ts`)
- 10 hospitals around one city with different capability sets (at least: 2 Cath Lab, 2 Comprehensive Stroke, 1 Pediatric Trauma, 2 Level 1 Trauma, 3 general ER) and varied bed counts, including one on `DIVERSION` and one with 0 ICU beds.
- 1 user per role, 3 ambulances.
- Default `recommendation_config` v1 from file 03.

## 10. Acceptance Criteria
- Migration runs cleanly on an empty database; seed script is idempotent.
- OpenAPI 3.1 spec auto-generated at `/api/docs`.
- Integration tests cover role-based access (a user from hospital A cannot read hospital B's incident).
- Demo script runs the full flow from file 01 section 9.
