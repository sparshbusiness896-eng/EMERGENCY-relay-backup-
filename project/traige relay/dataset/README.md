# Triage Relay: Datasets & Schemas Module

This folder contains the complete database schemas, reference lookup tables, seed datasets, and clinical test cases for the **Emergency Trauma Dispatch & Smart Hospital Matching Platform**.

---

## Folder Contents

| File | Description | Source / Spec |
|---|---|---|
| `schema.sql` | Production PostgreSQL 16 + PostGIS schema with ENUMs, spatial indexes, tables, foreign keys, and audit logging. | File `06_DATABASE_AND_API_SCHEMA.md` Section 2 |
| `seed_data.sql` | SQL seed script creating 10 hospitals (varied specialties, 1 diversion, 1 zero-ICU), ambulances, users, and demo records. | File `06_DATABASE_AND_API_SCHEMA.md` Section 9 |
| `hospitals.json` | 10 sample hospitals in JSON format with coordinates, capabilities, and bed inventories. | File `03_RECOMMENDATION_ENGINE.md` & `06` |
| `ambulances.json` | Fleet ALS and BLS ambulances with call signs and locations. | File `06_DATABASE_AND_API_SCHEMA.md` |
| `users.json` | Demo user accounts across all 5 system roles (`PARAMEDIC`, `ER_STAFF`, `HOSPITAL_ADMIN`, `DISPATCHER`, `SYSTEM_ADMIN`). | File `01` & `06` |
| `clinical_reference_data.json` | Clinical lookup tables for Glasgow Coma Scale (GCS), Revised Trauma Score (RTS), Emergency Severity Index (ESI), and Capability Mappings. | File `02_PARAMEDIC_INTAKE_MODULE.md` & `03` |
| `test_cases.json` | 5 clinical triage and dispatch test scenarios (STEMI, Pediatric Head Injury, Polytrauma, Burns, Diversion). | System validation suite |

---

## Key Enums & Standards

### User Roles
- `PARAMEDIC`: Mobile-first intake, hospital selection, in-transit telemetry.
- `ER_STAFF`: Destination hospital pre-alert dashboard, bed assignment, resource prep.
- `HOSPITAL_ADMIN`: Bed count maintenance, capability tags, diversion toggle.
- `DISPATCHER`: 108 control room overview, incident creation, fleet monitoring.
- `SYSTEM_ADMIN`: Platform configuration, clinical weights, audit log inspections.

### Hospital Capability Tags
`ER_24X7`, `TRAUMA_CENTER_L1`, `TRAUMA_CENTER_L2`, `NEUROSURGERY`, `CATH_LAB`, `COMPREHENSIVE_STROKE_CENTER`, `PRIMARY_STROKE_CENTER`, `PEDIATRIC_TRAUMA`, `ORTHOPEDICS`, `BURN_UNIT`, `OBSTETRICS_EMERGENCY`, `VASCULAR_SURGERY`, `CT_24X7`, `BLOOD_BANK`, `POISON_CENTER`.

### Bed Types
`ER`, `ICU`, `TRAUMA`, `PEDIATRIC_ICU`, `BURN`, `OR`.

---

## How to Load the Database

### Using PostgreSQL / PostGIS CLI:
```bash
# 1. Create database
createdb triage_relay

# 2. Run schema
psql -d triage_relay -f dataset/schema.sql

# 3. Load seed data
psql -d triage_relay -f dataset/seed_data.sql
```

### In Application Code:
The JSON files (`hospitals.json`, `clinical_reference_data.json`, `ambulances.json`) can be loaded directly by backend services or offline mobile clients without requiring an active PostgreSQL instance for offline operation.
