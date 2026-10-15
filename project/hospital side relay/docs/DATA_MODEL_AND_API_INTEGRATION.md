# Data Model and API Integration

> **IMPORTANT: This is a PROPOSED contract. It is NOT an existing API.**
> The existing paramedic website's stack, APIs, authentication, and fields are **unknown**. Everything below is a starting proposal for the implementation team to confirm with the project owner and adapt to the paramedic website. No technology, database type, or protocol is assumed.

## 1. Conventions (proposed)

- Identifiers are opaque strings (for example UUIDs).
- Times are in UTC ISO 8601 format (for example `2026-10-08T09:30:00Z`).
- The server assigns times for received, acknowledged, and updated events.
- Every message that creates or changes data carries a unique **idempotency key** or case ID, so retries never create duplicates.
- Fields marked *optional* may be absent. The portal must handle missing fields.
- Patient identifiers are optional and minimized (see `SECURITY_AND_PRIVACY.md`).

## 2. Entities

### 2.1 Hospital
| Field | Type | Notes |
|---|---|---|
| id | string | Used by the paramedic website to select the hospital. |
| name | string | |
| address (street, city, region, postal code, country) | strings | |
| phone | string | |
| email | string | |
| location (latitude, longitude) | numbers | |
| emergency_department_24_7 | boolean | |
| verification_status | enum | `DRAFT`, `PENDING`, `INFO_NEEDED`, `APPROVED`, `REJECTED`, `SUSPENDED` |
| verified_at, verified_by | time, string | |
| time_zone | string | |
| created_at, updated_at | time | |

### 2.2 User (Hospital Staff)
| Field | Type | Notes |
|---|---|---|
| id | string | |
| hospital_id | string | |
| full_name, email, phone | strings | |
| role | enum | `ADMIN`, `EMERGENCY_STAFF`, `CAPACITY_COORDINATOR`, `VIEWER_AUDITOR` |
| status | enum | `INVITED`, `ACTIVE`, `DEACTIVATED` |
| second_factor_enabled | boolean | |
| last_sign_in_at | time | |
| created_at | time | |

### 2.3 Department
| Field | Type | Notes |
|---|---|---|
| id, hospital_id | strings | |
| name | string | For example "Cardiology". |
| is_emergency_service | boolean | |
| notes | string | optional |

### 2.4 Capacity Snapshot
Each update creates a new snapshot. The latest snapshot is "current".

| Field | Type | Notes |
|---|---|---|
| id, hospital_id | strings | |
| total_beds | integer | |
| available_beds | integer | |
| occupied_beds | integer | |
| icu_beds_vacant | integer | |
| operating_theaters_available | integer | |
| by_department | list | optional, with `department_id`, `available_beds`, `occupied_beds` |
| recorded_at | time | Server time. |
| recorded_by_user_id | string | |
| confirmed_without_change | boolean | True when staff used "Confirm still accurate". |

### 2.5 Emergency Resource
| Field | Type | Notes |
|---|---|---|
| id, hospital_id | strings | |
| category | enum | `SPECIALIST`, `TEAM`, `EQUIPMENT`, `BLOOD_PRODUCT`, `OTHER` |
| name | string | For example "Trauma surgeon", "CT scanner", "O-negative blood". |
| quantity_available | integer | optional |
| is_available | boolean | |
| notes | string | optional |
| updated_at, updated_by_user_id | time, string | |

### 2.6 Case
| Field | Type | Notes |
|---|---|---|
| id | string | Created by the paramedic website (the `case_id`). |
| hospital_id | string | Selected hospital. |
| submitted_at | time | By the paramedic website. |
| received_at | time | By the portal server. |
| priority | enum | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `UNSPECIFIED` |
| emergency_type | string | |
| patient_condition_summary | string | |
| patient (age, age_group, sex, optional identifier) | object | Minimized. |
| vital_signs | list | Each with `type`, `value`, `unit`, `measured_at`. |
| notes | string | |
| treatment_given | string | optional |
| paramedic (unit id, name or code, callback phone) | object | |
| eta | time | Estimated arrival. |
| eta_updated_at | time | |
| version | integer | Increases when the paramedic updates the case. |
| delivery_state | enum | `DELIVERING`, `DELIVERED`, `DELIVERY_FAILED`, `CANCELLED` |
| response_status | enum | `NEW`, `RECEIVED`, `PREPARING`, `READY`, `UNABLE_TO_RECEIVE`, `PATIENT_ARRIVED`, `HANDOVER_COMPLETE` |
| closed_at | time | optional |

### 2.7 Alert
The notification record created for staff for each case event.

| Field | Type | Notes |
|---|---|---|
| id, case_id, hospital_id | strings | |
| type | enum | `NEW_CASE`, `CASE_UPDATED`, `CASE_CANCELLED`, `UNACKNOWLEDGED_ESCALATION`, `DELIVERY_PROBLEM` |
| created_at | time | |
| read_by | list | users and times |

