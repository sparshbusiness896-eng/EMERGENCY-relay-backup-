-- ==============================================================================
-- Triage Relay: Emergency Trauma Dispatch & Smart Hospital Matching Platform
-- PostgreSQL 16 + PostGIS Schema Definition
-- Source: 06_DATABASE_AND_API_SCHEMA.md
-- ==============================================================================

-- Enable PostGIS extension for spatial/geographical queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ------------------------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
      'PARAMEDIC',
      'ER_STAFF',
      'HOSPITAL_ADMIN',
      'DISPATCHER',
      'SYSTEM_ADMIN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM (
      'CREATED',
      'DISPATCHED',
      'PATIENT_LOADED',
      'INTAKE_DONE',
      'HOSPITAL_SELECTED',
      'EN_ROUTE',
      'ARRIVING',
      'ARRIVED',
      'CANCELLED',
      'REDIRECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bed_type AS ENUM (
      'ER',
      'ICU',
      'TRAUMA',
      'PEDIATRIC_ICU',
      'BURN',
      'OR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE hospital_status AS ENUM (
      'ACTIVE',
      'DIVERSION',
      'CLOSED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- TABLE: hospitals
-- Core hospital directory with PostGIS Point coordinates
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  ed_entrance_location GEOGRAPHY(Point, 4326) NOT NULL,
  arrival_radius_m INT NOT NULL DEFAULT 50,
  status hospital_status NOT NULL DEFAULT 'ACTIVE',
  ed_occupancy_percent INT NOT NULL DEFAULT 0 CHECK (ed_occupancy_percent BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hospitals_location_gix ON hospitals USING GIST (location);
CREATE INDEX IF NOT EXISTS hospitals_status_idx ON hospitals (status);

-- ------------------------------------------------------------------------------
-- TABLE: hospital_capabilities
-- Clinical capability tags per hospital (e.g. CATH_LAB, NEUROSURGERY, etc.)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital_capabilities (
  hospital_id TEXT REFERENCES hospitals(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (hospital_id, tag)
);

CREATE INDEX IF NOT EXISTS hospital_capabilities_tag_idx ON hospital_capabilities (tag);

-- ------------------------------------------------------------------------------
-- TABLE: bed_inventory
-- Live bed capacity and availability per bed type
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bed_inventory (
  hospital_id TEXT REFERENCES hospitals(id) ON DELETE CASCADE,
  bed_type bed_type NOT NULL,
  total INT NOT NULL CHECK (total >= 0),
  available INT NOT NULL CHECK (available >= 0 AND available <= total),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  PRIMARY KEY (hospital_id, bed_type)
);

CREATE INDEX IF NOT EXISTS bed_inventory_updated_at_idx ON bed_inventory (updated_at);

-- ------------------------------------------------------------------------------
-- TABLE: ambulances
-- Fleet ambulance registry
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ambulances (
  id TEXT PRIMARY KEY,
  call_sign TEXT UNIQUE NOT NULL,
  plate_number TEXT,
  type TEXT NOT NULL DEFAULT 'ALS', -- 'ALS' (Advanced) or 'BLS' (Basic)
  is_available BOOLEAN NOT NULL DEFAULT true
);

-- ------------------------------------------------------------------------------
-- TABLE: users
-- System accounts with role-based permissions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  hospital_id TEXT REFERENCES hospitals(id),       -- For ER_STAFF / HOSPITAL_ADMIN
  ambulance_id TEXT,                               -- For PARAMEDIC (current unit)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- ------------------------------------------------------------------------------
-- TABLE: incidents
-- Emergency incidents tracked from 108 dispatch through hospital handover
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  ambulance_id TEXT REFERENCES ambulances(id),
  dispatcher_id TEXT REFERENCES users(id),
  paramedic_id TEXT REFERENCES users(id),
  status incident_status NOT NULL DEFAULT 'CREATED',
  scene_location GEOGRAPHY(Point, 4326) NOT NULL,
  scene_address TEXT,
  esi_level SMALLINT CHECK (esi_level BETWEEN 1 AND 5),
  esi_suggested SMALLINT,
  trauma_types TEXT[] NOT NULL DEFAULT '{}',
  mechanism TEXT,
  notes TEXT,
  selected_hospital_id TEXT REFERENCES hospitals(id),
  override_reason_code TEXT,
  override_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  hospital_selected_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents (status);
CREATE INDEX IF NOT EXISTS incidents_hospital_idx ON incidents (selected_hospital_id);
CREATE INDEX IF NOT EXISTS incidents_paramedic_idx ON incidents (paramedic_id);

-- ------------------------------------------------------------------------------
-- TABLE: patients
-- Patient demographic record associated with an incident
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  incident_id TEXT UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
  full_name TEXT DEFAULT 'Unknown',
  age_years INT,
  sex TEXT DEFAULT 'UNKNOWN',
  weight_kg NUMERIC(5, 1),
  is_pediatric BOOLEAN GENERATED ALWAYS AS (age_years < 16) STORED
);

-- ------------------------------------------------------------------------------
-- TABLE: vitals_readings (append-only)
-- Time-series telemetry of patient vital signs in transport
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vitals_readings (
  id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by TEXT REFERENCES users(id),
  sbp INT,
  dbp INT,
  heart_rate INT,
  respiratory_rate INT,
  spo2 INT,
  temperature_c NUMERIC(4, 1),
  glucose_mg_dl INT,
  gcs_eye SMALLINT,
  gcs_verbal SMALLINT,
  gcs_motor SMALLINT,
  gcs_total SMALLINT,
  rts_triage SMALLINT,
  rts_weighted NUMERIC(5, 3)
);

CREATE INDEX IF NOT EXISTS vitals_incident_time_idx ON vitals_readings (incident_id, taken_at);

-- ------------------------------------------------------------------------------
-- TABLE: recommendations_log
-- Audit trail of scoring algorithm executions and outputs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations_log (
  id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requirements JSONB NOT NULL,
  results JSONB NOT NULL,
  config_version INT NOT NULL
);

-- ------------------------------------------------------------------------------
-- TABLE: routing_logs
-- Route segments, traffic delays, and reroute events
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routing_logs (
  id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL, -- INITIAL | TRAFFIC_DELAY | OFF_ROUTE | CLOSURE | MANUAL
  destination_hospital_id TEXT REFERENCES hospitals(id),
  distance_m INT,
  duration_s INT,
  eta_source TEXT,
  geometry JSONB
);

-- ------------------------------------------------------------------------------
-- TABLE: location_pings
-- High-frequency GPS telemetry from ambulance (every 3s)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_pings (
  id BIGSERIAL PRIMARY KEY,
  incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
  ambulance_id TEXT,
  ts TIMESTAMPTZ NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  speed_mps REAL,
  heading_deg REAL,
  accuracy_m REAL
);

CREATE INDEX IF NOT EXISTS pings_incident_ts_idx ON location_pings (incident_id, ts);

-- ------------------------------------------------------------------------------
-- TABLE: alerts
-- ED Pre-alerts dispatched upon hospital selection
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
  hospital_id TEXT REFERENCES hospitals(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT REFERENCES users(id),
  escalated_at TIMESTAMPTZ,
  assigned_bed JSONB
);

CREATE INDEX IF NOT EXISTS alerts_hospital_ack_idx ON alerts (hospital_id, acknowledged_at);

-- ------------------------------------------------------------------------------
-- TABLE: audit_logs (append-only)
-- Clinical & administrative compliance audit log (DPDP Act 2023 / HIPAA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  ip INET,
  details JSONB
);

CREATE INDEX IF NOT EXISTS audit_logs_ts_idx ON audit_logs (ts);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity, entity_id);

-- ------------------------------------------------------------------------------
-- TABLE: recommendation_config
-- Clinically adjustable scoring parameters and weights
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendation_config (
  version SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  config JSONB NOT NULL
);
