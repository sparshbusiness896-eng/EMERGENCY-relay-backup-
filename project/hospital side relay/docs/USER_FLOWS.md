# User Flows

Flows use the statuses defined in `PRODUCT_REQUIREMENTS.md` section 5. Items marked **[ASSUMPTION]** need confirmation.

## Flow 1: Hospital Registration

**Actor:** Hospital Administrator

1. Visits the portal and selects **Sign up**.
2. Enters name, work email, password, and phone number. Accepts the terms and the notice that the portal supports coordination only.
3. System sends an email verification link. [ASSUMPTION]
4. Administrator confirms the email and is taken to **Onboarding**.
5. If the link expires, the administrator can request a new one.

**Errors:** email already registered (offer sign in or reset), weak password (show requirements), network failure (keep the form data, show retry).

## Flow 2: Hospital Onboarding (Profile Setup)

**Actor:** Hospital Administrator

Onboarding is a multi-step wizard that saves progress after every step.

1. **Hospital identity:** name, address, phone, email, map location (search or drop a pin).
2. **Departments and emergency services:** select from a list (for example Emergency, Trauma, Cardiology, Neurology, Pediatrics, Obstetrics, Burns) and add custom ones.
3. **Capacity:** total beds, available beds, occupied beds, vacant ICU beds, available operating theaters.
4. **Resources:** specialists, teams, equipment, blood products, other.
5. **Staff:** invite at least one additional staff member (optional but encouraged). [ASSUMPTION]
6. **Review and submit** for verification.

The administrator can leave and return later. Progress is kept.

## Flow 3: Verification / Approval

**Actors:** Hospital Administrator, Platform Verifier

1. After submission, the account shows **Pending approval**.
2. The hospital can still view and edit its profile and use the test mode. It **cannot receive real cases** and is not shown as selectable on the paramedic website. [ASSUMPTION]
3. The Platform Verifier approves, rejects, or requests more information. (The verifier's tool may be outside this portal, an open question.)
4. The administrator is notified by email and in the portal.
   - **Approved:** the account becomes **Active** and appears in the paramedic website's hospital list.
   - **More information needed:** the portal states exactly what is missing.
   - **Rejected:** the portal shows the reason and the next steps.
5. A previously approved hospital can be **suspended**. Incoming cases are then blocked and the paramedic site is told the hospital is unavailable.

## Flow 4: Staff Sign-In

**Actor:** Authorized hospital staff

1. Opens the sign-in page and enters email and password.
2. Completes a second authentication step. [ASSUMPTION: required for all staff]
3. Lands on the **Live dashboard**.
4. Sessions expire after a period of inactivity. A warning appears before expiry, and unsaved status changes are not silently lost.

## Flow 5: Capacity Update

**Actor:** Capacity Coordinator, Administrator, or Emergency Staff with permission

1. Opens **Capacity and resources** (or uses the quick update panel on the dashboard).
2. Changes any of: available beds, occupied beds, ICU beds, operating theaters, specialists, equipment, resources.
3. The form checks that values are valid (for example, available plus occupied does not exceed total beds, or warns if it does).
4. Saves. The system records a new **capacity snapshot** with the time and the staff member.
5. The dashboard and the capacity page immediately show the new numbers, a fresh "Last updated" time, and "Updated by".
6. If saving fails, the form keeps the typed values, shows an error, and offers retry.

**Staleness:** if no update is made within the freshness threshold, widgets show a **Stale** badge and a prompt to confirm or update. A **"Confirm still accurate"** action refreshes the timestamp without changing numbers. [ASSUMPTION]

## Flow 6: Receiving an Alert

**Actors:** Paramedic (external), Hospital staff

1. The paramedic enters the case on the paramedic website and selects this hospital.
2. The paramedic website sends the case to the portal.
3. The portal server stores the case and returns a **server acknowledgment** (state `DELIVERED`) to the paramedic website.
4. The case appears on the live dashboard as `NEW` with a visual indicator and sound, at the top of the alert list (critical cases first).
5. Staff open the alert to see the case details.
6. If nobody acknowledges within the threshold, the alert escalates (for example, repeated sound, a banner, notification to the on-duty administrator). [ASSUMPTION]

**Failure paths:**
- Delivery to the portal fails: the paramedic website shows `DELIVERY_FAILED` with a retry button. The portal does not show a partial case.
- The hospital's dashboard is offline or disconnected: the case is still stored on the server. When the dashboard reconnects, it shows the case and flags it as received while reconnecting.
- Duplicate submissions are detected using a case identifier and are merged, not shown twice.

## Flow 7: Responding to a Case

**Actor:** Emergency staff

1. Opens the incoming case detail.
2. Taps **Acknowledge** → status `RECEIVED`. The paramedic website shows "Hospital has seen the alert" with the time and (optionally) staff name or role.
3. Selects the treatment or resources needed: trauma team, ICU bed, operating theater, specialist (choose type), equipment, blood product (choose type).
4. Updates status to `PREPARING` while the resources are being arranged.
5. When ready, updates to `READY`. The UI text says "Hospital reports it is preparing to receive" and does not promise acceptance.
6. If the hospital cannot receive, selects `UNABLE_TO_RECEIVE`, chooses a reason (no capacity, resource unavailable, diversion, other), and may add a note. The paramedic website shows this prominently.
7. Optionally sends a short instruction to the paramedic (for example, "Use ambulance bay 2", "Go to trauma entrance").
8. Each update is sent to the paramedic website. If delivery back fails, it shows a visible, retryable error in the portal.

## Flow 8: Completing a Handover

**Actor:** Emergency staff

1. When the ambulance arrives, staff set `PATIENT_ARRIVED`. Arrival time is recorded.
2. After the handover, staff set `HANDOVER_COMPLETE` and can add short closing notes (for example, department the patient was moved to). [ASSUMPTION]
3. The case moves from **Active cases** to **Alert history**.
4. Patient-identifying details follow the retention and minimization rules in `SECURITY_AND_PRIVACY.md`.

## Flow 9: Case Cancelled or Redirected by the Paramedic

1. The paramedic cancels the case or selects another hospital.
2. The portal receives the update, sets the case to `CANCELLED`, and shows a clear notice on the dashboard and the case page.
3. The case stays in history with the reason (if given). Hospital staff are prompted to release any reserved resources.

## Flow 10: Staff Management

1. The administrator opens **Staff and permissions**.
2. Invites a user by email and assigns a role.
3. The invited person accepts, sets a password, and completes second-step authentication.
4. The administrator can change roles or deactivate a user. Deactivation ends active sessions immediately.
5. All changes are written to the audit history.