### 2.8 Acknowledgment
| Field | Type | Notes |
|---|---|---|
| id, case_id, hospital_id | strings | |
| acknowledged_by_user_id | string | |
| acknowledged_at | time | Server time. |
| delivered_to_paramedic_site | boolean | |
| delivered_at | time | optional |

### 2.9 Status Update
| Field | Type | Notes |
|---|---|---|
| id, case_id, hospital_id | strings | |
| status | enum | The `response_status` values. |
| reason_code | enum | Required for `UNABLE_TO_RECEIVE`: `NO_CAPACITY`, `RESOURCE_UNAVAILABLE`, `DIVERSION`, `OTHER` |
| reason_note | string | optional |
| resources_requested | list | Each with `type`, `detail`, `status`. |
| instruction_to_paramedic | string | optional |
| updated_by_user_id | string | |
| updated_at | time | |
| delivery_state | enum | `PENDING`, `DELIVERED`, `FAILED` |
| delivery_attempts | integer | |

### 2.10 Audit Log Entry
| Field | Type | Notes |
|---|---|---|
| id, hospital_id | strings | |
| user_id, role | string, enum | |
| action | string | For example `CASE_VIEWED`, `STATUS_CHANGED`, `CAPACITY_UPDATED`, `LOGIN_FAILED`. |
| target_type, target_id | strings | |
| details | object | No unnecessary patient data. |
| outcome | enum | `SUCCESS`, `DENIED`, `ERROR` |
| ip_address, device | strings | |
| occurred_at | time | |

## 3. Data Exchange Between the Two Websites (proposed)

```
 Paramedic website                         Hospital portal
 ─────────────────                         ───────────────
 1. GET hospital list (verified only) ───▶ returns id, name, location,
                                           capacity summary + last updated
 2. POST new case (hospital_id) ────────▶ validates, stores, assigns received_at
                                  ◀──────  3. server acknowledgment (delivered)
                                           4. live alert to hospital dashboard
                                           5. staff acknowledge / update
 6. status update, ack, instructions ◀───  pushed to paramedic site
 7. paramedic updates or cancels case ──▶ portal updates case, alerts staff
```

### 3.1 Proposed Operations

| # | Direction | Operation | Purpose |
|---|---|---|---|
| 1 | Paramedic → Portal | List hospitals | Retrieve verified hospitals with capacity summary and `last_updated`. |
| 2 | Paramedic → Portal | Submit case | Send a new case to a selected hospital. |
| 3 | Portal → Paramedic | Server acknowledgment | Immediate response to submit: the case is stored. |
| 4 | Paramedic → Portal | Update case | New vitals, ETA, or notes. Carries the case `version`. |
| 5 | Paramedic → Portal | Cancel or redirect case | Case no longer going to this hospital. |
| 6 | Portal → Paramedic | Send hospital response | Acknowledgment, status, resources requested, instruction. |
| 7 | Paramedic → Portal | Confirm receipt of response | So the portal knows the paramedic site has it. |
| 8 | Either | Health check or heartbeat | To show connection status. |

How each operation travels (request-response, push, streaming, or a message queue) is an **open integration question**.

### 3.2 Reliability Rules (confirmed requirements)
1. The portal server returns a **server acknowledgment** for every received case. The paramedic site must treat a case as delivered only after this acknowledgment.
2. If there is no acknowledgment, the paramedic site shows `DELIVERY_FAILED` and a **retry** action. Retries reuse the same `case_id` so the portal can detect duplicates.
3. Hospital responses must also be confirmed. If not, the portal shows the failure and retries.
4. A case stored on the server but not yet displayed (dashboard offline) must appear when the dashboard reconnects.

### 3.3 Authentication Between Sites (open question)
The method (for example signed requests, tokens) is not decided. Requirements: both sites authenticate each other; messages cannot be forged or read by third parties; credentials are rotated and revocable.

## 4. Example Payloads (proposed, fictional data)

### 4.1 Paramedic-Submitted Case

```json
{
  "case_id": "case_7f3a91c2",
  "idempotency_key": "case_7f3a91c2-submit-1",
  "version": 1,
  "submitted_at": "2026-10-08T09:30:00Z",
  "hospital_id": "hosp_2b84d1",
  "priority": "CRITICAL",
  "emergency_type": "Road traffic collision",
  "patient_condition_summary": "Adult male, conscious but confused, suspected chest and leg injuries",
  "patient": {
    "age": 42,
    "sex": "male",
    "identifier": null
  },
  "vital_signs": [
    { "type": "heart_rate", "value": 118, "unit": "bpm", "measured_at": "2026-10-08T09:27:00Z" },
    { "type": "blood_pressure", "value": "92/58", "unit": "mmHg", "measured_at": "2026-10-08T09:27:00Z" },
    { "type": "oxygen_saturation", "value": 93, "unit": "%", "measured_at": "2026-10-08T09:27:00Z" },
    { "type": "respiratory_rate", "value": 24, "unit": "breaths/min", "measured_at": "2026-10-08T09:27:00Z" }
  ],
  "notes": "Driver of car, front-end impact, extricated by fire service. IV access established.",
  "treatment_given": "Oxygen by mask, IV fluids started",
  "paramedic": {
    "unit_id": "AMB-14",
    "name_or_code": "Paramedic A. Khan (sample)",
    "callback_phone": "+00-555-0100"
  },
  "eta": "2026-10-08T09:44:00Z"
}
```

