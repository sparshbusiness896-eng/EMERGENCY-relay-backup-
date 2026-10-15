# File: 02_PARAMEDIC_INTAKE_MODULE.md

# Paramedic Intake Module

Route: `/paramedic/incidents/[incidentId]/intake` (mobile-first PWA). Role: `PARAMEDIC`.

## 1. UX Principles
- One-handed, gloved use: min 48 px targets, big steppers/segmented buttons instead of free typing.
- Fastest path first: only **Vitals + Trauma Type + Acuity** are required to get recommendations. Patient demographics are optional and can be filled later.
- Auto-save every change locally (debounced 500 ms). Never lose data.
- Critical-patient shortcut: a red **"CRITICAL - Get Recommendations Now"** button is always visible once minimum fields exist.
- Dark and high-contrast themes; no hover-only interactions.

## 2. Screen Structure (single scrolling page with sticky header/footer)
```
┌ Sticky header: Incident #, ambulance, timer since pickup, online/offline badge ┐
│ 1. Patient (optional): age, sex, approx. weight, name/unknown               │
│ 2. Vitals: BP, HR, RR, SpO2, Temp, Glucose, GCS                              │
│ 3. Trauma / Condition type (multi-select chips)                              │
│ 4. Acuity: auto-calculated ESI suggestion + RTS + manual override           │
│ 5. Notes + Mechanism of injury                                               │
└ Sticky footer: [Save Draft]  [Get Hospital Recommendations ▶]               ┘
```

## 3. Form Fields & Validation (Zod)
| Field | Type | Required | Rules |
|---|---|---|---|
| `patient.ageYears` | int | Yes (estimate allowed) | 0-120; `< 16` sets `isPediatric = true` |
| `patient.sex` | enum `MALE/FEMALE/OTHER/UNKNOWN` | No | |
| `patient.name` | string | No | default "Unknown" |
| `vitals.sbp` | int mmHg | Yes | 0-300 (0 allowed = no pulse/BP) |
| `vitals.dbp` | int mmHg | No | 0-200, must be <= sbp |
| `vitals.heartRate` | int bpm | Yes | 0-300 |
| `vitals.respiratoryRate` | int /min | Yes | 0-80 |
| `vitals.spo2` | int % | Yes | 0-100 |
| `vitals.temperatureC` | number | No | 25-45 |
| `vitals.glucoseMgDl` | int | No | 10-800 |
| `gcs.eye` | int | Yes | 1-4 |
| `gcs.verbal` | int | Yes | 1-5 |
| `gcs.motor` | int | Yes | 1-6 |
| `traumaTypes` | array of enum | Yes (min 1) | see section 4 |
| `mechanism` | string | No | max 300 chars |
| `acuity.esiLevel` | int 1-5 | Yes | auto-suggested, editable |
| `notes` | string | No | max 1000 chars |

Soft warnings (do not block submission): SpO2 < 90, SBP < 90, HR > 130 or < 50, GCS <= 8, RR < 10 or > 29. Show an amber/red inline badge. Hard-error only for out-of-range values.

## 4. Trauma / Condition Types (multi-select chips)
```ts
export const TraumaType = [
  'HEAD_INJURY', 'SPINAL_INJURY', 'CHEST_TRAUMA', 'ABDOMINAL_TRAUMA',
  'PELVIC_FRACTURE', 'LIMB_FRACTURE', 'AMPUTATION', 'BURNS',
  'PENETRATING_INJURY', 'MAJOR_BLEEDING', 'CARDIAC_STEMI_SUSPECTED',
  'STROKE_SUSPECTED', 'RESPIRATORY_DISTRESS', 'DROWNING', 'POISONING',
  'OBSTETRIC_EMERGENCY', 'OTHER'
] as const;
```
These map to required hospital capabilities in file 03 (section 4).

## 5. Triage Calculators (implement in `/packages/shared/triage.ts`, with unit tests)

### 5.1 GCS
`gcsTotal = eye + verbal + motor` (3-15).

### 5.2 RTS (Revised Trauma Score)
Coded values per parameter:

