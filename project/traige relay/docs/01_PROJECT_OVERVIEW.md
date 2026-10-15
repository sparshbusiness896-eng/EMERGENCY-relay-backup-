# File: 01_PROJECT_OVERVIEW.md

# Emergency Trauma Dispatch & Smart Hospital Matching Platform

## 1. Purpose
A web/mobile platform that takes a patient from the accident scene to the best-suited hospital as fast as possible. A paramedic enters vitals and trauma details, the system ranks hospitals, the chosen hospital's ER is pre-alerted with a live patient dashboard, and the ambulance receives live re-routed navigation.

> **Safety note for the builder:** This is clinical decision-support software. It recommends; the paramedic always decides. All scoring formulas, thresholds and specialty mappings in these files are defaults that must be reviewed and approved by qualified clinicians before real-world use. Never auto-dispatch or auto-divert without human confirmation.

## 2. End-to-End Workflow
```
[1] 108 Dispatch / Accident Scene  -> Incident created, ambulance dispatched, patient loaded
[2] Paramedic Intake               -> Vitals, trauma type, acuity (ESI / GCS / RTS)
[3] Recommendation Engine          -> Ranked hospitals (ETA, beds, specialty)
[4] Selection & ED Pre-Alert       -> Live patient dashboard pushed to destination ED
[5] Turn-by-Turn Navigation        -> Traffic re-routing + live telemetry to hospital
```

## 3. User Personas & Roles
| Role | Device | Core needs | Permissions |
|---|---|---|---|
| `PARAMEDIC` | Phone/tablet (mobile-first, gloved hands, bright sunlight) | Fast intake, clear hospital ranking, navigation | Create/update own incidents, select hospital, override recommendation with reason |
| `ER_STAFF` (doctor/nurse) | Desktop/wall display | Instant pre-alert, patient vitals, ETA, bed assignment | View incidents addressed to own hospital, acknowledge alerts, assign beds |
| `HOSPITAL_ADMIN` | Desktop | Keep bed counts, specialties, diversion status accurate | Edit own hospital's beds/specialties/status, manage ER_STAFF accounts |
| `DISPATCHER` (108 control room) | Desktop | Create incidents, assign ambulances, monitor all active cases | Read all active incidents, create/assign |
| `SYSTEM_ADMIN` | Desktop | Users, hospitals, config, audit | Full access, read audit logs |

## 4. Recommended Tech Stack (use exactly this; do not substitute)
| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS, installable as a PWA |
| State / data | Zustand (UI state), TanStack Query (server state), React Hook Form + Zod (forms) |
| Offline | Service worker (Workbox) + IndexedDB via `idb` for the intake queue |
| Backend | Node.js 20 + Fastify + TypeScript, Zod for request validation |
| Realtime | WebSocket (`ws` library via `@fastify/websocket`), Redis pub/sub for fan-out |
| Database | PostgreSQL 16 + PostGIS (geo queries), Prisma ORM (raw SQL for geo) |
| Cache | Redis (bed availability cache, ETA cache, sessions, rate limiting) |
| Maps / routing | Mapbox (Directions API with `driving-traffic` profile, Matrix API, GL JS). Google Maps is an alternative behind the same `RoutingProvider` interface |
| Auth | JWT access token (15 min) + refresh token (httpOnly cookie), role-based access control |
| Infra | Docker Compose for local dev; env-based config; GitHub Actions CI |
| Testing | Vitest (unit), Playwright (e2e), k6 (load) |

## 5. Monorepo Layout
```
/apps
  /web            # Next.js app: /paramedic, /er, /admin, /dispatch routes
  /api            # Fastify REST + WebSocket server
/packages
  /shared         # Zod schemas, TS types, scoring utils (shared by web + api)
  /routing        # RoutingProvider interface + Mapbox/Google implementations
/infra            # docker-compose.yml, db migrations, seed data
/docs             # these .md specs
```

## 6. Non-Functional Requirements
- **Latency:** recommendation response p95 < 3 s; ED pre-alert delivered < 2 s after selection; location updates every 3 s.
- **Availability:** target 99.9%. Paramedic intake must keep working with no network (see file 02).
- **Privacy & compliance:** treat all patient data as sensitive health data. Align with India's DPDP Act 2023 (and HIPAA principles where relevant): encrypt in transit (TLS) and at rest, minimal data collection, role-based access, audit log of every read/write of patient data, configurable retention (default: purge identifiable data after 90 days).
- **Audit:** append-only `audit_logs` for logins, incident views, selections, overrides.
- **Accessibility/UX:** large touch targets (min 48 px), high-contrast theme, works in portrait on a 360 px wide phone, English + Hindi i18n-ready (use `next-intl`).
- **Resilience:** if the Traffic API fails, fall back to straight-line distance x 1.5 / 40 km/h and flag the ETA as `estimated`.

## 7. Key Domain Glossary
- **ESI** Emergency Severity Index, 1 (most urgent) to 5.
- **GCS** Glasgow Coma Scale, 3-15.
- **RTS** Revised Trauma Score (uses GCS, systolic BP, respiratory rate).
- **STEMI** heart attack needing a Cath Lab.
- **ED / ER** Emergency Department.
- **Pre-alert** message sent to the ED before the patient arrives.

## 8. Build Order (for the code generator)
1. Monorepo, Docker Compose, DB schema + migrations + seed (file 06).
2. Auth + RBAC + audit logging.
3. Hospital & bed management API and admin UI.
4. Paramedic intake (file 02) with offline queue.
5. Recommendation engine (file 03).
6. Selection + ED dashboard + WebSocket alerts (file 04).
7. Navigation + live telemetry (file 05).
8. E2E tests, load tests, hardening.

## 9. Definition of Done
- All endpoints in file 06 implemented and validated with Zod.
- Seed data creates 10 sample hospitals around one city with varied specialties and beds.
- Demo flow works end to end: create incident -> intake -> recommend -> select -> ED sees alert -> navigation streams location.
- Unit tests cover scoring (file 03) and triage calculators (file 02).
