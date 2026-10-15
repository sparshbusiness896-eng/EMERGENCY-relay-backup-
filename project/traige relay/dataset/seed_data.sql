-- ==============================================================================
-- Triage Relay: Sample Seed Dataset (PostgreSQL / PostGIS)
-- 10 Hospitals, Fleet Ambulances, Multi-Role Users, Config & Clinical Records
-- Source: 06_DATABASE_AND_API_SCHEMA.md Section 9
-- ==============================================================================

-- 1. HOSPITALS (10 Hospitals with coordinates centered in regional medical zone)
INSERT INTO hospitals (id, name, address, phone, location, ed_entrance_location, arrival_radius_m, status, ed_occupancy_percent)
VALUES
  (
    'hos_001',
    'Apex Apex Level-1 Trauma & Multi-Specialty Hospital',
    'Plot 14, Health City Parkway, Central Sector',
    '+91-135-255-0101',
    ST_SetSRID(ST_MakePoint(78.0322, 30.3165), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0325, 30.3168), 4326)::geography,
    50,
    'ACTIVE',
    68
  ),
  (
    'hos_002',
    'Metro Heart & Vascular Super-Specialty Institute',
    '88 Ring Road, South Medical Corridor',
    '+91-135-255-0102',
    ST_SetSRID(ST_MakePoint(78.0410, 30.3050), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0412, 30.3052), 4326)::geography,
    50,
    'ACTIVE',
    55
  ),
  (
    'hos_003',
    'Comprehensive Neuro & Stroke Regional Hospital',
    '12 Civil Lines, West Wing',
    '+91-135-255-0103',
    ST_SetSRID(ST_MakePoint(78.0190, 30.3290), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0192, 30.3292), 4326)::geography,
    50,
    'ACTIVE',
    60
  ),
  (
    'hos_004',
    'Children and Maternity Emergency Medical Center',
    '45 Shanti Path, Sector 4',
    '+91-135-255-0104',
    ST_SetSRID(ST_MakePoint(78.0550, 30.3340), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0553, 30.3342), 4326)::geography,
    50,
    'ACTIVE',
    42
  ),
  (
    'hos_005',
    'St. Jude Burn & Emergency Trauma Center',
    '7 Industrial Bypass, East Zone',
    '+91-135-255-0105',
    ST_SetSRID(ST_MakePoint(78.0620, 30.2980), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0622, 30.2982), 4326)::geography,
    50,
    'ACTIVE',
    75
  ),
  (
    'hos_006',
    'Valley Orthopedic & Surgical Emergency Hospital',
    '19 Ridge View Road, North Foothills',
    '+91-135-255-0106',
    ST_SetSRID(ST_MakePoint(78.0080, 30.3450), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0082, 30.3452), 4326)::geography,
    50,
    'ACTIVE',
    50
  ),
  (
    'hos_007',
    'Central Memorial Level-2 Trauma Hospital',
    '102 Grand Trunk Ave, Old Cantonment',
    '+91-135-255-0107',
    ST_SetSRID(ST_MakePoint(78.0250, 30.3120), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0253, 30.3122), 4326)::geography,
    50,
    'ACTIVE',
    72
  ),
  (
    'hos_008',
    'Riverside General & Emergency Care Center',
    '33 Riverbed Expressway, South End',
    '+91-135-255-0108',
    ST_SetSRID(ST_MakePoint(78.0480, 30.2850), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0483, 30.2853), 4326)::geography,
    50,
    'ACTIVE',
    80
  ),
  (
    'hos_009',
    'North Suburban General Hospital (ON DIVERSION)',
    '210 Highway Link, North Industrial Hub',
    '+91-135-255-0109',
    ST_SetSRID(ST_MakePoint(78.0120, 30.3620), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0122, 30.3622), 4326)::geography,
    50,
    'DIVERSION',
    98
  ),
  (
    'hos_010',
    'Sunrise Emergency Community Clinic (0 ICU BEDS)',
    '5 Bazar Gate, Downtown Market',
    '+91-135-255-0110',
    ST_SetSRID(ST_MakePoint(78.0370, 30.3210), 4326)::geography,
    ST_SetSRID(ST_MakePoint(78.0372, 30.3212), 4326)::geography,
    50,
    'ACTIVE',
    90
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  ed_occupancy_percent = EXCLUDED.ed_occupancy_percent;

-- 2. HOSPITAL CAPABILITIES
INSERT INTO hospital_capabilities (hospital_id, tag) VALUES
  -- hos_001 (Apex L1 Trauma + Stroke + Cath Lab)
  ('hos_001', 'ER_24X7'), ('hos_001', 'TRAUMA_CENTER_L1'), ('hos_001', 'CATH_LAB'),
  ('hos_001', 'COMPREHENSIVE_STROKE_CENTER'), ('hos_001', 'NEUROSURGERY'),
  ('hos_001', 'VASCULAR_SURGERY'), ('hos_001', 'ORTHOPEDICS'), ('hos_001', 'CT_24X7'),
  ('hos_001', 'BLOOD_BANK'),
  
  -- hos_002 (Cardiac / Cath Lab Center)
  ('hos_002', 'ER_24X7'), ('hos_002', 'CATH_LAB'), ('hos_002', 'VASCULAR_SURGERY'),
  ('hos_002', 'CT_24X7'), ('hos_002', 'BLOOD_BANK'),
  
  -- hos_003 (Stroke & Neuro)
  ('hos_003', 'ER_24X7'), ('hos_003', 'COMPREHENSIVE_STROKE_CENTER'),
  ('hos_003', 'PRIMARY_STROKE_CENTER'), ('hos_003', 'NEUROSURGERY'),
  ('hos_003', 'CT_24X7'), ('hos_003', 'BLOOD_BANK'),
  
  -- hos_004 (Pediatric & Obstetric)
  ('hos_004', 'ER_24X7'), ('hos_004', 'PEDIATRIC_TRAUMA'),
  ('hos_004', 'OBSTETRICS_EMERGENCY'), ('hos_004', 'BLOOD_BANK'), ('hos_004', 'CT_24X7'),
  
  -- hos_005 (Burn Unit + Trauma L1)
  ('hos_005', 'ER_24X7'), ('hos_005', 'BURN_UNIT'), ('hos_005', 'TRAUMA_CENTER_L1'),
  ('hos_005', 'BLOOD_BANK'), ('hos_005', 'CT_24X7'),
  
  -- hos_006 (Orthopedics)
  ('hos_006', 'ER_24X7'), ('hos_006', 'ORTHOPEDICS'), ('hos_006', 'VASCULAR_SURGERY'),
  ('hos_006', 'CT_24X7'),
  
  -- hos_007 (Level 2 Trauma)
  ('hos_007', 'ER_24X7'), ('hos_007', 'TRAUMA_CENTER_L2'), ('hos_007', 'BLOOD_BANK'),
  ('hos_007', 'CT_24X7'), ('hos_007', 'ORTHOPEDICS'),
  
  -- hos_008 (General ER)
  ('hos_008', 'ER_24X7'), ('hos_008', 'CT_24X7'), ('hos_008', 'POISON_CENTER'),
  
  -- hos_009 (Diversion Hospital)
  ('hos_009', 'ER_24X7'), ('hos_009', 'CATH_LAB'), ('hos_009', 'CT_24X7'),
  
  -- hos_010 (Clinic with 0 ICU)
  ('hos_010', 'ER_24X7'), ('hos_010', 'POISON_CENTER')
ON CONFLICT (hospital_id, tag) DO NOTHING;

-- 3. BED INVENTORY
INSERT INTO bed_inventory (hospital_id, bed_type, total, available, updated_at, updated_by) VALUES
  ('hos_001', 'ER', 25, 8, now(), 'admin_hos_001'),
  ('hos_001', 'ICU', 12, 4, now(), 'admin_hos_001'),
  ('hos_001', 'TRAUMA', 6, 2, now(), 'admin_hos_001'),
  ('hos_001', 'OR', 4, 1, now(), 'admin_hos_001'),

  ('hos_002', 'ER', 15, 6, now(), 'admin_hos_002'),
  ('hos_002', 'ICU', 14, 5, now(), 'admin_hos_002'),
  ('hos_002', 'OR', 3, 2, now(), 'admin_hos_002'),

  ('hos_003', 'ER', 16, 5, now(), 'admin_hos_003'),
  ('hos_003', 'ICU', 10, 3, now(), 'admin_hos_003'),
  ('hos_003', 'TRAUMA', 4, 1, now(), 'admin_hos_003'),

  ('hos_004', 'ER', 20, 11, now(), 'admin_hos_004'),
  ('hos_004', 'PEDIATRIC_ICU', 8, 3, now(), 'admin_hos_004'),
  ('hos_004', 'ICU', 6, 2, now(), 'admin_hos_004'),

  ('hos_005', 'ER', 14, 4, now(), 'admin_hos_005'),
  ('hos_005', 'BURN', 10, 3, now(), 'admin_hos_005'),
  ('hos_005', 'TRAUMA', 5, 1, now(), 'admin_hos_005'),
  ('hos_005', 'ICU', 6, 1, now(), 'admin_hos_005'),

  ('hos_006', 'ER', 12, 6, now(), 'admin_hos_006'),
  ('hos_006', 'TRAUMA', 4, 2, now(), 'admin_hos_006'),
  ('hos_006', 'ICU', 4, 1, now(), 'admin_hos_006'),

  ('hos_007', 'ER', 18, 5, now(), 'admin_hos_007'),
  ('hos_007', 'TRAUMA', 6, 2, now(), 'admin_hos_007'),
  ('hos_007', 'ICU', 8, 2, now(), 'admin_hos_007'),

  ('hos_008', 'ER', 14, 3, now(), 'admin_hos_008'),
  ('hos_008', 'ICU', 4, 1, now(), 'admin_hos_008'),

  -- hos_009 (DIVERSION: 0 beds available)
  ('hos_009', 'ER', 15, 0, now(), 'admin_hos_009'),
  ('hos_009', 'ICU', 6, 0, now(), 'admin_hos_009'),

  -- hos_010 (0 ICU beds available)
  ('hos_010', 'ER', 8, 2, now(), 'admin_hos_010'),
  ('hos_010', 'ICU', 2, 0, now(), 'admin_hos_010')
ON CONFLICT (hospital_id, bed_type) DO UPDATE SET
  total = EXCLUDED.total,
  available = EXCLUDED.available,
  updated_at = EXCLUDED.updated_at;

-- 4. AMBULANCES
INSERT INTO ambulances (id, call_sign, plate_number, type, is_available) VALUES
  ('amb_108_014', 'Ambulance 108 Alpha', 'UK-07-TA-1081', 'ALS', true),
  ('amb_108_015', 'Ambulance 108 Bravo', 'UK-07-TA-1082', 'ALS', true),
  ('amb_108_016', 'Ambulance 108 Charlie', 'UK-07-TB-2090', 'BLS', true)
ON CONFLICT (id) DO NOTHING;

-- 5. USERS (Roles: PARAMEDIC, ER_STAFF, HOSPITAL_ADMIN, DISPATCHER, SYSTEM_ADMIN)
INSERT INTO users (id, email, password_hash, full_name, role, hospital_id, ambulance_id, is_active) VALUES
  ('usr_paramedic_1', 'paramedic@108triage.org', '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$paramedic_hash', 'Vikram Singh (EMT-P)', 'PARAMEDIC', NULL, 'amb_108_014', true),
  ('usr_er_1', 'er.doctor@apex.org', '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$er_hash', 'Dr. Sunita Rao (ER In-Charge)', 'ER_STAFF', 'hos_001', NULL, true),
  ('usr_admin_1', 'admin@apex.org', '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$admin_hash', 'Rajesh Sharma (Admin)', 'HOSPITAL_ADMIN', 'hos_001', NULL, true),
  ('usr_dispatcher_1', 'dispatch@108control.org', '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$dispatcher_hash', 'Anita Mehra (Lead Dispatcher)', 'DISPATCHER', NULL, NULL, true),
  ('usr_sysadmin_1', 'sysadmin@triagerelay.org', '$argon2id$v=19$m=65536,t=3,p=4$demo_salt$sysadmin_hash', 'System Administrator', 'SYSTEM_ADMIN', NULL, NULL, true)
ON CONFLICT (id) DO NOTHING;

-- 6. RECOMMENDATION CONFIG (v1 Config Defaults)
INSERT INTO recommendation_config (version, created_at, created_by, config) VALUES
  (1, now(), 'system_init', '{
    "weights": {
      "ESI_1": { "eta": 0.45, "spec": 0.30, "cap": 0.20, "load": 0.05 },
      "ESI_2": { "eta": 0.35, "spec": 0.35, "cap": 0.20, "load": 0.10 },
      "ESI_3_5": { "eta": 0.25, "spec": 0.25, "cap": 0.25, "load": 0.25 }
    },
    "maxEtaMinutes": { "ESI_1_2": 45, "ESI_3_PLUS": 90 },
    "confidencePenalties": {
      "freshBedsUnder15Min": 1.0,
      "beds15To60Min": 0.9,
      "staleBedsOver60Min": 0.75,
      "estimatedEta": 0.85
    },
    "requirementsMap": {
      "CARDIAC_STEMI_SUSPECTED": { "required": ["CATH_LAB", "ER_24X7"], "preferred": ["ICU"], "bedType": "ICU" },
      "STROKE_SUSPECTED": { "required": ["CT_24X7"], "requiredAny": ["COMPREHENSIVE_STROKE_CENTER", "PRIMARY_STROKE_CENTER"], "preferred": ["COMPREHENSIVE_STROKE_CENTER", "NEUROSURGERY"], "bedType": "ICU" },
      "HEAD_INJURY_SEVERE": { "required": ["NEUROSURGERY", "CT_24X7"], "preferred": ["TRAUMA_CENTER_L1"], "bedType": "ICU" },
      "MAJOR_TRAUMA": { "requiredAny": ["TRAUMA_CENTER_L1", "TRAUMA_CENTER_L2"], "required": ["BLOOD_BANK"], "preferred": ["VASCULAR_SURGERY"], "bedType": "TRAUMA" },
      "LIMB_FRACTURE": { "required": ["ORTHOPEDICS"], "preferred": ["VASCULAR_SURGERY"], "bedType": "ER" },
      "BURNS": { "requiredAny": ["BURN_UNIT", "TRAUMA_CENTER_L1"], "preferred": [], "bedType": "BURN" },
      "PEDIATRIC_TRAUMA": { "required": ["PEDIATRIC_TRAUMA"], "preferred": [], "bedType": "PEDIATRIC_ICU" },
      "OBSTETRIC_EMERGENCY": { "required": ["OBSTETRICS_EMERGENCY"], "preferred": [], "bedType": "ER" },
      "DEFAULT": { "required": ["ER_24X7"], "preferred": [], "bedType": "ER" }
    }
  }'::jsonb)
ON CONFLICT (version) DO NOTHING;

-- 7. SAMPLE ACTIVE INCIDENT (For Instant Verification & Demo Flow)
INSERT INTO incidents (
  id, ambulance_id, dispatcher_id, paramedic_id, status,
  scene_location, scene_address, esi_level, esi_suggested,
  trauma_types, mechanism, notes, selected_hospital_id,
  created_at, picked_up_at, hospital_selected_at
) VALUES (
  'inc_01HZX990',
  'amb_108_014',
  'usr_dispatcher_1',
  'usr_paramedic_1',
  'EN_ROUTE',
  ST_SetSRID(ST_MakePoint(78.0280, 30.3110), 4326)::geography,
  'Rajpur Road Intersection, Near Clock Tower',
  2,
  2,
  ARRAY['HEAD_INJURY', 'MAJOR_BLEEDING'],
  'High-speed motorcycle collision with commercial truck',
  'Severe scalp laceration, right temporal hematoma suspected, IV x2 established',
  'hos_001',
  now() - interval '25 minutes',
  now() - interval '15 minutes',
  now() - interval '8 minutes'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO patients (id, incident_id, full_name, age_years, sex, weight_kg)
VALUES ('pat_01HZX990', 'inc_01HZX990', 'Rohan Sharma', 34, 'MALE', 72.5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vitals_readings (
  id, incident_id, taken_at, recorded_by,
  sbp, dbp, heart_rate, respiratory_rate, spo2, temperature_c, glucose_mg_dl,
  gcs_eye, gcs_verbal, gcs_motor, gcs_total, rts_triage, rts_weighted
) VALUES (
  'vit_01HZX_01', 'inc_01HZX990', now() - interval '14 minutes', 'usr_paramedic_1',
  90, 58, 122, 26, 91, 36.5, 110,
  3, 3, 4, 10, 9, 6.90
), (
  'vit_01HZX_02', 'inc_01HZX990', now() - interval '5 minutes', 'usr_paramedic_1',
  92, 60, 118, 24, 93, 36.4, 108,
  3, 3, 3, 9, 9, 6.90
) ON CONFLICT (id) DO NOTHING;

INSERT INTO alerts (
  id, incident_id, hospital_id, sent_at, acknowledged_at, acknowledged_by, assigned_bed
) VALUES (
  'alr_01HZX_01', 'inc_01HZX990', 'hos_001',
  now() - interval '8 minutes', now() - interval '7 minutes', 'usr_er_1',
  '{"bedType": "TRAUMA", "bedLabel": "Trauma Bay 2"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 8. INITIAL SYSTEM AUDIT LOG
INSERT INTO audit_logs (action, entity, entity_id, details, user_id)
VALUES ('STORE_INIT', 'SYSTEM', 'SYSTEM', '{"loadedHospitals": 10}'::jsonb, 'SYSTEM');

