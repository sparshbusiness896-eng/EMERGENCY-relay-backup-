# Acceptance Criteria

Each criterion should be testable. Use only synthetic data. Format: **Given / When / Then**. IDs can be used in test plans. Status names refer to `PRODUCT_REQUIREMENTS.md` section 5.

## 1. Registration and Sign-In

**AC-REG-1** Given a visitor on the sign-up page, when they enter valid details and submit, then an account is created in an unverified-email state and a verification email is sent.

**AC-REG-2** Given an email that is already registered, when a visitor tries to sign up with it, then no second account is created and the visitor is guided to sign in or reset the password.

**AC-REG-3** Given a password that does not meet the rules, when the form is submitted, then the form shows the specific rules and does not submit.

**AC-REG-4** Given an unverified email, when the user tries to continue to onboarding, then access is blocked until the email is confirmed.

**AC-REG-5** Given expired verification links, when the user opens one, then a clear message and a "send new link" option are shown.

**AC-SIGN-1** Given valid credentials and a valid second-step code, when the user signs in, then they reach the dashboard (or the pending page if the hospital is not approved).

**AC-SIGN-2** Given wrong credentials, when the user signs in, then a generic error appears that does not reveal whether the email exists.

**AC-SIGN-3** Given repeated failed sign-ins above the limit, when another attempt is made, then the account is temporarily locked or delayed and the event is logged.

**AC-SIGN-4** Given an inactive session past the timeout, when the user acts, then they are asked to sign in again and return to the same page afterward.

## 2. Onboarding and Verification

**AC-ONB-1** Given a new administrator, when they complete each onboarding step, then progress is saved and they can leave and resume later without losing data.

**AC-ONB-2** Given missing required fields (name, address, phone, email, location), when the user tries to continue, then the step shows errors and does not proceed.

**AC-ONB-3** Given the capacity step, when the user enters available plus occupied beds greater than total beds, then the form warns and requires correction or explicit confirmation.

**AC-ONB-4** Given completed onboarding, when the administrator submits for verification, then the hospital status becomes `PENDING` and the pending page appears.

**AC-VER-1** Given a `PENDING` hospital, when a paramedic site requests the hospital list, then the hospital is not included as selectable, and any attempt to submit a case to it is rejected with a clear, non-retryable error.

**AC-VER-2** Given a `PENDING` hospital, when staff view the portal, then a banner states that real cases cannot be received yet.

**AC-VER-3** Given an approval, when it is recorded, then the administrator is notified, the status becomes `APPROVED`, the dashboard unlocks, and the hospital appears in the paramedic website's list.

**AC-VER-4** Given a rejection or "information needed", when it is recorded, then the portal displays the reason and next steps.

**AC-VER-5** Given a suspension, when a case is submitted, then it is rejected and the paramedic site is told the hospital is unavailable.

## 3. Dashboard Alerts

**AC-ALR-1** Given an approved hospital with the dashboard open, when a paramedic site submits a valid case for that hospital, then the alert appears on the dashboard without a page refresh, normally within 5 seconds of server receipt.

**AC-ALR-2** Given a submitted case, when the portal stores it, then the portal returns a server acknowledgment (`DELIVERED`) to the paramedic site before or when the alert is shown.

**AC-ALR-3** Given a new alert, when it appears, then the card shows priority, emergency type, condition summary, available vitals, ETA, status `NEW`, and time received, and plays the alert sound unless muted.

**AC-ALR-4** Given a case for Hospital A, when a user of Hospital B uses the portal, then they cannot see it in any list, search, URL, or notification.

**AC-ALR-5** Given a case with missing optional fields, when it is displayed, then missing data is shown as "Not provided" and the page does not break.

**AC-ALR-6** Given the same case submitted twice with the same `case_id`, when received, then only one alert exists and the second response states `duplicate: true`.

**AC-ALR-7** Given multiple active alerts, when the list is shown, then Critical alerts are first, then by earliest ETA, and `NEW` alerts appear above acknowledged ones of equal priority.

