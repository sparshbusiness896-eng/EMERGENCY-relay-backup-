# Security and Privacy

Patient details are **sensitive information**. This document lists requirements. Items marked **[CONFIRMED]** come from the project owner; **[ASSUMPTION]** and **[QUESTION]** need confirmation. This file is not legal advice. The applicable laws and regulations for the hospital's region must be identified and checked by qualified people.

## 1. Principles

1. **Least privilege:** people see only what they need.
2. **Data minimization** [CONFIRMED]: collect, show, and keep only what is needed for coordination.
3. **Accountability** [CONFIRMED]: every access to patient data and every change is logged.
4. **Transparency:** staff are told that access is recorded.
5. **Fail safe:** when something is uncertain (permission, data freshness, delivery), the portal says so openly.

## 2. Roles and Permissions [ASSUMPTION for the exact set]

| Capability | Admin | Emergency Staff | Capacity Coordinator | Viewer / Auditor |
|---|---|---|---|---|
| Manage hospital profile | Yes | No | No | No |
| Manage staff and roles | Yes | No | No | No |
| View live dashboard (alerts) | Yes | Yes | Limited (no patient details) | Limited (no patient details) |
| View full case details | Yes | Yes | No | No (history only, minimized) |
| Acknowledge and update case status | Yes | Yes | No | No |
| Request resources / message paramedic | Yes | Yes | No | No |
| Update capacity and resources | Yes | Yes (optional, configurable) | Yes | No |
| View alert history | Yes | Yes | Counts only | Yes (minimized) |
| View audit history | Yes | No | No | Yes |
| Change settings and thresholds | Yes | No | No | No |
| Export data | Admin only, logged | No | No | No |

Rules:
- A user belongs to exactly one hospital and can never see another hospital's data.
- At least one active administrator always exists.
- A person cannot approve their own role change.
- Role changes take effect immediately and end sessions if access is reduced.

## 3. Authentication [CONFIRMED: secure authentication]

1. Passwords: minimum length of 12 characters, checked against common-password lists, and stored only as salted hashes made with a modern, slow password-hashing method. No password hint or recovery by showing the old password.
2. **Second-step authentication** required for all staff. [ASSUMPTION]
3. Email verification for new accounts and invitations (invitations expire).
4. Account lockout or progressive delay after repeated failed sign-ins, with alerts to the administrator.
5. Sessions: secure session handling, inactivity timeout (proposed 15 minutes on shared screens, configurable), automatic warning before expiry, ability to see and end active sessions.
6. A **kiosk or wall-display mode** that shows only limited data and requires re-authentication to open a case. [ASSUMPTION]
7. Password reset links are single-use, expire quickly, and reveal nothing about whether an email exists.
8. Sign-in and sign-out events are logged.

## 4. Patient-Data Handling [CONFIRMED]

### 4.1 Data Minimization
- The paramedic website should send only the fields needed. Names or national IDs are **optional** and should be sent only when the paramedic has them and needs to.
- The portal displays the minimum on lists and alerts (priority, emergency type, short condition summary, key vitals, ETA). Full details appear only on the case page for authorized roles.
- Never put patient details in email subject lines, browser tab titles, URLs, push or desktop notifications, or logs. Notifications use neutral text such as "New critical alert".
- Free-text notes are treated as sensitive. They are not copied into places that have weaker access control.
- No real patient data in development, testing, or demos. Use only synthetic data.

### 4.2 Protection
1. All communication between browsers, the portal, and the paramedic website is encrypted in transit.
2. Patient data is encrypted at rest. Encryption keys are managed separately from the data.
3. Access to production data by developers or support is restricted, approved, time-limited, and logged.
4. Backups are protected to the same standard.
5. Hospital data is separated by hospital (strict tenant separation) and tested.
6. The portal must prevent common web attacks (for example injection, cross-site scripting, cross-site request forgery, insecure direct object access). Every request checks both the user's permission and the hospital's ownership of the case.
7. Integration messages between the two sites are authenticated, integrity-protected, and protected against replay.
8. Rate limiting and abuse detection on public pages and integration endpoints.

### 4.3 Display Safeguards
- Screens in public areas may expose data. Provide a **privacy mode** that hides patient details until a staff member clicks to reveal (the reveal is logged). [ASSUMPTION]
- Case pages show a visible marker "Sensitive patient information".

## 5. Audit Logging [CONFIRMED: audit history]

Log (at minimum):
- Sign-ins, failed sign-ins, sign-outs, password and second-step changes.
- Every **case view** (who, when, which case).
- Acknowledgments, status changes, resource requests, messages to paramedics, status corrections.
- Capacity and resource changes (old value, new value, user, time).
- Staff invitations, role changes, deactivations.
- Settings changes, threshold changes, integration credential changes.
- Exports and downloads.
- Denied access attempts.
- Delivery failures and retries.

Requirements:
- Logs are **append-only** and cannot be edited or deleted by any hospital user, including administrators.
- Each entry has server time, user, role, action, target, outcome, and source (IP or device).
- Logs avoid copying patient details. They reference case IDs.
- The audit page is available to Admin and Viewer/Auditor and is searchable.
- Logs are kept for a defined period (see section 6).
- Unusual behavior (for example many case views in a short time, access outside shift) can trigger alerts to administrators. [ASSUMPTION, later phase]

## 6. Retention and Deletion [QUESTION: needs legal and operational decisions]

Open questions for the project owner and legal advisors:
1. How long should full case details be kept after `HANDOVER_COMPLETE`?
2. Should identifying details be removed or masked after a set time (for example keep only a minimized record for statistics)?
3. How long must audit logs be kept?
4. Who may request deletion, and how is a deletion request handled, given legal record-keeping duties?
5. Does the paramedic website keep its own copy, and how do both sites stay consistent?
6. What happens to data when a hospital leaves or is suspended?

**Proposed default for discussion:** after handover, patient-identifying fields are hidden from all but Admin and a designated record role after 30 days and removed or irreversibly masked after the legally required period. This is a starting point only.

## 7. Incident Response [ASSUMPTION]

- A documented process for suspected breaches, with contacts, steps, and notification duties by region.
- Ability to quickly **suspend a hospital account or the integration** if compromised.
- Ability to revoke all sessions and rotate integration credentials.

## 8. Privacy Notices and Consent [QUESTION]

- Terms of use and a privacy notice are shown at sign-up.
- The coordination-only notice appears at sign-up and on key pages.
- Whether patients need to be informed or consent to data sharing in this flow depends on local law and emergency exceptions. This needs legal review.

## 9. Reliability and Safety Controls

1. Server acknowledgment for each case and visible retryable failures [CONFIRMED].
2. Data freshness labels and stale warnings [CONFIRMED].
3. No wording that guarantees acceptance [CONFIRMED].
4. Escalation for unacknowledged alerts. [ASSUMPTION]
5. Monitoring and alerts for the portal and integration health, with a status page for administrators. [ASSUMPTION]
6. Regular security testing, dependency updates, and review before launch. [ASSUMPTION]

## 10. Security Acceptance Checklist (summary)

- [ ] A user from Hospital A cannot read, guess, or change data of Hospital B.
- [ ] Roles restrict case details as in section 2.
- [ ] Every case view and status change appears in the audit history.
- [ ] No patient details in URLs, logs, notifications, or page titles.
- [ ] Second-step authentication works and cannot be bypassed.
- [ ] Sessions expire and can be ended remotely.
- [ ] Integration requests without valid authentication are rejected.
- [ ] Only synthetic data exists in non-production environments.