| GCS | code | SBP (mmHg) | code | RR (/min) | code |
|---|---|---|---|---|---|
| 13-15 | 4 | > 89 | 4 | 10-29 | 4 |
| 9-12 | 3 | 76-89 | 3 | > 29 | 3 |
| 6-8 | 2 | 50-75 | 2 | 6-9 | 2 |
| 4-5 | 1 | 1-49 | 1 | 1-5 | 1 |
| 3 | 0 | 0 | 0 | 0 | 0 |

- `rtsTriage = gcsCode + sbpCode + rrCode` (0-12). Score <= 11 suggests transfer to a trauma center.
- `rtsWeighted = 0.9368*gcsCode + 0.7326*sbpCode + 0.2908*rrCode` (0-7.8408).

### 5.3 ESI suggestion (decision-support only, always editable)
Implement as a simple rule helper:
- Suggest **ESI 1** if: SBP = 0 or HR = 0, or GCS <= 8, or SpO2 < 85, or RR < 6, or active major bleeding with SBP < 90.
- Suggest **ESI 2** if: GCS 9-12, SpO2 85-89, SBP 90-100 with HR > 120, RTS triage <= 10, or any of STEMI/stroke suspected, amputation, penetrating chest/abdomen.
- Otherwise suggest **ESI 3** (paramedic may lower to 4-5 manually).
Display: "Suggested ESI 2 (reason: GCS 11, SpO2 87)". The paramedic's chosen value is stored as `esiLevel`; the suggestion is stored as `esiSuggested`.

> Clinicians must validate these thresholds before production use.

## 6. State Management
```ts
// Zustand store: useIntakeStore
interface IntakeState {
  incidentId: string;
  draft: IntakeDraft;          // all form fields
  syncStatus: 'SYNCED' | 'PENDING' | 'OFFLINE' | 'ERROR';
  derived: { gcsTotal: number; rtsTriage: number; rtsWeighted: number; esiSuggested: 1|2|3|4|5 };
  setField(path: string, value: unknown): void;   // recalculates derived
  saveDraft(): Promise<void>;
  submit(): Promise<RecommendationResponse>;
}
```
- Use React Hook Form with `zodResolver`; mirror values to the Zustand store.
- `derived` recalculates on every vitals/GCS change.

## 7. Offline-First Behavior
1. All drafts persist in IndexedDB (`intake_drafts` store) keyed by `incidentId`.
2. `submit()` offline: store a job in `outbox` store `{ id, endpoint, payload, createdAt, attempts }`, show "Saved offline - will send when connected".
3. Background sync: Workbox Background Sync plus a `window.online` listener flush the outbox in order, with exponential backoff (2 s, 4 s, 8 s ... max 60 s).
4. **Offline recommendation fallback:** cache the last-fetched hospital list (with specialties and last-known beds) in IndexedDB. If offline, compute a local ranking using the same scoring package (`/packages/shared/scoring.ts`), using straight-line distance, and label the result **"Offline estimate - bed data may be outdated"**.
5. Conflict rule: server copy wins on `PATCH` conflicts except `vitals` entries, which are append-only (every entry has a timestamp).
6. Show a persistent badge: Online / Offline / Syncing (n pending).

## 8. Vitals Updates During Transport
- Paramedic can tap **"Update Vitals"** at any time. Each update is a new `vitals_readings` row (append-only) with a timestamp.
- Updated vitals are pushed live to the ED dashboard (file 04) via WebSocket.
- If an update raises acuity (for example ESI 3 -> 2), show a prompt: "Re-check hospital recommendations?".

## 9. API Calls Used
- `POST /api/v1/incidents/:id/intake` - save/update intake (see file 06).
- `POST /api/v1/incidents/:id/vitals` - add a vitals reading.
- `POST /api/v1/recommendations` - get ranked hospitals (file 03).

## 10. Components to Generate
`IntakeForm`, `VitalsGrid`, `NumberStepperInput`, `GcsSelector` (three segmented rows), `TraumaChips`, `AcuityPanel`, `SyncBadge`, `OfflineBanner`, `CriticalCTA`.

## 11. Acceptance Criteria
- Complete intake with minimum fields in under 60 seconds on a phone.
- Airplane-mode test: fill the form, submit, restore network, data reaches the server exactly once.
- RTS/GCS calculators pass unit tests with all boundary values in the table above.
- Out-of-range values are rejected with clear inline messages; soft warnings never block submission.
