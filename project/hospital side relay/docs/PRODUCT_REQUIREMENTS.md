# Product Requirements

Legend: **[CONFIRMED]** = stated by the project owner. **[ASSUMPTION]** = proposed by the author, needs confirmation. **[QUESTION]** = open question.

## 1. Product Summary

A hospital-facing portal that lets hospitals register, publish their emergency capabilities and capacity, receive live emergency cases from the existing paramedic website, and send status updates and instructions back.

## 2. Functional Requirements

### 2.1 Account and Registration
- **FR-1 [CONFIRMED]** A hospital administrator can sign up for an account on the portal.
- **FR-2 [CONFIRMED]** The administrator can create a hospital profile with: name, address, phone number, email, and location.
- **FR-3 [CONFIRMED]** The hospital account may require verification or approval before it can receive real cases.
- **FR-4 [ASSUMPTION]** While unverified, the hospital can complete setup and use a clearly labeled **test/demo mode**, but cannot receive real cases and is not listed to paramedics as active.
- **FR-5 [CONFIRMED]** After setup, authorized staff can sign in and access the live dashboard.

### 2.2 Hospital Profile and Capabilities
- **FR-6 [CONFIRMED]** The hospital can record its departments and emergency services.
- **FR-7 [CONFIRMED]** The hospital can record: available beds, occupied beds, vacant ICU beds, available operating theaters.
- **FR-8 [CONFIRMED]** The hospital can record available specialists, teams, equipment, and other emergency resources.
- **FR-9 [CONFIRMED]** Hospital staff can update capacity and resource availability at any time.
- **FR-10 [CONFIRMED]** Every capacity/resource view shows a **last-updated time** and, where possible, **which staff member** made the change.

### 2.3 Receiving Cases
- **FR-11 [CONFIRMED]** When a paramedic submits a case and selects this hospital, it appears on that hospital's live dashboard.
- **FR-12 [CONFIRMED]** The alert shows the information the paramedic shared, such as: emergency type, patient condition, available vital signs, notes, selected hospital, and ETA.
- **FR-13 [CONFIRMED]** A case alert is **acknowledged by the server** once it is received, and delivery failures are **visible and retryable**.
- **FR-14 [ASSUMPTION]** Only staff of the selected hospital (with the right role) can see the case.
- **FR-15 [ASSUMPTION]** New alerts produce a visual indicator and an audible alert (staff can mute the sound but not the visual indicator).

### 2.4 Responding to Cases
- **FR-16 [CONFIRMED]** Hospital staff can acknowledge an alert.
- **FR-17 [CONFIRMED]** Hospital staff can set a status, including: Received, Preparing, Ready, Unable to receive, Patient arrived. (See the full status set in section 5.)
- **FR-18 [CONFIRMED]** Hospital staff can indicate required treatment or resources: trauma team, ICU bed, operating theater, specialist, equipment, blood product.
- **FR-19 [CONFIRMED]** Acknowledgments, status updates, and relevant instructions appear on the paramedic website.
- **FR-20 [ASSUMPTION]** Hospital staff can send a short free-text instruction to the paramedic, with a set of quick-select templates.
- **FR-21 [ASSUMPTION]** Choosing "Unable to receive" requires a reason, so the paramedic can redirect quickly.

### 2.5 Staff, Notifications, History
- **FR-22 [ASSUMPTION]** The administrator can invite staff, assign roles, and deactivate staff.
- **FR-23 [ASSUMPTION]** Notification preferences are configurable (sound, desktop notifications, email/SMS escalation).
- **FR-24 [ASSUMPTION]** Alert history is searchable and filterable.
- **FR-25 [CONFIRMED]** Audit history of patient-data access and changes exists (see security document).

## 3. Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-1 | Patient details are sensitive: role-based access, secure authentication, audit history, data minimization. | CONFIRMED |
| NFR-2 | Capacity data is never assumed to be perfectly current. Show last-updated time and a stale indicator. | CONFIRMED |
| NFR-3 | The portal must never state or imply that a hospital will accept a patient based only on bed counts. | CONFIRMED |
| NFR-4 | A visible notice explains that the portal supports coordination and does not replace emergency procedures or clinical judgment. | CONFIRMED |
| NFR-5 | Loading, empty, offline, failed-alert, and reconnecting states are designed and implemented. | CONFIRMED |
| NFR-6 | Server-side acknowledgment of every received case; visible, retryable delivery failures. | CONFIRMED |
| NFR-7 | No technology stack is assumed. Unknowns are flagged as integration questions. | CONFIRMED |
| NFR-8 | Alerts should appear on the dashboard quickly. Target: within 5 seconds of server receipt under normal conditions. | ASSUMPTION |
| NFR-9 | Accessible: WCAG 2.1 AA target; status never conveyed by color alone. | ASSUMPTION |
| NFR-10 | Works on current desktop browsers and tablets; usable on phones. | ASSUMPTION |
| NFR-11 | Availability target for the alerting function is high; exact figure to be decided. | QUESTION |

