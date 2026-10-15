# Pages and Navigation

Legend: **[CONFIRMED]** from the project owner, **[ASSUMPTION]** proposed. The pages listed in the project brief are all included.

## 1. Sitemap

```
Public
├── /signup                      Sign up
├── /signin                      Sign in
├── /verify-email                Email verification
├── /forgot-password             Reset password
└── /legal                       Terms, privacy notice, coordination-only notice

Authenticated (hospital)
├── /onboarding                  Hospital profile and onboarding (wizard)
├── /pending                     Verification / pending approval
├── /dashboard                   Live dashboard (home)
│   └── /cases/:caseId           Incoming case details
├── /capacity                    Capacity and resources
├── /alerts                      Notifications and alert history
├── /staff                       Staff and permissions
├── /profile                     Hospital profile (view and edit)
└── /settings                    Settings
    └── /settings/audit          Audit history
```

## 2. Global Layout and Navigation

- **Top bar:** hospital name, connection indicator (Connected / Reconnecting / Offline), notification bell with unread count, mute-sound toggle, user menu.
- **Side navigation (desktop) / bottom or menu navigation (mobile):** Dashboard, Capacity and resources, Alerts and history, Staff and permissions, Profile, Settings.
- **Persistent footer or info link:** "This portal supports coordination and does not replace emergency-service procedures or clinical judgment." [CONFIRMED]
- Menu items are hidden or disabled based on role.
- Unverified accounts see only Onboarding/Pending, Profile, Staff, and Settings.

## 3. Page Requirements

### 3.1 Sign Up
- **Purpose:** an administrator creates an account.
- **Fields:** full name, work email, phone, password, confirm password, agreement to terms.
- **Behavior:** password strength guidance, email verification step, duplicate email check, link to sign in.
- **States:** submitting, success ("Check your email"), validation errors, network error with retry.

### 3.2 Sign In
- **Fields:** email, password; second-step code. [ASSUMPTION]
- **Behavior:** generic error messages ("Email or password is incorrect"), lockout or slowdown after repeated failures, "Forgot password" link, session expiry message on return.
- **States:** loading, error, locked, success.

### 3.3 Hospital Profile and Onboarding
- **Purpose:** collect the hospital's information in steps. [CONFIRMED content]
- **Steps:** (1) Identity and location, (2) Departments and emergency services, (3) Capacity, (4) Emergency resources, (5) Staff invitations (optional), (6) Review and submit.
- **Fields (step 1):** hospital name, street address, city, region, country, phone, email, map location, 24/7 emergency department toggle, emergency contact for verification.
- **Behavior:** saves progress automatically per step, shows a progress bar, validates each step, lets the user go back.
- **After submit:** goes to Pending approval (or Dashboard if already approved).
- **Later edits:** the same fields are editable on the **Profile** page. Changes to name, address, and location may trigger re-verification. [ASSUMPTION]

### 3.4 Verification / Pending Approval
- **Purpose:** show the verification status. [CONFIRMED that approval may be required]
- **Statuses shown:** Pending, More information needed, Approved, Rejected, Suspended.
- **Content:** plain explanation of what each status means, what the hospital can and cannot do now, what is missing (if any), a way to contact support, and a clear statement that real cases are not delivered until approved.
- **Test mode:** a button to send a clearly labeled **test case** to the hospital's own dashboard so staff can practice. [ASSUMPTION]

### 3.5 Live Dashboard
- **Purpose:** the main working screen. Details are in `DASHBOARD_AND_UI_SPEC.md`.
- **Content:** incoming and active alerts, capacity summary, resource summary, connection status, recent activity.
- **Behavior:** new alerts appear instantly without page refresh, with sound and a visual indicator.

### 3.6 Incoming Case Details
- **Purpose:** view and respond to one case.
- **Sections:**
  1. **Header:** case ID, priority, current status, time received, ETA countdown.
  2. **Emergency summary:** emergency type, patient condition, chief complaint.
  3. **Patient information:** age group or age, sex, and only the identifying details the paramedic chose to share (minimized by default).
  4. **Vital signs:** values with measurement time, shown with "as reported by paramedic" labels.
  5. **Paramedic notes** and treatment given so far. [ASSUMPTION]
  6. **Paramedic and ambulance contact:** unit ID, callback number.
  7. **Response panel:** acknowledge button, status selector, resource request checklist (trauma team, ICU bed, operating theater, specialist, equipment, blood product), message to paramedic with quick templates.
  8. **Timeline:** every event with time and staff name (received, acknowledged, status changes, messages).
- **Behavior:** the status control only allows valid transitions; "Unable to receive" requires a reason; if the paramedic updates the case (for example new vitals or ETA), the page highlights what changed and notes the update time.
- **States:** loading, not found or no access, case cancelled, offline (response actions queue or are disabled with a message, see UI spec), failed update with retry.

### 3.7 Capacity and Resources
- **Purpose:** keep availability current. [CONFIRMED]
- **Sections:**
  1. **Beds:** total, available, occupied (by ward or department, optional).
  2. **ICU:** vacant ICU beds.
  3. **Operating theaters:** available count and optional status of each.
  4. **Specialists and teams on duty:** by type (for example trauma surgeon, cardiologist, neurosurgeon, anesthetist), with count or yes/no.
  5. **Equipment:** (for example CT scanner, ventilators, defibrillators), with available counts.
  6. **Other emergency resources:** blood products, helipad, decontamination, etc.
- **Display on every section:** "Last updated [time] by [staff name]", and a **Stale** badge when past the threshold.
- **Actions:** save changes, "Confirm still accurate", view change history.
- **Validation:** non-negative numbers, available + occupied vs total check, confirmation if a large change is entered.
- **Note on the page:** "Capacity figures help paramedics plan. They are not a guarantee that a patient will be accepted."

### 3.8 Staff and Permissions
- **Purpose:** manage who can do what. [ASSUMPTION for details]
- **Content:** staff list (name, email, role, status, last sign-in), invite form, role selector, deactivate or reactivate, pending invitations, role description panel.
- **Rules:** at least one active administrator must always exist; users cannot remove their own admin role if they are the last admin; only administrators see this page.

### 3.9 Notifications and Alert History
- **Purpose:** review current notifications and past cases. [CONFIRMED page, details ASSUMPTION]
- **Tabs:** Notifications (unread and read) and Alert history (closed or cancelled cases).
- **Alert history list columns:** case ID, received time, emergency type, priority, final status, response time, handled by.
- **Filters:** date range, status, priority, emergency type, staff member.
- **Search:** by case ID or keywords (patient-identifying search is limited to authorized roles).
- **Behavior:** opening a historic case shows its timeline. Patient detail visibility follows retention and minimization rules.
- **States:** empty ("No cases yet"), loading, no results, error.

### 3.10 Settings
- **Sections:** account (password, second-step authentication, sessions), notification preferences (sound, desktop notifications, email/SMS escalation), alert thresholds (acknowledgment time, stale-data time, within permitted ranges), display preferences (language, time zone, 12/24h), integration status (connection to the paramedic website, last successful exchange).

### 3.11 Audit History (under Settings)
- **Purpose:** show who did what and when. [CONFIRMED need for audit history]
- **Access:** administrators and auditors only.
- **Logged events:** sign-ins, failed sign-ins, case views, status changes, capacity changes, staff and role changes, exports, setting changes.
- **Columns:** time, user, role, action, target (case ID or setting), outcome, source IP or device. [ASSUMPTION]
- **Filters:** date range, user, action type, case ID.
- **Behavior:** read-only, cannot be edited or deleted by any user.