### 4.2 Server Acknowledgment (portal to paramedic site)

```json
{
  "case_id": "case_7f3a91c2",
  "delivery_state": "DELIVERED",
  "received_at": "2026-10-08T09:30:02Z",
  "hospital_id": "hosp_2b84d1",
  "duplicate": false
}
```

### 4.3 Failed Delivery (example error response)

```json
{
  "case_id": "case_7f3a91c2",
  "delivery_state": "DELIVERY_FAILED",
  "error_code": "HOSPITAL_NOT_ACTIVE",
  "message": "The selected hospital cannot currently receive cases. Please select another hospital.",
  "retryable": false
}
```

### 4.4 Hospital Response: Acknowledgment

```json
{
  "case_id": "case_7f3a91c2",
  "hospital_id": "hosp_2b84d1",
  "response_id": "resp_001",
  "status": "RECEIVED",
  "updated_at": "2026-10-08T09:30:41Z",
  "updated_by": { "display_name": "Charge Nurse (ED)", "role": "EMERGENCY_STAFF" },
  "message_to_paramedic": "Alert received. Preparing team."
}
```

### 4.5 Hospital Response: Ready With Resources and Instructions

```json
{
  "case_id": "case_7f3a91c2",
  "hospital_id": "hosp_2b84d1",
  "response_id": "resp_002",
  "status": "READY",
  "updated_at": "2026-10-08T09:36:10Z",
  "updated_by": { "display_name": "Dr. R. Menon (sample)", "role": "EMERGENCY_STAFF" },
  "resources_requested": [
    { "type": "TRAUMA_TEAM", "detail": "Activated", "status": "READY" },
    { "type": "OPERATING_THEATER", "detail": "Theater 2", "status": "PREPARING" },
    { "type": "BLOOD_PRODUCT", "detail": "O-negative, 4 units", "status": "READY" },
    { "type": "SPECIALIST", "detail": "Orthopedic surgeon", "status": "NOTIFIED" }
  ],
  "message_to_paramedic": "Use trauma entrance, bay 2. Team will meet you at the door.",
  "disclaimer": "Hospital reports it is preparing to receive. This is not a guarantee of acceptance."
}
```

### 4.6 Hospital Response: Unable to Receive

```json
{
  "case_id": "case_7f3a91c2",
  "hospital_id": "hosp_2b84d1",
  "response_id": "resp_003",
  "status": "UNABLE_TO_RECEIVE",
  "reason_code": "RESOURCE_UNAVAILABLE",
  "reason_note": "Trauma theater not available for the next 30 minutes.",
  "updated_at": "2026-10-08T09:33:15Z",
  "updated_by": { "display_name": "Charge Nurse (ED)", "role": "EMERGENCY_STAFF" },
  "message_to_paramedic": "Please redirect to another hospital."
}
```

### 4.7 Hospital List Item (for the paramedic site's hospital picker)

```json
{
  "hospital_id": "hosp_2b84d1",
  "name": "Riverside General Hospital (sample)",
  "location": { "latitude": 0.0, "longitude": 0.0 },
  "verification_status": "APPROVED",
  "services": ["Emergency", "Trauma", "Cardiology", "Neurology"],
  "capacity_summary": {
    "available_beds": 12,
    "icu_beds_vacant": 2,
    "operating_theaters_available": 1,
    "last_updated": "2026-10-08T09:10:00Z",
    "updated_by": "Capacity Coordinator",
    "is_stale": false
  },
  "capacity_notice": "Capacity is a guide only and is not a guarantee of acceptance."
}
```

### 4.8 Case Cancelled by Paramedic

```json
{
  "case_id": "case_7f3a91c2",
  "hospital_id": "hosp_2b84d1",
  "event": "CANCELLED",
  "cancelled_at": "2026-10-08T09:35:00Z",
  "reason": "Redirected to another hospital"
}
```

## 5. Integration Assumptions and Questions

**Assumptions**
1. The paramedic website can be modified to call the proposed operations.
2. Each case has a unique `case_id` created on the paramedic website.
3. The paramedic website needs only the hospital's `hospital_id`, name, location, and a minimized capacity summary.
4. Patient identity details are optional and minimized.

**Questions**
1. What is the paramedic website's stack and does it have a backend and API?
2. What case fields does it already collect? How do they map to this contract?
3. How will real-time delivery work in both directions?
4. How will the sites authenticate to each other?
5. Where does the hospital list come from and how often does it refresh?
6. Can one case go to more than one hospital?
7. Which timestamps and time zones does the paramedic site use?
8. How are paramedic identities shown to hospitals?
9. Is there an existing test or staging environment for both sites?