**AC-ALR-8** Given an active filter, when a new Critical alert arrives that does not match, then the user is still notified visibly and can clear the filter in one action.

**AC-ALR-9** Given an alert unacknowledged beyond the configured threshold, when the time passes, then it escalates visibly (and by sound for Critical).

**AC-ALR-10** Given a paramedic updates a case (new vitals or ETA), when the update arrives, then the open case page and card show the change, highlight it, and show the update time.

**AC-ALR-11** Given a paramedic cancels the case, when the cancellation arrives, then the case becomes `CANCELLED`, staff are notified, and it moves to history.

## 4. Case Responses

**AC-RSP-1** Given a `NEW` case, when staff press Acknowledge, then the status becomes `RECEIVED`, the time and staff member are recorded, and the acknowledgment appears on the paramedic website.

**AC-RSP-2** Given a case, when staff change the status in a valid sequence, then each change is saved with time and user, and appears in the case timeline and on the paramedic website.

**AC-RSP-3** Given invalid transitions (for example `NEW` to `PATIENT_ARRIVED`), when staff try them, then the portal prevents them and explains why.

**AC-RSP-4** Given staff choose `UNABLE_TO_RECEIVE`, when they submit without a reason, then the action is blocked. When a reason is provided, the status is saved and shown prominently to the paramedic.

**AC-RSP-5** Given resource needs, when staff select trauma team, ICU bed, operating theater, specialist, equipment, or blood product, then the request is saved and sent to the paramedic site.

**AC-RSP-6** Given staff write an instruction to the paramedic, when sent, then it appears on the paramedic site with the time, and the case timeline records it.

**AC-RSP-7** Given the status `READY`, when it is displayed on either site, then the wording says the hospital reports it is ready or preparing to receive, and never says "accepted" or "bed reserved".

**AC-RSP-8** Given two staff members change the same case at once, when the second saves, then they are shown the conflict and nothing is silently overwritten.

**AC-RSP-9** Given staff set `PATIENT_ARRIVED` and then `HANDOVER_COMPLETE`, when saved, then arrival and completion times are recorded and the case moves to history.

**AC-RSP-10** Given a status correction to an earlier step, when made, then a reason is required and the audit history records it.

**AC-RSP-11** Given a user with a role lacking permission (for example Capacity Coordinator), when they try to open full case details or change a status, then access is denied and the attempt is logged.

## 5. Capacity and Resources

**AC-CAP-1** Given the capacity page, when staff update available beds, occupied beds, ICU beds, or theaters and save, then a new snapshot is stored and the dashboard widgets show the new values immediately.

**AC-CAP-2** Given any saved update, when viewed, then the page shows the last-updated time and the name of the staff member who made it.

**AC-CAP-3** Given no update within the freshness threshold, when time passes, then the widget shows a "Stale" indicator and a "Confirm or update" action.

**AC-CAP-4** Given staff choose "Confirm still accurate", when saved, then the timestamp and user update, values remain unchanged, and the snapshot is marked as confirmed without change.

**AC-CAP-5** Given invalid values (negative numbers, text), when saving, then the form blocks the save and explains the issue.

**AC-CAP-6** Given a change that sets beds, ICU beds, or theaters to zero or changes a value by a large amount, when saving, then a confirmation dialog appears.

**AC-CAP-7** Given specialists, teams, equipment, or resources, when staff update them, then the changes save with time and user, and show on the dashboard resource panel.

**AC-CAP-8** Given a capacity change, when viewed in the history, then old value, new value, user, and time are visible.

**AC-CAP-9** Given the paramedic site's hospital list request, when returned, then each hospital includes its last-updated time and a stale flag with the notice that capacity is not a guarantee.

**AC-CAP-10** Given any capacity display, then no text states or implies that bed availability means the hospital will accept the patient.

## 6. Staff and Permissions

