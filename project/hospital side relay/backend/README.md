# Hospital Emergency Coordination - Backend Service

This backend service implements the server-side API contract and real-time push mechanism for the **Hospital Emergency Coordination Portal**, interfacing with the pre-hospital paramedic relay.

## Architecture

- **Engine**: Node.js + Express
- **Real-Time Delivery**: Server-Sent Events (SSE) at `/api/events` for instant, reliable dashboard updates with zero continuous polling overhead.
- **Idempotency & Reliability**: Idempotent case creation preventing duplicate case submissions when paramedics retry after network drops.
- **Audit Compliance**: Immutable, append-only security logs for case views, status transitions, and capacity adjustments.
- **Data Source**: Integrated with `data-set/` for schemas, seeds, and validation.

## API Reference

### Emergency Cases & Paramedic Relay
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cases` | List active or historical cases with filters (`status`, `priority`, `search`) |
| `GET` | `/api/cases/:id` | Retrieve detailed case record with audit logging |
| `POST` | `/api/cases` | Paramedic ingestion endpoint. Returns server acknowledgment |
| `POST` | `/api/cases/:id/acknowledge` | Hospital staff acknowledgment (`NEW` → `RECEIVED`) |
| `POST` | `/api/cases/:id/status` | Advance status (`PREPARING`, `READY`, `UNABLE_TO_RECEIVE`, etc.) |
| `POST` | `/api/cases/:id/instructions` | Dispatch instructions and resource requests to paramedic unit |

### Capacity & Emergency Resources
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/capacity` | Fetch current bed/ICU/theater snapshot with freshness status |
| `POST` | `/api/capacity` | Record updated capacity figures |
| `POST` | `/api/capacity/confirm` | "Confirm still accurate" without number change (resets timer) |
| `GET` | `/api/resources` | Fetch on-duty specialists, equipment status, and blood bank units |
| `PUT` | `/api/resources/:cat/:id` | Update specialist or equipment availability |

### Administration, Verification & Audit
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/hospital` | Hospital profile, trauma level, and verification status |
| `PUT` | `/api/hospital` | Update profile information |
| `GET` | `/api/staff` | List staff members and permission roles |
| `POST` | `/api/staff` | Invite new staff member |
| `GET` | `/api/audit` | Query append-only audit trail |
| `GET` | `/api/events` | SSE connection for real-time dashboard events |

### Paramedic Simulator
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/simulator/send-case` | Inject simulated ambulance alert (Trauma, Cardiac, Stroke, Pediatric) |
| `POST` | `/api/simulator/cancel-case` | Simulate ambulance divert / case cancellation |
| `POST` | `/api/simulator/reset` | Reset state to original seed data |

## How to Run

```bash
cd backend
npm install
npm start
```
By default, the server listens on `http://localhost:4000` and automatically serves the frontend web application at the root path `/`.
