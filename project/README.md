# Emergency Relay Suite

This workspace contains two applications that are launched together by the shared backend runner and **linked** to each other (see "How the two sites are linked" below):

- **Triage Relay**: `http://localhost:4000` (`/api/v1/*` API and triage frontend)
- **Hospital Relay**: `http://localhost:4100` (`/api/*` API and hospital frontend)

## Local database setup

Docker is not required. Install **PostgreSQL 16** and its matching **PostGIS** extension on Windows, then copy `traige relay/.env.example` to `traige relay/.env`.

For the local demo defaults, keep the password as `postgres`. Once PostgreSQL is installed and its service is running, initialize the database and seed data:

```powershell
npm run db:setup
```

## Start both backends

From this project root, run:

```bash
npm start
```

The runner starts both web servers, forwards their logs to the same terminal, and stops the other server if either one fails. Press `Ctrl+C` once to stop both web servers.

## Optional ports

Default ports avoid the previous conflict, where both applications documented port `4000`:

```powershell
$env:TRIAGE_PORT=4000
$env:HOSPITAL_PORT=4100
npm start
```

`TRIAGE_PORT` and `HOSPITAL_PORT` must be different.

## Tests

```bash
npm test
```


## How the two sites are linked

1. A paramedic selects a hospital in **Triage Relay** (4000).
2. The Triage server sends the case to **Hospital Relay** (4100) at `POST /api/cases`, proving who it is with a shared secret (`X-Relay-Key`). Only hospital `hos_001` (Apex) is linked to the hospital portal for now (`hosp_metro_01`); change this with the `HOSPITAL_ID_MAP` setting.
3. The alert appears live on the hospital dashboard.
4. When hospital staff acknowledge, change the status, or send an instruction, the hospital server calls `POST /api/v1/integrations/hospital-update` on Triage Relay. The paramedic sees it on screen straight away.
5. If the hospital server cannot be reached, the paramedic gets a red message to phone the hospital.

`npm start` creates the shared secret and gives it to both servers automatically. Set `RELAY_SHARED_SECRET` yourself if you want a fixed value. If you start the servers one by one, set `RELAY_SHARED_SECRET`, `TRIAGE_URL` and `HOSPITAL_RELAY_URL` for both.

Known limits: the Hospital Relay has no real staff login yet, and the hospital portal's case list is kept in memory (lost on restart).
