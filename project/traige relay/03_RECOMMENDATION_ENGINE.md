# File: 03_RECOMMENDATION_ENGINE.md

# Smart Hospital Recommendation Engine

Location: `/packages/shared/scoring.ts` (pure functions, shared by API and offline client) and `/apps/api/src/modules/recommendations`.

> All weights, thresholds and specialty mappings below are **configurable defaults** stored in `recommendation_config` (see file 06) and must be clinically validated. The engine ranks; the paramedic chooses.

## 1. Pipeline
```
Input (incident location, patient, vitals, acuity, traumaTypes)
  1. Derive requirements   -> required + preferred capability tags, bed type needed
  2. Candidate selection   -> hospitals within radius (PostGIS), status ACTIVE
  3. Hard filters          -> remove impossible options
  4. ETA matrix            -> live traffic ETAs (Mapbox Matrix API, cached 60 s)
  5. Bed check             -> real-time availability from Redis (fallback DB)
  6. Scoring               -> weighted score 0-100
  7. Ranking + explanation -> top 5 with reasons, warnings and fallbacks
```

## 2. Hospital Capability Tags
```ts
export const Capability = [
  'ER_24X7', 'TRAUMA_CENTER_L1', 'TRAUMA_CENTER_L2', 'NEUROSURGERY',
  'CATH_LAB', 'COMPREHENSIVE_STROKE_CENTER', 'PRIMARY_STROKE_CENTER',
  'PEDIATRIC_TRAUMA', 'ORTHOPEDICS', 'BURN_UNIT', 'OBSTETRICS_EMERGENCY',
  'VASCULAR_SURGERY', 'CT_24X7', 'BLOOD_BANK', 'POISON_CENTER'
] as const;
```

## 3. Bed Types
`ER`, `ICU`, `TRAUMA`, `PEDIATRIC_ICU`, `BURN`, `OR` (operating room availability, optional). Each has `total`, `available`, `updatedAt`.

## 4. Requirement Derivation (default map; stored as config)
| Trauma/condition | Required tags | Preferred tags | Bed type |
|---|---|---|---|
| `CARDIAC_STEMI_SUSPECTED` | `CATH_LAB`, `ER_24X7` | `ICU` bed | ICU |
| `STROKE_SUSPECTED` | `CT_24X7`, (`COMPREHENSIVE_STROKE_CENTER` or `PRIMARY_STROKE_CENTER`) | `COMPREHENSIVE_STROKE_CENTER`, `NEUROSURGERY` | ICU |
| `HEAD_INJURY` with GCS <= 8 | `NEUROSURGERY`, `CT_24X7` | `TRAUMA_CENTER_L1` | ICU |
| `MAJOR_BLEEDING`, `PENETRATING_INJURY`, `PELVIC_FRACTURE`, `ABDOMINAL_TRAUMA`, `CHEST_TRAUMA` | `TRAUMA_CENTER_L1` or `TRAUMA_CENTER_L2`, `BLOOD_BANK` | `VASCULAR_SURGERY` | TRAUMA |
| `LIMB_FRACTURE`, `AMPUTATION` | `ORTHOPEDICS` | `VASCULAR_SURGERY` | ER |
| `BURNS` | `BURN_UNIT` (else `TRAUMA_CENTER_L1`) | | BURN |
| Any trauma and `isPediatric` | `PEDIATRIC_TRAUMA` | | PEDIATRIC_ICU if ESI <= 2 |
| `OBSTETRIC_EMERGENCY` | `OBSTETRICS_EMERGENCY` | | ER |
| Everything else | `ER_24X7` | | ER |

Multiple conditions: **union** of required tags (an "or" group is satisfied if any member is present). Bed type = the most demanding (ICU > TRAUMA > ER).

## 5. Hard Filters
Exclude a hospital if any is true:
1. `status` is `DIVERSION` or `CLOSED` for the needed department.
2. It lacks any **required** tag - *unless* no hospital remains (see fallbacks, section 8).
3. ETA exceeds `maxEtaMinutes` (default: ESI 1-2 = 45, ESI 3+ = 90).

## 6. Scoring (0-100)
```
score = 100 * ( wEta*S_eta + wCap*S_cap + wSpec*S_spec + wLoad*S_load ) * confidencePenalty
```
| Component | Formula |
|---|---|
| `S_eta` | `max(0, 1 - etaMin / maxEtaMinutes)` |
| `S_cap` | `0` if available = 0; else `min(1, available / 3)` for the needed bed type |
| `S_spec` | `1.0` if all required tags present; plus `0.1` per preferred tag matched, capped at 1.0 |
| `S_load` | `1 - edOccupancyPercent/100` (current ER crowding) |
| `confidencePenalty` | `1.0` if bed data < 15 min old; `0.9` if 15-60 min; `0.75` if older; `0.85` if ETA is an estimate (no live traffic) |

Default weights by acuity (sum to 1):

| Acuity | wEta | wSpec | wCap | wLoad |
|---|---|---|---|---|
| ESI 1 | 0.45 | 0.30 | 0.20 | 0.05 |
| ESI 2 | 0.35 | 0.35 | 0.20 | 0.10 |
| ESI 3-5 | 0.25 | 0.25 | 0.25 | 0.25 |

