# Triage Relay: System Specifications & Architecture Documentation

This directory contains the foundational specifications, clinical algorithms, and API contracts for the **Emergency Trauma Dispatch & Smart Hospital Matching Platform**.

---

## Specification Index

| Document | Title | Purpose & Scope |
|---|---|---|
| [`01_PROJECT_OVERVIEW.md`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/docs/01_PROJECT_OVERVIEW.md) | Project Overview | Problem statement, end-to-end workflow, user roles, recommended monorepo layout, and definition of done. |
| [`02_PARAMEDIC_INTAKE_MODULE.md`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/docs/02_PARAMEDIC_INTAKE_MODULE.md) | Paramedic Intake Module | Mobile-first UX, form validation, GCS/RTS formulas, ESI suggestion rules, offline sync queue. |
| [`03_RECOMMENDATION_ENGINE.md`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/docs/03_RECOMMENDATION_ENGINE.md) | Recommendation Engine | Capability tags, requirement derivation map, 0-100 scoring formulas, weights by acuity, fallback rules. |
| [`04_ER_DASHBOARD_MODULE.md`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/docs/04_ER_DASHBOARD_MODULE.md) | ER Pre-Alert Dashboard | Wall/desktop layout, incoming queue, live vitals dossier, audio/visual alerts, WebSocket event contracts. |
| [`05_NAVIGATION_MODULE.md`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/docs/05_NAVIGATION_MODULE.md) | Navigation & Live Telemetry | RoutingProvider abstraction, anti-flapping traffic rerouting, arrival geofence triggers (50m/500m), GPS simulator. |
| [`06_DATABASE_AND_API_SCHEMA.md`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/docs/06_DATABASE_AND_API_SCHEMA.md) | Database & API Schema | PostgreSQL 16 + PostGIS SQL schema, REST endpoints, access control matrix, seed data requirements. |

---

## Implementation Cross-Reference

- The PostgreSQL schema and seed data are implemented in the [`dataset/`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/dataset) folder.
- The scoring engine, routing provider, clinical calculators, and API server are implemented in the [`backend/`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/backend) folder.
- The paramedic intake, recommendation ranking, ER dashboard, and navigation views are implemented in the [`frontend/`](file:///c:/Users/spars/OneDrive/Desktop/traige%20relay/frontend) folder.
