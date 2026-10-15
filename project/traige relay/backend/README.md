# Triage Relay: Backend Architecture & Services

This folder contains the clinical decision-support logic, recommendation engine, routing services, in-memory repository, and REST/WebSocket API for the **Triage Relay Platform**.

---

## Folder Layout

```
backend/
├── package.json               # Node.js project manifest & scripts
├── src/
│   ├── types.js               # System Enums (UserRole, IncidentStatus, BedType, TraumaType, Capability)
│   ├── triage.js              # GCS, RTS, RTS Weighted, and ESI rule calculation engines
│   ├── scoring.js             # 0-100 Clinical Recommendation scoring formula & fallback rules
│   ├── routing.js             # RoutingProvider, live traffic model, ETA matrix, arrival triggers
│   ├── store.js               # Fast in-memory state repository loaded from `dataset/`
│   ├── server.js              # REST API & realtime event streaming server
│   └── simulate_ambulance.js  # Telemetry replay script for testing arrival triggers
└── tests/
    └── run_tests.js           # Unit test suite verifying formulas, boundary conditions & fallbacks
```

---

## Core Algorithms & Implementations

### 1. Clinical Triage Calculators (`src/triage.js`)
- **Glasgow Coma Scale (GCS):** `Eye (1-4) + Verbal (1-5) + Motor (1-6)` = 3 to 15.
- **Revised Trauma Score (RTS Triage):** Coded GCS (0-4) + Coded SBP (0-4) + Coded RR (0-4) = 0 to 12. Score $\le 11$ indicates trauma center referral.
- **RTS Weighted:** $0.9368 \times GCS_{code} + 0.7326 \times SBP_{code} + 0.2908 \times RR_{code}$.
- **ESI Rule Engine:** Recommends ESI 1 (Immediate/Resuscitation), ESI 2 (Emergent), or ESI 3 (Urgent) based on physiological shock indices and trauma mechanisms.

### 2. Smart Hospital Recommendation Engine (`src/scoring.js`)
- **Score Formula (0-100):**
  $$\text{Score} = 100 \times (w_{eta} \cdot S_{eta} + w_{cap} \cdot S_{cap} + w_{spec} \cdot S_{spec} + w_{load} \cdot S_{load}) \times \text{penalty}$$
- **Acuity Weights:**
  - ESI 1: ETA 45%, Specialty 30%, Beds 20%, Crowding 5%
  - ESI 2: ETA 35%, Specialty 35%, Beds 20%, Crowding 10%
  - ESI 3-5: ETA 25%, Specialty 25%, Beds 25%, Crowding 25%
- **Fallback Rules:**
  - Handles zero-bed hospitals with required specialty
  - Relaxes missing specialty criteria if zero centers qualify
  - Recommends Nearest Stabilization Emergency Department when ESI 1 ETA $> 20$ min.

### 3. Navigation & Arrival Triggers (`src/routing.js`)
- **Arrival Triggers:**
  - `APPROACHING`: Distance $\le 500\text{ m}$ or ETA $\le 120\text{ s}$.
  - `ARRIVED`: Distance $\le 50\text{ m}$ to ED entrance and speed $< 3\text{ m/s}$.
  - `ANTI-FLAPPING REROUTING`: Switches routes only if alternate route is $\ge 60\text{ s}$ or $\ge 10\%$ faster.

---

## API Endpoints (`src/server.js`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Clinician login & role token generation |
| `GET` | `/api/v1/hospitals` | List hospitals with live bed counts & capabilities |
| `GET` | `/api/v1/hospitals/:id/incoming` | Active incoming pre-alerts for hospital ED |
| `PUT` | `/api/v1/hospitals/:id/beds` | Real-time bed availability updater |
| `POST` | `/api/v1/incidents` | Create emergency incident |
| `POST` | `/api/v1/incidents/:id/intake` | Save paramedic clinical intake & calculate scores |
| `POST` | `/api/v1/incidents/:id/vitals` | Append vitals reading with live ED broadcast |
| `POST` | `/api/v1/recommendations` | Get ranked hospital recommendations |
| `POST` | `/api/v1/incidents/:id/select-hospital` | Select destination hospital & dispatch ED pre-alert |
| `POST` | `/api/v1/incidents/:id/ack` | Hospital staff acknowledges incoming patient |
| `POST` | `/api/v1/incidents/:id/assign-bed` | Pre-assigns ICU/Trauma bed |
| `POST` | `/api/v1/incidents/:id/arrive` | Mark ambulance arrival & handover |
| `GET` | `/api/v1/navigation/route` | Turn-by-turn maneuvers & polyline |
| `GET` | `/api/v1/events` | Server-Sent Events / realtime alert channel |

---

## Running Backend & Tests

```bash
# Start API Server
node src/server.js

# Run Automated Unit Tests
node tests/run_tests.js

# Run GPS Route Simulator
node src/simulate_ambulance.js
```
