# Dashboard and UI Specification

This file describes how the interface should behave. It does not specify any technology or visual brand. Items marked **[ASSUMPTION]** need confirmation.

## 1. Design Principles

1. **Speed to understanding.** In an emergency, staff must see what matters in seconds.
2. **Never over-promise.** Wording avoids implying that capacity equals acceptance.
3. **Honest data.** Always show how fresh the information is.
4. **Not color alone.** Every status uses text and an icon along with color.
5. **Errors are visible.** Nothing fails silently.

## 2. Dashboard Layout (Desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top bar: Hospital name | Connection status | Bell | Mute | User      │
├──────────────┬───────────────────────────────────────────────────────┤
│ Side nav     │ Coordination notice (dismissible per session)         │
│              ├───────────────────────────────┬───────────────────────┤
│              │ INCOMING & ACTIVE ALERTS      │ CAPACITY SUMMARY      │
│              │ (largest area, sorted by      │ Beds | ICU | Theaters │
│              │  priority then ETA)           │ Last updated + stale  │
│              │                               ├───────────────────────┤
│              │ Filters / search bar          │ RESOURCES ON DUTY     │
│              │                               │ Specialists | Equip.  │
│              │                               ├───────────────────────┤
│              │                               │ RECENT ACTIVITY       │
└──────────────┴───────────────────────────────┴───────────────────────┘
```

- The alert area takes about two-thirds of the width. Capacity and resources sit in a side column.
- A **quick update** button on each capacity widget opens a small panel without leaving the dashboard.

## 3. Alert Card

Each active case appears as a card containing:

- **Priority badge** (see section 4).
- **Emergency type** (for example "Road traffic collision").
- **Patient condition summary** (one line, for example "Adult, conscious, suspected chest injury").
- **Key vitals** (maximum 3 shown, with "view all").
- **ETA** as a live countdown and the clock time, with "ETA updated [time]" if the paramedic changed it.
- **Status badge** (see section 5).
- **Resource requests** summary icons (trauma team, ICU, theater, blood, etc.).
- **Time since received** and, for `NEW` cases, **time unacknowledged**.
- **Primary action button:** "Acknowledge" for `NEW`, "Open case" otherwise.
- **Delivery indicator** only when something is wrong (for example "Delivery issue").

New cards slide in at the top with a highlight that lasts until acknowledged.

## 4. Priority Presentation [ASSUMPTION]

Priority is taken from the paramedic's submission. If the paramedic site does not send priority, the portal shows "Not specified".

| Priority | Label | Icon | Color (with accessible contrast) |
|---|---|---|---|
| Critical | CRITICAL | Triangle with exclamation | Red, with white text |
| High | HIGH | Upward arrow | Orange, with dark text |
| Medium | MEDIUM | Dash | Yellow, with dark text |
| Low | LOW | Downward arrow | Blue, with white text |
| Unknown | NOT SPECIFIED | Question mark | Gray, with dark text |

**Sorting:** Critical first, then by earliest ETA. `NEW` cases always appear above acknowledged cases of the same priority.

## 5. Status Presentation

Use the statuses from `PRODUCT_REQUIREMENTS.md` section 5.

| Status | Label shown | Icon | Color |
|---|---|---|---|
| `NEW` | New, not acknowledged | Bell | Red outline, pulsing (reduced-motion safe) |
| `RECEIVED` | Received | Eye or check | Blue |
| `PREPARING` | Preparing | Wrench or clock | Amber |
| `READY` | Reports ready to receive | Check circle | Green |
| `UNABLE_TO_RECEIVE` | Unable to receive | Stop sign | Dark red |
| `PATIENT_ARRIVED` | Patient arrived | Door or arrival icon | Purple |
| `HANDOVER_COMPLETE` | Handover complete | Double check | Gray |
| `CANCELLED` | Cancelled by paramedic | Cross | Gray, strikethrough title |
| `DELIVERY_FAILED` | Delivery failed | Warning | Orange with "Retry" button |

**Wording rule:** Never use "Accepted" or "Confirmed bed". Use "Reports ready to receive".

## 6. Capacity Widgets

Each widget shows:

- A large number (for example "Available beds: 12") with the total ("of 80") and occupied count.
- A small **Last updated** line (for example "Updated 14 min ago by N. Rao") with the exact time on hover or tap.
- A **freshness indicator**:
  - **Fresh** (within threshold): normal.
  - **Aging** (75% of the threshold): amber text "Update soon".
  - **Stale** (past threshold): gray widget with a "Stale, may be out of date" badge and a "Confirm or update" button.
- A note under the group: "Figures are not a guarantee of acceptance."

**Default thresholds [ASSUMPTION]:** beds, ICU, and theaters = 30 minutes; specialists and equipment = 60 minutes. Administrators can change these within allowed limits.

**Widgets:** Available beds, Vacant ICU beds, Available operating theaters, Specialists and teams on duty, Key equipment, Other resources (blood, helipad, etc.).

## 7. Timestamps

- Relative time ("5 min ago") for quick reading, with exact date and time on hover, tap, or focus.
- The time zone is the hospital's time zone and is shown in settings. Screen-reader text reads the exact time.
- Timestamps update live without a page refresh.
- Server time is used for all recorded events. If the user's device clock differs strongly, a warning is shown.

## 8. Filters and Search

On the dashboard alert list:
- **Quick filters:** All active, Needs acknowledgment, Preparing, Ready, Arriving soon (ETA under 15 minutes), My cases (cases I acknowledged).
- **Filters:** priority, emergency type, status.
- **Search:** case ID and emergency type. Patient name search only for authorized roles.
- Filters remain while new alerts arrive. A counter shows hidden alerts that do not match the current filter ("1 new critical alert hidden by filter", with a button to clear the filter). Critical new alerts must never be silently hidden.

## 9. Alert Sound and Notifications [ASSUMPTION]

- A distinct sound for new alerts, a stronger sound for Critical.
- A mute control exists but the visual indicator and the unread count cannot be disabled.
- Sound repeats for unacknowledged Critical alerts until acknowledged or muted.
- Browsers may block audio until the user interacts. The portal shows a prompt "Enable alert sound" at sign-in.
- Optional desktop notifications if the user permits.

## 10. Responsive Behavior

| Screen | Behavior |
|---|---|
| Large desktop and wall display | Full layout. An optional **wall mode** shows alerts and capacity in large text. [ASSUMPTION] |
| Laptop and tablet | Capacity column collapses beneath the alerts or into a collapsible panel. |
| Phone | Single column. Alerts first, then a compact capacity summary. Navigation moves to a menu or bottom bar. Case page actions stay reachable with a sticky action bar. |

Touch targets are at least 44×44 px. Nothing important is hover-only.

## 11. Accessibility

- Target WCAG 2.1 AA.
- Color contrast at least 4.5:1 for text.
- Status is conveyed by text and icon as well as color.
- New alerts are announced to screen readers through a live region, with higher urgency for Critical.
- Full keyboard operation, visible focus, logical tab order.
- The pulsing effect respects reduced-motion settings.
- Form errors are linked to fields and described in text.
- Plain, short wording and avoidance of abbreviations without explanations.

## 12. Interface States

### 12.1 Loading
- Skeleton placeholders for alert list and widgets.
- Slow loading (over 5 seconds) shows a message "Still loading..." and a retry option.
- Capacity widgets never show a stale number as current while loading. They show a loading indicator.

### 12.2 Empty
- No active alerts: "No active cases. This screen will update automatically when a case arrives." Show the connection status next to it so staff know the empty list is trustworthy.
- No capacity entered yet: "Capacity not set. Enter your capacity so paramedics see current figures." with a button.
- Empty history and empty search results have their own messages.

### 12.3 Connection States
| State | Presentation |
|---|---|
| Connected | Small green indicator with text "Live". |
| Reconnecting | Amber banner "Reconnecting... You may miss new alerts. Retrying." with attempt count. The last data stays visible and is marked "as of [time]". |
| Offline | Red banner at the top "You are offline. New alerts will not appear until you reconnect." Response actions are disabled or clearly marked "will send when reconnected" (decision in open questions). |
| Reconnected | A brief message "Back online. Checking for missed cases..." and then the dashboard fetches everything missed during the disconnection, highlights those cases, and plays the alert sound if any are unacknowledged. |

Staff should have an extra way to learn about alerts when the dashboard is not connected (for example SMS or email escalation). [ASSUMPTION]

### 12.4 Failed Alert Delivery
- If the portal cannot confirm delivery of a case from the paramedic website, no partial or false case appears. The paramedic side shows `DELIVERY_FAILED` with retry.
- If a hospital response (acknowledgment, status, instruction) cannot be delivered to the paramedic website, the case page shows a red banner "Update not delivered to paramedic. Retry" with a retry button and the number of attempts. The system also retries automatically with increasing delay. The status change is marked "Pending delivery" until confirmed.
- A count of "cases with delivery problems" appears in the top bar when greater than zero.

### 12.5 Error and Permission States
- No permission: "You do not have access to this page" with a link back.
- Case not found or not for this hospital: the same neutral message, with no hints about other hospitals' cases.
- Session expired: a sign-in dialog that preserves the current page and unsent text.
- Unexpected error: a clear message, a reference code, and retry.

### 12.6 Conflicting Updates
- If two staff members change the same case or capacity item at the same time, the second saver sees "This was updated by [name] at [time]" and chooses to keep theirs or apply the new value. Nothing is overwritten silently.

## 13. Confirmation and Safety Dialogs

- `UNABLE_TO_RECEIVE` requires a reason and a confirmation.
- Moving a case backward in status asks for a short reason.
- Setting capacity to zero for beds, ICU, or theaters shows a confirmation "Paramedics will see this hospital as having no available [item]."
- Large capacity changes (for example more than a 30% jump) show a "please confirm" prompt.

## 14. Coordination-Only Notice

A persistent notice appears on the dashboard, the case page, and the capacity page:

> "This portal supports coordination between paramedics and hospitals. It does not replace emergency-service procedures or clinical judgment. Capacity information may be out of date and is not a guarantee that a patient will be accepted."
