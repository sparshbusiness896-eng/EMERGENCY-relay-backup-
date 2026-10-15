# Hospital Emergency Coordination Portal & Paramedic Relay

A web application and emergency relay system for hospitals to receive live emergency cases from paramedic crews, acknowledge alerts, coordinate hospital resource preparation, and exchange bidirectional updates in real-time.

---

## 📁 Repository Organization

The repository has been neatly organized into dedicated directories:

```
hospital-side-relay/
├── backend/                  # Node.js / Express Server & Relay Engine
│   ├── src/
│   │   ├── routes/           # Cases, Capacity, Resources, Staff, Audit, Events, Simulator
│   │   ├── store/            # Reactive state management with SSE broadcasting
│   │   └── server.js         # HTTP, REST API, SSE & static frontend server
│   ├── package.json
│   └── README.md
│
├── frontend/                 # Professional White & Red Medical Web Portal
│   ├── css/
│   │   ├── theme.css         # Clinical White & Red tokens, typography, animations
│   │   ├── layout.css        # Top bar, command header, 2/3 + 1/3 responsive grid
│   │   ├── components.css    # Emergency alert cards, vitals chips, capacity progress bars
│   │   └── views.css         # Triage modal, capacity management, audit & simulator styles
│   ├── js/
│   │   ├── audio.js          # Web Audio emergency alert synthesizer (zero audio assets needed)
│   │   ├── api.js            # REST client & Server-Sent Events (SSE) stream listener
│   │   ├── state.js          # Global reactive application store
│   │   ├── components/       # Alert cards, case modals, capacity widgets
│   │   ├── views/            # Dashboard, Capacity, Archive, Staff, Profile, Audit, Simulator
│   │   └── app.js            # Main application bootstrap & live ticking clock/ETA loop
│   ├── index.html            # Single Page Application
│   └── README.md
│
├── data-set/                 # Standardized Schemas & Fictional Seed Data
│   ├── schemas/              # JSON Schemas (hospital, case, capacity, audit)
│   ├── seed/                 # Realistic seed data (cases, capacity, specialists, staff, templates)
│   ├── index.js              # Dataset loader and accessor module
│   └── README.md
│
├── docs/                     # Specifications & Design Documentation
│   ├── PRODUCT_REQUIREMENTS.md
│   ├── DASHBOARD_AND_UI_SPEC.md
│   ├── DATA_MODEL_AND_API_INTEGRATION.md
│   ├── PAGES_AND_NAVIGATION.md
│   ├── SECURITY_AND_PRIVACY.md
│   ├── USER_FLOWS.md
│   └── ACCEPTANCE_CRITERIA.md
│
├── package.json              # Unified root scripts
└── README.md                 # This overview document
```

---

## 🎨 Theme: Professional White & Red Medical Design

The user interface follows a clinical **White and Red** theme:
- **Clinical Pearl White Surfaces** (`#FFFFFF`, `#F8FAFC`, `#F1F5F9`) with crisp borders and subtle elevations.
- **Emergency Crimson Accents** (`#DC2626`, `#B91C1C`, `#991B1B`) highlighting urgent notifications, active relays, and trauma metrics.
- **Pulsing Emergency Alert Rings** around unacknowledged `CRITICAL` cases to capture immediate clinical focus.
- **Web Audio Alert Synthesizer** generating authentic two-tone emergency chimes with volume/mute controls.
- **WCAG 2.1 AA Compliant** high-contrast text (`#0F172A`, `#334155`) ensuring readability under emergency hospital conditions.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18+)

### 2. Launch the Application
From the project root:
```bash
npm start
```
Or directly from the `backend/` folder:
```bash
cd backend
npm install
npm start
```

### 3. Open in Browser
Open **[http://localhost:4000](http://localhost:4000)** to view the live portal.

---

## ⚡ Key Capabilities

1. **Live Emergency Dashboard**:
   - High-visibility alert cards displaying emergency type, patient summary, vital signs strip, ambulance unit ID, and live ticking countdown ETA.
   - 1-Click alert acknowledgment (`NEW` → `RECEIVED`).
   - Real-time capacity sidebar showing available beds, vacant ICU beds, operating theaters, and on-duty specialists.
2. **Case Detail & Response Modal**:
   - Full pre-hospital triage review, vital signs grid, and paramedic field notes.
   - Status updates (`PREPARING`, `READY`, `UNABLE_TO_RECEIVE` with required diversion reason code, `PATIENT_ARRIVED`, `HANDOVER_COMPLETE`).
   - Quick-select response instructions dispatched back to the ambulance crew.
3. **Capacity & Resource Management**:
   - Ward and department bed breakdowns.
   - Equipment availability (CT Scanners, MRI, Ventilators, ECMO).
   - Uncrossmatched emergency blood bank inventory (O-Negative, O-Positive, FFP, Platelets).
   - Capacity freshness tracker with "Confirm Still Accurate" reset button.
4. **Interactive Paramedic Dispatch Simulator**:
   - Allows hospital staff and evaluators to inject live ambulance transmissions on demand (Multi-Vehicle Rollover, Acute STEMI, Code Stroke, Pediatric Status Epilepticus) to experience real-time alert popups, audio synthesis, and server acknowledgments.
5. **Security & Audit Compliance**:
   - Append-only audit logs tracking all case views, acknowledgments, status transitions, and capacity edits.
   - Multi-role support (Admin, Emergency Staff, Bed Coordinator, Viewer/Auditor) with live switcher.
