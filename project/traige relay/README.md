# Triage Relay: Emergency Trauma Dispatch & Smart Hospital Matching Platform

![Triage Relay Logo](frontend/assets/logo.png)

A clinical decision-support and dispatch platform that matches trauma patients at accident scenes to the best-suited hospital emergency department (ED) in real time, pushes live pre-alerts to ED resuscitation teams, and provides turn-by-turn navigation with live telemetry.

---

## Workspace Directory Structure

All files have been organized into clean, dedicated, modular directories so you can develop, test, and deploy each layer independently without clutter:

```
triage-relay/
├── dataset/                     # Database schemas, seed data & clinical reference tables
│   ├── schema.sql               # PostgreSQL 16 + PostGIS schema (tables, ENUMs, spatial indexes)
│   ├── seed_data.sql            # Full SQL seed data (10 hospitals, ambulances, users, demo incident)
│   ├── hospitals.json           # 10 realistic hospitals with coordinates, capabilities & bed inventory
│   ├── ambulances.json          # Fleet ALS & BLS ambulance registry
│   ├── users.json               # Demo users across all 5 clinical and administrative roles
│   ├── clinical_reference_data.json # Triage tables: GCS scales, RTS weights, ESI rules, capability map
│   ├── test_cases.json          # 5 clinical test scenarios (STEMI, Pediatric Neuro, Polytrauma, Burns)
│   └── README.md                # Dataset documentation & data dictionary
│
├── backend/                     # Clinical calculation engines, recommendation scoring & REST/WS API
│   ├── package.json             # Backend configuration and runnable scripts
│   ├── src/
│   │   ├── types.js             # System enums (UserRole, IncidentStatus, BedType, TraumaType, Capability)
│   │   ├── triage.js            # GCS, RTS Triage, RTS Weighted, and ESI rule calculation engines
│   │   ├── scoring.js           # 0-100 Clinical Recommendation scoring formula & fallback rules
│   │   ├── routing.js           # RoutingProvider, live traffic simulator & arrival triggers
│   │   ├── store.js             # In-memory database repository initialized with seed data
│   │   ├── server.js            # Node.js REST API & realtime event streaming server
│   │   └── simulate_ambulance.js# Telemetry replay script for testing arrival triggers
│   ├── tests/
│   │   └── run_tests.js         # Automated unit test suite verifying formulas & boundary conditions
│   └── README.md                # Backend architecture, API endpoints & execution guide
│
├── frontend/                    # Modern, responsive Emergency Medical Web Application
│   ├── index.html               # Single-page multi-module portal (Paramedic, Recs, ER, Nav, Dispatch)
│   ├── styles.css               # Tactical emergency medical design system (Dark Mode, 48px tactile UI)
│   ├── app.js                   # Client state, clinical calculators, audio alarms, canvas maps
│   ├── assets/
│   │   └── logo.png             # Official high-resolution Triage Relay branding logo
│   └── README.md                # Frontend modules, UX principles & running guide
│
├── docs/                        # Complete specification documents & architecture blueprints
│   ├── 01_PROJECT_OVERVIEW.md
│   ├── 02_PARAMEDIC_INTAKE_MODULE.md
│   ├── 03_RECOMMENDATION_ENGINE.md
│   ├── 04_ER_DASHBOARD_MODULE.md
│   ├── 05_NAVIGATION_MODULE.md
│   ├── 06_DATABASE_AND_API_SCHEMA.md
│   └── README.md
│
└── README.md                    # This root master index
```

---

## Three Core Folders Summary

### 1. [`dataset/`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/dataset)
- Contains production PostgreSQL 16 + PostGIS schema ([`schema.sql`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/dataset/schema.sql)).
- Contains sample seed data ([`seed_data.sql`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/dataset/seed_data.sql)) and JSON files ([`hospitals.json`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/dataset/hospitals.json), [`ambulances.json`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/dataset/ambulances.json), [`users.json`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/dataset/users.json)).
- Contains clinical reference lookup tables ([`clinical_reference_data.json`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/dataset/clinical_reference_data.json)) and end-to-end test scenarios ([`test_cases.json`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/dataset/test_cases.json)).

### 2. [`backend/`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/backend)
- Implements clinical triage calculators ([`triage.js`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/backend/src/triage.js)) for GCS, RTS Triage, RTS Weighted, and ESI rule suggestions.
- Implements the 0-100 scoring algorithm and clinical fallback rules ([`scoring.js`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/backend/src/scoring.js)).
- Implements navigation distance and geofence arrival triggers ([`routing.js`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/backend/src/routing.js)).
- Implements full REST API and realtime push server ([`server.js`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/backend/src/server.js)) supporting all endpoints from File 06.
- Includes automated unit tests ([`tests/run_tests.js`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/backend/tests/run_tests.js)) and GPS simulator ([`simulate_ambulance.js`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/backend/src/simulate_ambulance.js)).

### 3. [`frontend/`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/frontend)
- **Paramedic Intake View:** Gloved tactile touch controls, vitals matrix, GCS segmented selector, trauma chips, and real-time acuity HUD.
- **Smart Recommendations View:** Ranked hospital cards with scores, live ETAs, available beds, and clinical rationale.
- **ER Pre-Alert Dashboard:** 3-column wall display with incoming patient queue, live vitals trend charts, audio sirens, and bed assignment controls.
- **Turn-by-Turn Navigation:** Maneuver banner, canvas GPS map with arrival geofence, and in-transit telemetry HUD.
- **108 Dispatch Monitor:** Fleet status overview and city emergency department capacity table.

---

## Quick Start & Verification

### To view the Frontend Web Application:
Double-click [`frontend/index.html`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/frontend/index.html) to open directly in any browser (Chrome, Edge, Firefox, Safari).

### To run the Backend:
```bash
# In backend/ directory:
node src/server.js
```

### To run the Unit Tests:
```bash
# In backend/ directory:
node tests/run_tests.js
```
