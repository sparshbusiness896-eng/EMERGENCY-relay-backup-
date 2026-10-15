# Hospital Emergency Coordination - Frontend Portal

A medical-grade, high-reliability emergency coordination portal designed for hospital trauma triage and pre-hospital coordination.

## Visual Design & Theme System

- **Aesthetic**: Modern clinical white and red command center ("White and Red Professionally").
- **Palette**:
  - Crisp clinical backgrounds (`#FFFFFF`, `#F8FAFC`, `#F1F5F9`)
  - Primary Emergency Red (`#DC2626`, `#B91C1C`, `#991B1B`)
  - Status indicators for triage states (`NEW`, `RECEIVED`, `PREPARING`, `READY`, `UNABLE_TO_RECEIVE`, `PATIENT_ARRIVED`, `HANDOVER_COMPLETE`)
  - Subtle red glow and pulsing animations for `NEW` unacknowledged critical emergencies
- **Typography**: `Plus Jakarta Sans` with `JetBrains Mono` for live numerical telemetry and ETA timers.

## Features & Views

1. **Live Emergency Dashboard (`/dashboard`)**:
   - 2/3 active emergency alert feed sorted by priority and ETA countdown
   - 1/3 capacity and resource sidebar showing beds, ICU, theaters, and on-duty specialists
   - Ticking real-time countdown timer on every active case card
   - Fast 1-click alert acknowledgment
2. **Case Detail & Response Modal (`/cases/:id`)**:
   - Full pre-hospital vitals grid (Heart rate, Blood pressure, SpO2, Respiratory rate, GCS)
   - Status transition controls with mandatory diversion reason codes
   - Quick-response instruction templates for ambulance dispatch
   - Complete clinical audit timeline
3. **Capacity & Emergency Resources (`/capacity`)**:
   - Department and ward bed allocation table
   - ICU beds, trauma bays, operating rooms
   - Critical diagnostic equipment (CT scanners, MRI, Ventilators, ECMO)
   - Emergency blood bank inventory
   - Staleness detection with "Confirm Still Accurate" reset
4. **Alert History & Archives (`/alerts`)**:
   - Closed and diverted transport records with outcome tracking
5. **Staff & Permissions (`/staff`)**:
   - Role-based permissions matrix (Admin, Emergency Staff, Coordinator, Auditor)
   - Clinician invitation modal
6. **Hospital Profile (`/profile`)**:
   - Trauma designation credentials, verified status badge, emergency contact
7. **Compliance Audit Trail (`/audit`)**:
   - Append-only security logging of all case accesses and updates
8. **Paramedic Relay Simulator (`/simulator`)**:
   - Interactive testing suite to inject live cases (Multi-Trauma, Cardiac Arrest, Code Stroke, Pediatric)
   - Demonstrates immediate live alerting, audio synthesis, and server-side acknowledgment!

## Audio Alerts

Built-in Web Audio API synthesizer generates high-priority medical chimes with no external sound files required. Includes mute toggle and sound test.
