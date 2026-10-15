# Triage Relay: Frontend Clinical Web Application

This folder contains the complete, modern, responsive frontend web application for the **Triage Relay Platform**.

It implements all user interfaces defined across the specification modules:
- `02_PARAMEDIC_INTAKE_MODULE.md` (Mobile-first paramedic intake PWA)
- `03_RECOMMENDATION_ENGINE.md` (Smart hospital ranking & clinical matching)
- `04_ER_DASHBOARD_MODULE.md` (ER Pre-Alert wall/desktop dashboard)
- `05_NAVIGATION_MODULE.md` (Turn-by-turn navigation & live ambulance telemetry HUD)
- `01_PROJECT_OVERVIEW.md` (108 Dispatch fleet control room monitor)

---

## Folder Layout

```
frontend/
├── index.html       # Single-Page Application with 5 active modules
├── styles.css       # Tactical emergency medical design system (Dark Mode, High Contrast)
├── app.js           # Client state, clinical calculators, audio alarms, canvas maps
├── assets/
│   └── logo.png     # Official Triage Relay high-resolution branding logo
└── README.md        # Frontend documentation and usage guide
```

---

## Key Modules & Features

### 1. Paramedic Intake (`#paramedic`)
- **Gloved Touch Optimization:** Min 48px tactile buttons, step controls, and segmented pickers.
- **Real-Time Clinical Acuity HUD:** Automatic calculation of GCS Total (3-15), RTS Triage (0-12) with trauma center referral alerts, RTS Weighted (0-7.84), and decision-support ESI level suggestions (1-3).
- **Soft Warnings Engine:** Real-time visual alerts for hypoxia ($SpO_2 < 90\%$), hypotension ($SBP < 90\text{ mmHg}$), severe tachycardia ($HR > 130$), and neurological depression ($GCS \le 8$).
- **"CRITICAL" Shortcut:** One-tap bypass button for immediate hospital matching in extreme trauma cases.
- **Offline Draft Saving:** Local device persistence safe from cellular dropouts.

### 2. Smart Hospital Recommendations (`#recommendations`)
- **Clinical Requirement Breakdown:** Automatically derives required/preferred capability tags (Cath Lab, Stroke Center, Neurosurgery, Blood Bank, Pediatric Trauma) and bed types from condition chips.
- **Ranked Hospital Cards:** Displays Match Score (0-100), live traffic ETA, travel distance, bed counts (ER, ICU, Trauma), clinical rationale bullets, and specialty gap warnings.
- **One-Tap Pre-Alert:** Dispatches pre-alert to the selected hospital's emergency department.
- **Clinical Override Modal:** Requires mandatory justification code (`PATIENT_REQUEST`, `CLOSER`, `KNOWN_DIVERSION`) for audit compliance.

### 3. ER Pre-Alert Dashboard (`#er`)
- **Desktop & Wall Display Layout:** 3-column split view (Incoming Queue, Selected Patient Dossier, Live Radar Telemetry).
- **Audio & Visual Pre-Alert Alarm:** Web Audio API sound synthesis with repeating sirens for ESI 1 and double beeps for ESI 2.
- **Live Vitals Dossier:** Vitals cards with trend indicators, simulated 30-minute time-series ECG/BP waveforms on HTML5 canvas, and trauma resource readiness toggles (Trauma team, CT, Blood O-Neg, OR, Neurosurgeon).
- **Bed Assignment & Handover:** Immediate bed locking and arrival confirmation.

### 4. Turn-by-Turn Navigation (`#navigation`)
- **Paramedic Cockpit HUD:** Top maneuver instruction banner with distance meters and upcoming streets.
- **Interactive Canvas Map:** Renders scene origin, destination hospital with 50m arrival geofence, and animated ambulance telemetry puck.
- **Arrival Triggers:** Tests `APPROACHING` ($< 500\text{m}$) and `ARRIVED` ($< 50\text{m}$) triggers.
- **Simulate GPS Drive:** Interactive drive replay testing in-transit updates.

### 5. 108 Dispatch Fleet Monitor (`#dispatch`)
- Overview of active ambulance units (`108 Alpha`, `108 Bravo`, `108 Charlie`) and city-wide emergency department capacity.

---

## How to Run

Simply open `frontend/index.html` in any modern web browser:
- Double-click `frontend/index.html`, OR
- Serve with any static web server:
  ```bash
  # Example using python (if installed)
  python -m http.server 3000 --directory frontend

  # Or using npx serve
  npx serve frontend
  ```
Zero external build steps or bundle tools are required!
