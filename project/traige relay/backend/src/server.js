/**
 * Triage Relay: REST API & Realtime Server
 * Source: 06_DATABASE_AND_API_SCHEMA.md
 *
 * Implements:
 * - All REST endpoints from File 06 Section 4
 * - Realtime push for ED pre-alerts and ambulance telemetry
 * - Standard Node.js http implementation with zero external runtime dependencies
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { dbStore } = require('./store');
const { rankHospitals } = require('./scoring');
const { RoutingService } = require('./routing');
const { calculateGcsTotal, calculateRtsTriage, calculateRtsWeighted, suggestEsiLevel } = require('./triage');
const { forwardIncidentToHospital, relayKeyMatches } = require('./hospital_relay');

const PORT = process.env.PORT || 4000;
const routingService = new RoutingService();
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Realtime SSE / WebSocket subscriber registry
const alertClients = new Set();

function broadcastEvent(channel, eventType, payload) {
  const message = JSON.stringify({
    type: eventType,
    id: `msg_${Date.now().toString(36)}`,
    ts: new Date().toISOString(),
    channel,
    payload
  });

  for (const client of alertClients) {
    try {
      client.res.write(`event: ${eventType}\ndata: ${message}\n\n`);
    } catch (e) {
      alertClients.delete(client);
    }
  }
}

// Keep-alive heartbeat every 20 seconds for SSE
setInterval(() => {
  for (const client of alertClients) {
    try {
      client.res.write(': ping\n\n');
    } catch (e) {
      alertClients.delete(client);
    }
  }
}, 20000).unref();

// Request parsing helpers
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathName = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  try {
    // -------------------------------------------------------------
    // Frontend Static Files (Serve entire web app from backend)
    // -------------------------------------------------------------
    if (!pathName.startsWith('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        return res.end('Method Not Allowed');
      }

      let relativePath = pathName === '/' ? '/index.html' : pathName;
      const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(FRONTEND_DIR, safePath);

      if (!filePath.startsWith(FRONTEND_DIR)) {
        return sendJson(res, 403, { error: 'Forbidden' });
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        return fs.createReadStream(filePath).pipe(res);
      }

      // Fallback to index.html if file doesn't exist
      const indexPath = path.join(FRONTEND_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return fs.createReadStream(indexPath).pipe(res);
      }

      return sendJson(res, 404, { error: 'File Not Found', path: pathName });
    }

    // -------------------------------------------------------------
    // Realtime Push Events (SSE stream compatible with any browser)
    // -------------------------------------------------------------
    if (pathName === '/api/v1/events' || pathName === '/api/v1/alerts/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(': connected\n\n');
      const client = { res, hospitalId: query.hospitalId || 'all' };
      alertClients.add(client);
      req.on('close', () => alertClients.delete(client));
      return;
    }

    if (method === 'GET' && pathName === '/api/v1/health') {
      return sendJson(res, 200, {
        status: 'ONLINE',
        service: 'Triage Relay API',
        timestamp: new Date().toISOString()
      });
    }

    // -------------------------------------------------------------
    // Auth Endpoints
    // -------------------------------------------------------------
    if (method === 'POST' && pathName === '/api/v1/auth/login') {
      const body = await parseBody(req);
      const user = (await dbStore.getUserByEmail(body.email)) || dbStore.users.find(u => u.email === body.email) || {
        id: 'usr_demo',
        email: body.email,
        fullName: 'Demo Clinician',
        role: 'PARAMEDIC'
      };

      return sendJson(res, 200, {
        accessToken: `jwt_demo_${user.role.toLowerCase()}`,
        user
      });
    }

    // -------------------------------------------------------------
    // Hospitals Endpoints
    // -------------------------------------------------------------
    if (method === 'GET' && pathName === '/api/v1/hospitals') {
      return sendJson(res, 200, await dbStore.getAllHospitals());
    }

    const hospitalIncomingMatch = pathName.match(/^\/api\/v1\/hospitals\/([^/]+)\/incoming$/);
    if (method === 'GET' && hospitalIncomingMatch) {
      const hospitalId = hospitalIncomingMatch[1];
      const incoming = await dbStore.getIncomingForHospital(hospitalId);
      return sendJson(res, 200, incoming);
    }

    const hospitalBedsMatch = pathName.match(/^\/api\/v1\/hospitals\/([^/]+)\/beds$/);
    if (method === 'PUT' && hospitalBedsMatch) {
      const hospitalId = hospitalBedsMatch[1];
      const body = await parseBody(req);
      const updated = await dbStore.updateHospitalBeds(hospitalId, body.beds || {});

      broadcastEvent(`hospital:${hospitalId}`, 'BEDS_UPDATE', {
        hospitalId,
        beds: updated.bedInventory,
        updatedAt: updated.bedsUpdatedAt
      });

      return sendJson(res, 200, { hospitalId, updatedAt: updated.bedsUpdatedAt });
    }

    const hospitalStatusMatch = pathName.match(/^\/api\/v1\/hospitals\/([^/]+)\/status$/);
    if (method === 'PUT' && hospitalStatusMatch) {
      const hospitalId = hospitalStatusMatch[1];
      const body = await parseBody(req);
      const updated = await dbStore.updateHospitalStatus(hospitalId, body.status);
      return sendJson(res, 200, updated);
    }

    // -------------------------------------------------------------
    // Incidents & Intake Endpoints
    // -------------------------------------------------------------
    if (method === 'POST' && pathName === '/api/v1/incidents') {
      const body = await parseBody(req);
      const incident = await dbStore.createIncident(body);
      return sendJson(res, 201, incident);
    }

    if (method === 'GET' && pathName === '/api/v1/dispatch/incidents/active') {
      return sendJson(res, 200, await dbStore.getAllIncidents());
    }

    const incidentIntakeMatch = pathName.match(/^\/api\/v1\/incidents\/([^/]+)\/intake$/);
    if (method === 'POST' && incidentIntakeMatch) {
      const incidentId = incidentIntakeMatch[1];
      const body = await parseBody(req);
      const incident = await dbStore.updateIncidentIntake(incidentId, body);

      // Calculate derived clinical indicators
      const gcsTotal = calculateGcsTotal(body.gcs?.eye, body.gcs?.verbal, body.gcs?.motor);
      const sbp = body.vitals?.sbp ?? 120;
      const rr = body.vitals?.respiratoryRate ?? 16;
      const rtsTriage = calculateRtsTriage(gcsTotal, sbp, rr);
      const rtsWeighted = calculateRtsWeighted(gcsTotal, sbp, rr);
      const esiSug = suggestEsiLevel({
        vitals: body.vitals,
        gcsTotal,
        traumaTypes: body.traumaTypes,
        isPediatric: incident.patient?.isPediatric
      });

      return sendJson(res, 200, {
        incidentId,
        status: 'INTAKE_DONE',
        derived: {
          gcsTotal,
          rtsTriage,
          rtsWeighted,
          esiSuggested: esiSug.suggestedLevel
        }
      });
    }

    const incidentVitalsMatch = pathName.match(/^\/api\/v1\/incidents\/([^/]+)\/vitals$/);
    if (method === 'POST' && incidentVitalsMatch) {
      const incidentId = incidentVitalsMatch[1];
      const body = await parseBody(req);
      const reading = await dbStore.addVitalsReading(incidentId, body);

      const incident = await dbStore.getIncidentById(incidentId);
      if (incident?.selectedHospitalId) {
        broadcastEvent(`hospital:${incident.selectedHospitalId}`, 'VITALS_UPDATE', {
          incidentId,
          vitals: reading,
          scores: { rtsTriage: reading.rtsTriage, rtsWeighted: reading.rtsWeighted }
        });
      }

      return sendJson(res, 201, reading);
    }

    // -------------------------------------------------------------
    // Recommendation Engine Endpoint
    // -------------------------------------------------------------
    if (method === 'POST' && pathName === '/api/v1/recommendations') {
      const body = await parseBody(req);
      const origin = body.origin || { lat: 30.3110, lng: 78.0280 };
      const allHospitals = await dbStore.getAllHospitals();

      // Compute travel matrix (File 03 Step 4)
      const etaMatrix = await routingService.getEtaMatrix(origin, allHospitals);
      const candidateList = allHospitals.map(h => {
        const eta = etaMatrix.find(e => e.hospitalId === h.id);
        return {
          ...h,
          etaMinutes: eta?.etaMinutes || 15,
          distanceKm: eta?.distanceKm || 5.0,
          etaSource: eta?.etaSource || 'LIVE_TRAFFIC'
        };
      });

      const response = rankHospitals(candidateList, body);
      return sendJson(res, 200, response);
    }

    // -------------------------------------------------------------
    // Hospital Selection & Pre-Alert Dispatched
    // -------------------------------------------------------------
    const selectHospitalMatch = pathName.match(/^\/api\/v1\/incidents\/([^/]+)\/select-hospital$/);
    if (method === 'POST' && selectHospitalMatch) {
      const incidentId = selectHospitalMatch[1];
      const body = await parseBody(req);
      const { incident, alert } = await dbStore.selectHospitalForIncident(
        incidentId,
        body.hospitalId,
        body.override
      );

      const hospital = await dbStore.getHospitalById(body.hospitalId);
      if (!hospital) {
        return sendJson(res, 404, { error: 'Hospital not found', hospitalId: body.hospitalId });
      }
      const sceneLoc = incident.sceneLocation || { lat: 30.3110, lng: 78.0280 };
      const destLoc = hospital.edEntranceCoordinates || hospital.coordinates || { lat: 30.3168, lng: 78.0325 };
      const route = await routingService.getRoute(sceneLoc, destLoc);

      // Fan-out INCOMING_PATIENT pre-alert via WebSocket / SSE to destination ED
      const incidentVitals = await dbStore.getVitalsForIncident(incidentId);
      const incomingPayload = {
        incidentId,
        ambulanceId: incident.ambulanceId,
        esiLevel: incident.acuity?.esiLevel || 2,
        patient: incident.patient,
        traumaTypes: incident.traumaTypes,
        mechanism: incident.mechanism,
        vitals: incidentVitals.slice(-1)[0] || null,
        etaMinutes: route.etaMinutes,
        etaSeconds: route.durationSeconds,
        paramedicNote: incident.notes
      };
      broadcastEvent(`hospital:${body.hospitalId}`, 'INCOMING_PATIENT', incomingPayload);

      // Forward the same pre-alert to the Hospital Relay server (runs in the background,
      // so the paramedic's screen is never slowed down). The result is pushed back to the
      // paramedic as a live event so a failed delivery is never silent.
      forwardIncidentToHospital(incomingPayload, body.hospitalId)
        .then(result => {
          const eventName = result.state === 'DELIVERED'
            ? 'HOSPITAL_RELAY_DELIVERED'
            : result.state === 'SKIPPED' ? 'HOSPITAL_RELAY_SKIPPED' : 'HOSPITAL_RELAY_FAILED';
          if (result.state === 'FAILED') {
            console.error(`[Hospital Relay] Could not deliver ${incidentId} to ${body.hospitalId}: ${result.reason}`);
          }
          broadcastEvent(`incident:${incidentId}`, eventName, {
            incidentId,
            hospitalId: body.hospitalId,
            hospitalName: hospital.name,
            reason: result.reason || null
          });
        })
        .catch(err => {
          console.error('[Hospital Relay] Unexpected bridge error:', err.message);
          broadcastEvent(`incident:${incidentId}`, 'HOSPITAL_RELAY_FAILED', {
            incidentId,
            hospitalId: body.hospitalId,
            hospitalName: hospital.name,
            reason: 'Unexpected bridge error'
          });
        });

      return sendJson(res, 200, {
        incidentId,
        status: 'HOSPITAL_SELECTED',
        alertId: alert.id,
        route,
        websocket: `/api/v1/navigation/live-location?incidentId=${incidentId}`
      });
    }

    // -------------------------------------------------------------
    // Hospital Relay -> Triage Relay: live updates from the hospital portal
    // (acknowledged / status changed / instruction). Protected by the relay key.
    // -------------------------------------------------------------
    if (method === 'POST' && pathName === '/api/v1/integrations/hospital-update') {
      if (!process.env.RELAY_SHARED_SECRET) {
        return sendJson(res, 503, { error: 'Relay not configured' });
      }
      if (!relayKeyMatches(req.headers['x-relay-key'])) {
        return sendJson(res, 401, { error: 'Unauthorized', details: [{ field: 'X-Relay-Key', message: 'Missing or invalid relay key' }] });
      }

      const body = await parseBody(req);
      const ALLOWED_EVENTS = ['ACKNOWLEDGED', 'STATUS_CHANGED', 'INSTRUCTION'];
      const ALLOWED_STATUS = ['NEW', 'RECEIVED', 'PREPARING', 'READY', 'UNABLE_TO_RECEIVE', 'PATIENT_ARRIVED', 'HANDOVER_COMPLETE', 'CANCELLED'];
      const cleanText = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);

      const problems = [];
      if (typeof body.incidentId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.incidentId)) {
        problems.push({ field: 'incidentId', message: 'incidentId is required (letters, numbers, - and _ only)' });
      }
      if (!ALLOWED_EVENTS.includes(body.event)) {
        problems.push({ field: 'event', message: `event must be one of ${ALLOWED_EVENTS.join(', ')}` });
      }
      if (body.status !== undefined && !ALLOWED_STATUS.includes(body.status)) {
        problems.push({ field: 'status', message: 'status is not a valid hospital response status' });
      }
      if (problems.length > 0) {
        return sendJson(res, 400, { error: 'Validation failed', details: problems });
      }

      const update = {
        incidentId: body.incidentId,
        event: body.event,
        status: body.status || null,
        actor: cleanText(body.actor, 100),
        instruction: cleanText(body.instruction, 2000),
        reasonCode: cleanText(body.reason_code, 50),
        reasonNote: cleanText(body.reason_note, 500)
      };

      broadcastEvent(`incident:${update.incidentId}`, 'HOSPITAL_UPDATE', update);
      if (update.event === 'ACKNOWLEDGED') {
        // Keep the existing paramedic-side listener working too.
        broadcastEvent(`incident:${update.incidentId}`, 'HOSPITAL_ACK', {
          incidentId: update.incidentId,
          ackBy: update.actor || 'Hospital staff'
        });
      }
      return sendJson(res, 200, { received: true });
    }

    // -------------------------------------------------------------
    // Hospital Actions: ACK, Assign Bed, Arrive
    // -------------------------------------------------------------
    const ackMatch = pathName.match(/^\/api\/v1\/incidents\/([^/]+)\/ack$/);
    if (method === 'POST' && ackMatch) {
      const incidentId = ackMatch[1];
      const body = await parseBody(req);
      const alert = await dbStore.acknowledgeAlert(incidentId, body.userId || 'usr_er_1');

      broadcastEvent(`incident:${incidentId}`, 'HOSPITAL_ACK', {
        incidentId,
        ackBy: body.userId || 'Dr. Rao (ER Staff)'
      });

      return sendJson(res, 200, alert);
    }

    const assignBedMatch = pathName.match(/^\/api\/v1\/incidents\/([^/]+)\/assign-bed$/);
    if (method === 'POST' && assignBedMatch) {
      const incidentId = assignBedMatch[1];
      const body = await parseBody(req);
      const alert = await dbStore.assignBed(incidentId, body.bedType, body.bedLabel);

      broadcastEvent(`incident:${incidentId}`, 'BED_ASSIGNED', {
        incidentId,
        bedType: body.bedType,
        bedLabel: body.bedLabel
      });

      return sendJson(res, 200, alert);
    }

    const arriveMatch = pathName.match(/^\/api\/v1\/incidents\/([^/]+)\/arrive$/);
    if (method === 'POST' && arriveMatch) {
      const incidentId = arriveMatch[1];
      const incident = await dbStore.markIncidentArrived(incidentId);

      broadcastEvent(`incident:${incidentId}`, 'INCIDENT_STATUS', {
        incidentId,
        status: 'ARRIVED'
      });

      return sendJson(res, 200, incident);
    }

    // -------------------------------------------------------------
    // Navigation & Routing Endpoints
    // -------------------------------------------------------------
    if (method === 'GET' && pathName === '/api/v1/navigation/route') {
      const incidentId = query.incidentId;
      const incident = await dbStore.getIncidentById(incidentId);
      if (!incident || !incident.selectedHospitalId) {
        return sendJson(res, 404, { error: 'Incident or selected hospital not found' });
      }

      const hospital = await dbStore.getHospitalById(incident.selectedHospitalId);
      const route = await routingService.getRoute(
        incident.sceneLocation,
        hospital.edEntranceCoordinates || hospital.coordinates
      );
      return sendJson(res, 200, route);
    }

    if (method === 'POST' && pathName === '/api/v1/navigation/reroute') {
      const body = await parseBody(req);
      const incident = await dbStore.getIncidentById(body.incidentId);
      const hospital = await dbStore.getHospitalById(incident.selectedHospitalId);
      const newRoute = await routingService.getRoute(
        incident.sceneLocation,
        hospital.edEntranceCoordinates || hospital.coordinates
      );

      broadcastEvent(`incident:${body.incidentId}`, 'ROUTE_UPDATE', {
        reason: body.reason || 'MANUAL',
        route: newRoute
      });

      return sendJson(res, 200, newRoute);
    }

    // -------------------------------------------------------------
    // Admin & Audit Log Endpoint
    // -------------------------------------------------------------
    if (method === 'GET' && pathName === '/api/v1/admin/audit-logs') {
      return sendJson(res, 200, await dbStore.getAuditLogs(query.limit || 50));
    }

    // 404 Not Found
    return sendJson(res, 404, { error: 'Endpoint Not Found', path: pathName });
  } catch (err) {
    console.error('Server error:', err);
    return sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
});

// Start server if executed directly
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[Triage Relay API Server] Listening on http://localhost:${PORT}`);
    console.log(`[Triage Relay API Server] Realtime Alert Stream: http://localhost:${PORT}/api/v1/events`);
  });
}

module.exports = { server };