Tie-breaker: lower ETA, then more available beds.

```ts
export function scoreHospital(c: Candidate, req: Requirements, w: Weights): number {
  const sEta  = Math.max(0, 1 - c.etaMinutes / req.maxEtaMinutes);
  const sCap  = c.bedsAvailable <= 0 ? 0 : Math.min(1, c.bedsAvailable / 3);
  const sSpec = Math.min(1, (hasAllRequired(c, req) ? 1 : 0) + 0.1 * preferredMatches(c, req));
  const sLoad = 1 - c.edOccupancyPercent / 100;
  const raw = w.eta * sEta + w.cap * sCap + w.spec * sSpec + w.load * sLoad;
  return Math.round(100 * raw * confidencePenalty(c));
}
```

## 7. Data Freshness
- Hospital admins update beds via UI or `PUT /api/v1/hospitals/:id/beds`; write to Postgres and Redis (`beds:{hospitalId}`), publish on `hospital:beds` channel.
- Optional integration endpoint for hospital systems (HL7/FHIR adapter placeholder).
- Every response includes `bedsUpdatedAt` per hospital and a UI warning if stale.

## 8. Fallback Rules
Evaluated in order when the normal ranking is empty or the best option has 0 beds:
1. **Capacity full, specialty present:** still list hospitals having the required tags but 0 beds, marked `capacityWarning: "NO_BEDS_REPORTED"` and ranked after those with beds; ED may still accept (hospital must confirm on pre-alert).
2. **No hospital has all required tags:** relax to hospitals missing only **one** required tag; mark `specialtyGap: [tags]`.
3. **Critical and far (ESI 1 and best ETA > 20 min):** add `nearestStabilization` option: the nearest 24x7 ER regardless of tags, with message "Consider stabilization at nearest ED, then secondary transfer". Requires explicit paramedic confirmation.
4. **Traffic API failure:** use estimated ETA (haversine x 1.5 / 40 km/h), set `etaSource: 'ESTIMATED'`.
5. **Bed data unavailable:** treat beds as unknown (`S_cap = 0.5`), set `bedsKnown: false`.
6. **Nothing at all:** return `NO_CANDIDATES` with the dispatcher contact prompt.

## 9. API Contract
### `POST /api/v1/recommendations`
Request:
```json
{
  "incidentId": "inc_01HZX...",
  "origin": { "lat": 30.3165, "lng": 78.0322 },
  "patient": { "ageYears": 34, "isPediatric": false },
  "acuity": { "esiLevel": 2, "gcsTotal": 9, "rtsTriage": 9 },
  "traumaTypes": ["HEAD_INJURY", "MAJOR_BLEEDING"],
  "maxResults": 5
}
```
Response `200`:
```json
{
  "incidentId": "inc_01HZX...",
  "generatedAt": "2026-10-07T10:15:30Z",
  "requirements": {
    "requiredTags": ["NEUROSURGERY", "CT_24X7", "BLOOD_BANK"],
    "preferredTags": ["TRAUMA_CENTER_L1"],
    "bedType": "ICU",
    "maxEtaMinutes": 45
  },
  "recommendations": [
    {
      "rank": 1,
      "hospitalId": "hos_001",
      "name": "City Trauma Hospital",
      "score": 87,
      "etaMinutes": 11,
      "etaSource": "LIVE_TRAFFIC",
      "distanceKm": 6.2,
      "bedsAvailable": { "ICU": 2, "TRAUMA": 1, "ER": 5 },
      "bedsUpdatedAt": "2026-10-07T10:12:00Z",
      "matchedTags": ["NEUROSURGERY", "CT_24X7", "BLOOD_BANK", "TRAUMA_CENTER_L1"],
      "missingTags": [],
      "warnings": [],
      "reasons": ["Neurosurgery available", "2 ICU beds free", "Closest matching center"]
    }
  ],
  "fallbacks": { "nearestStabilization": null }
}
```
Errors: `400` validation, `401/403` auth, `422 NO_CANDIDATES`, `503` upstream failure (with partial estimated result when possible).

### `POST /api/v1/incidents/:id/override`
Used when the paramedic picks a non-top option. Body: `{ "hospitalId": "...", "reasonCode": "PATIENT_REQUEST|CLOSER|KNOWN_DIVERSION|OTHER", "note": "..." }`. Stored in audit log.

## 10. Caching & Performance
- Candidate query: PostGIS `ST_DWithin` on `hospitals.location` (default radius 50 km, widen to 100 km if fewer than 3 candidates).
- ETA matrix: one Mapbox Matrix call for up to 25 destinations; cache key `eta:{roundedOrigin}:{hospitalId}` for 60 s.
- Target p95 < 3 s end to end.

## 11. Acceptance Criteria
- Unit tests: STEMI selects only `CATH_LAB` hospitals; pediatric trauma prefers `PEDIATRIC_TRAUMA`; a hospital on diversion never appears; stale-bed penalty applied.
- Fallback tests for each rule in section 8.
- Every recommendation includes human-readable `reasons`.