**AC-STF-1** Given an administrator, when they invite a user with a role, then an invitation email is sent and expires after the set time.

**AC-STF-2** Given a deactivated user, when they have an open session, then the session ends immediately and sign-in is blocked.

**AC-STF-3** Given the last active administrator, when someone tries to deactivate or demote them, then the action is prevented.

**AC-STF-4** Given any role or staff change, then it appears in the audit history.

## 7. Failure, Offline, and Reconnection Behavior

**AC-FAIL-1** Given the paramedic site cannot reach the portal, when a case is submitted, then the paramedic site shows `DELIVERY_FAILED` with a retry option, and the portal shows no partial case.

**AC-FAIL-2** Given a failed delivery that is retried with the same `case_id`, when it succeeds, then exactly one alert exists.

**AC-FAIL-3** Given the portal cannot deliver a hospital response (acknowledgment, status, or instruction) to the paramedic site, when it fails, then the case page shows a visible "not delivered" banner, the update is marked "Pending delivery", automatic retries occur, and a manual retry button works.

**AC-FAIL-4** Given a response that eventually delivers, when confirmed, then the banner clears and the status shows as delivered.

**AC-FAIL-5** Given the dashboard loses connection, when this happens, then the connection indicator changes to "Reconnecting", the last data stays visible and labeled "as of [time]", and the user is warned that new alerts may be missed.

**AC-FAIL-6** Given the dashboard stays disconnected beyond the offline limit, when reached, then an "Offline" banner appears, and response actions are disabled or clearly queued with a message.

**AC-FAIL-7** Given a case arrives while the dashboard is disconnected, when the connection returns, then the case appears, is highlighted, the alert sound plays if it is unacknowledged, and no case is lost.

**AC-FAIL-8** Given a hospital dashboard is not connected, when a case arrives, then the case is still stored and acknowledged by the server, and any configured backup notification (email or SMS) is sent. [Depends on the escalation decision]

**AC-FAIL-9** Given loading takes long, when more than 5 seconds pass, then the user sees a message and a retry action instead of a blank or frozen screen.

**AC-FAIL-10** Given an unexpected server error, when it occurs, then the user sees a clear message with a reference code and no technical details or patient data.

## 8. Security and Privacy

**AC-SEC-1** Given any case view, then an audit entry is created with user, time, and case ID.

**AC-SEC-2** Given any URL, notification, page title, or log line, then it contains no patient name or identifying detail.

**AC-SEC-3** Given a user of Hospital A who edits a URL to a case ID of Hospital B, when they open it, then they see a neutral "not found or no access" message and the attempt is logged.

**AC-SEC-4** Given an audit history, then no user can edit or delete entries.

**AC-SEC-5** Given an integration request with missing or invalid authentication, when received, then it is rejected and logged.

## 9. Accessibility and Responsiveness

**AC-UI-1** Given a keyboard-only user, when they use the dashboard and case page, then every action is reachable and focus is always visible.

**AC-UI-2** Given a screen reader, when a new alert arrives, then it is announced, with higher urgency for Critical.

**AC-UI-3** Given any status or priority, then it is conveyed by text and icon in addition to color, and text contrast meets WCAG 2.1 AA.

**AC-UI-4** Given a phone-size screen, when staff open the dashboard and a case, then all key information and actions are usable in a single column without horizontal scrolling.

**AC-UI-5** Given the reduced-motion setting, when enabled, then pulsing and sliding effects are disabled.

## 10. Coordination-Only Notice

**AC-NTC-1** Given the dashboard, case page, and capacity page, then the coordination-only notice is visible, and it states that the portal does not replace emergency-service procedures or clinical judgment.

## 11. Definition of Done for the MVP

The MVP is accepted when all criteria above pass in a test environment with synthetic data, the integration works end to end with the paramedic website (or an approved test double of it), and all **Open questions** in `PRODUCT_REQUIREMENTS.md` and `DATA_MODEL_AND_API_INTEGRATION.md` have either an answer or a documented decision.