## 4. MVP Scope

**Included in MVP**
1. Hospital sign up, sign in, and email verification.
2. Hospital profile and onboarding (profile, departments, services, initial capacity and resources).
3. Verification / pending-approval state.
4. Live dashboard with incoming alerts and capacity widgets.
5. Incoming case detail page with acknowledgment, status updates, resource requests, and instructions to the paramedic.
6. Capacity and resources page with last-updated time and updated-by.
7. Staff and permissions (invite, roles, deactivate).
8. Alert history with search and filters.
9. Audit history.
10. Server acknowledgment, visible failures, retry, offline and reconnecting states.
11. Integration with the paramedic website using the proposed contract (or an agreed revision).

**Later phases (ideas, not confirmed)**
- Automatic capacity updates from hospital systems.
- Hospital ranking or suggestions inside the paramedic website.
- Multi-hospital groups and cross-site views.
- Pre-arrival checklist templates by emergency type.
- Analytics: response times, acceptance rates, case volumes.
- SMS or phone-call escalation for unacknowledged critical alerts.
- Multi-language support.
- Integration with hospital EMR systems.
- Mobile app or installable web app with push notifications.

## 5. Case Status Model (used everywhere)

**Hospital-set statuses** (the "Hospital Response Status"):

| Status | Meaning | Set by | Notes |
|---|---|---|---|
| `NEW` | Alert received by the portal, not yet acknowledged by a person. | System | Highlights on the dashboard. Escalates if unacknowledged too long. |
| `RECEIVED` | A staff member has seen the alert. | Staff | This is the "acknowledgment." Shows who and when. |
| `PREPARING` | The hospital is preparing resources. | Staff | |
| `READY` | The hospital reports it is ready to receive the patient. | Staff | Not a guarantee of acceptance. UI wording must not over-promise. |
| `UNABLE_TO_RECEIVE` | The hospital cannot receive this patient. | Staff | Reason is required. Paramedic is told to choose another hospital. |
| `PATIENT_ARRIVED` | The patient has arrived at the hospital. | Staff | Starts handover. |
| `HANDOVER_COMPLETE` | Handover is finished and the case is closed on the hospital side. | Staff | Case moves to history. |

**System-level delivery states** (shown separately from the response status):

| State | Meaning |
|---|---|
| `DELIVERING` | Paramedic site has sent the case; the portal has not yet confirmed. |
| `DELIVERED` | Portal server has stored the case and sent a server acknowledgment. |
| `DELIVERY_FAILED` | The case could not be delivered or confirmed. Visible and retryable. |
| `CANCELLED` | The paramedic cancelled or redirected the case. Hospital is notified. |

**Allowed transitions:** `NEW → RECEIVED → PREPARING → READY → PATIENT_ARRIVED → HANDOVER_COMPLETE`. `UNABLE_TO_RECEIVE` can be set from `NEW`, `RECEIVED`, `PREPARING`, or `READY`. `CANCELLED` can arrive at any time before `PATIENT_ARRIVED`. Staff may move a status back one step to correct a mistake, and the change is logged. [ASSUMPTION]

## 6. Assumptions (summary)

1. One hospital account maps to one hospital (a single site). Multi-site groups are later phase.
2. The paramedic website can be changed to send cases to a hospital endpoint and to show hospital updates.
3. Real-time delivery is achieved through a live connection or an equivalent, chosen by the implementation team.
4. Hospital selection on the paramedic website uses a hospital identifier issued by this portal.
5. Only verified hospitals appear as selectable in the paramedic website.

## 7. Open Questions / Integration Questions

1. What technology stack and hosting does the paramedic website use?
2. Does the paramedic website have a backend, API, or user authentication today? How are paramedics authenticated?
3. What fields does the paramedic website currently collect in an emergency case? (The fields in this documentation are a proposal.)
4. How should the paramedic website discover the list of hospitals and their verified status?
5. Who verifies hospitals, and what evidence is required (license number, documents, phone call)?
6. What are the legal and regulatory requirements for patient data in the target country or region (retention, consent, breach notification)?
7. How long should case data be kept, and who may delete it?
8. How long can an alert stay unacknowledged before escalation, and what is the escalation (re-alert, SMS, call, notify the paramedic)?
9. After which age should capacity data be marked stale? (Proposed default: 30 minutes for beds and 60 minutes for resources.)
10. What should happen if a hospital is offline and a case is sent to it?
11. Can a paramedic send one case to several hospitals at once?
12. Which languages and time zones must be supported?
13. Does the hospital need to be able to send the paramedic site a decline with a suggested alternative hospital?
