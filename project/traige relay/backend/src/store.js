/**
 * Triage Relay: PostgreSQL Database Store & Repository
 * Source: 06_DATABASE_AND_API_SCHEMA.md
 *
 * Replaces the in-memory store with PostgreSQL 16 + PostGIS database operations.
 * Implements full persistence for hospitals, incidents, patient intake, vitals,
 * bed inventory, alerts, and compliance audit logs.
 */

const fs = require('fs');
const path = require('path');
const { query } = require('./db');
const { IncidentStatus } = require('./types');
const { calculateGcsTotal, calculateRtsTriage, calculateRtsWeighted } = require('./triage');

class DatabaseStore {
  constructor() {
    this.users = [];
    this.loadFallbackUsers();
  }

  loadFallbackUsers() {
    try {
      const usersPath = path.resolve(__dirname, '../../dataset/users.json');
      if (fs.existsSync(usersPath)) {
        this.users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      }
    } catch (err) {
      console.warn('[DB Store] Could not load fallback users.json:', err.message);
    }
  }

  // --- Row Mappers ---
  mapHospital(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      coordinates: {
        lat: Number(row.lat),
        lng: Number(row.lng)
      },
      edEntranceCoordinates: {
        lat: Number(row.ed_lat),
        lng: Number(row.ed_lng)
      },
      arrivalRadiusM: row.arrival_radius_m || 50,
      status: row.status,
      edOccupancyPercent: row.ed_occupancy_percent !== null && row.ed_occupancy_percent !== undefined ? Number(row.ed_occupancy_percent) : 0,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : (row.capabilities ? JSON.parse(row.capabilities) : []),
      bedInventory: typeof row.bed_inventory === 'object' && row.bed_inventory !== null ? row.bed_inventory : (row.bed_inventory ? JSON.parse(row.bed_inventory) : {}),
      bedsUpdatedAt: row.beds_updated_at ? new Date(row.beds_updated_at).toISOString() : (row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString())
    };
  }

  mapIncident(row) {
    if (!row) return null;
    return {
      id: row.id,
      ambulanceId: row.ambulance_id,
      dispatcherId: row.dispatcher_id,
      paramedicId: row.paramedic_id,
      status: row.status,
      sceneLocation: {
        lat: Number(row.scene_lat || 30.3110),
        lng: Number(row.scene_lng || 78.0280)
      },
      sceneAddress: row.scene_address || 'Scene Location',
      patient: row.patient_id ? {
        id: row.patient_id,
        fullName: row.full_name || 'Unknown',
        ageYears: row.age_years !== null && row.age_years !== undefined ? Number(row.age_years) : null,
        sex: row.sex || 'UNKNOWN',
        weightKg: row.weight_kg !== null && row.weight_kg !== undefined ? Number(row.weight_kg) : null,
        isPediatric: Boolean(row.is_pediatric)
      } : {
        fullName: 'Unknown',
        ageYears: null,
        sex: 'UNKNOWN',
        isPediatric: false
      },
      acuity: {
        esiLevel: row.esi_level !== null && row.esi_level !== undefined ? Number(row.esi_level) : null,
        esiSuggested: row.esi_suggested !== null && row.esi_suggested !== undefined ? Number(row.esi_suggested) : null
      },
      traumaTypes: Array.isArray(row.trauma_types) ? row.trauma_types : [],
      mechanism: row.mechanism || null,
      notes: row.notes || null,
      selectedHospitalId: row.selected_hospital_id || null,
      overrideReasonCode: row.override_reason_code || null,
      overrideNote: row.override_note || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      pickedUpAt: row.picked_up_at ? new Date(row.picked_up_at).toISOString() : null,
      hospitalSelectedAt: row.hospital_selected_at ? new Date(row.hospital_selected_at).toISOString() : null,
      arrivedAt: row.arrived_at ? new Date(row.arrived_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
    };
  }

  mapVitals(row) {
    if (!row) return null;
    return {
      id: row.id,
      incidentId: row.incident_id,
      takenAt: row.taken_at ? new Date(row.taken_at).toISOString() : new Date().toISOString(),
      sbp: row.sbp !== null && row.sbp !== undefined ? Number(row.sbp) : null,
      dbp: row.dbp !== null && row.dbp !== undefined ? Number(row.dbp) : null,
      heartRate: row.heart_rate !== null && row.heart_rate !== undefined ? Number(row.heart_rate) : null,
      respiratoryRate: row.respiratory_rate !== null && row.respiratory_rate !== undefined ? Number(row.respiratory_rate) : null,
      spo2: row.spo2 !== null && row.spo2 !== undefined ? Number(row.spo2) : null,
      temperatureC: row.temperature_c !== null && row.temperature_c !== undefined ? Number(row.temperature_c) : null,
      glucoseMgDl: row.glucose_mg_dl !== null && row.glucose_mg_dl !== undefined ? Number(row.glucose_mg_dl) : null,
      gcsEye: row.gcs_eye !== null && row.gcs_eye !== undefined ? Number(row.gcs_eye) : null,
      gcsVerbal: row.gcs_verbal !== null && row.gcs_verbal !== undefined ? Number(row.gcs_verbal) : null,
      gcsMotor: row.gcs_motor !== null && row.gcs_motor !== undefined ? Number(row.gcs_motor) : null,
      gcsTotal: row.gcs_total !== null && row.gcs_total !== undefined ? Number(row.gcs_total) : null,
      rtsTriage: row.rts_triage !== null && row.rts_triage !== undefined ? Number(row.rts_triage) : null,
      rtsWeighted: row.rts_weighted !== null && row.rts_weighted !== undefined ? Number(row.rts_weighted) : null
    };
  }

  mapAlert(row) {
    if (!row) return null;
    let assignedBed = null;
    if (row.assigned_bed) {
      assignedBed = typeof row.assigned_bed === 'object' ? row.assigned_bed : JSON.parse(row.assigned_bed);
    }
    return {
      id: row.id,
      incidentId: row.incident_id,
      hospitalId: row.hospital_id,
      sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : new Date().toISOString(),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : null,
      acknowledgedBy: row.acknowledged_by || null,
      assignedBed
    };
  }

  mapAudit(row) {
    if (!row) return null;
    return {
      id: Number(row.id),
      ts: row.ts ? new Date(row.ts).toISOString() : new Date().toISOString(),
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      details: typeof row.details === 'object' && row.details !== null ? row.details : (row.details ? JSON.parse(row.details) : {}),
      userId: row.user_id || 'SYSTEM'
    };
  }

  mapUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      hospitalId: row.hospital_id,
      ambulanceId: row.ambulance_id,
      isActive: row.is_active
    };
  }

  // --- Hospitals ---
  async getAllHospitals() {
    const res = await query(`
      SELECT 
        h.id,
        h.name,
        h.address,
        h.phone,
        ST_Y(h.location::geometry) AS lat,
        ST_X(h.location::geometry) AS lng,
        ST_Y(h.ed_entrance_location::geometry) AS ed_lat,
        ST_X(h.ed_entrance_location::geometry) AS ed_lng,
        h.arrival_radius_m,
        h.status,
        h.ed_occupancy_percent,
        h.updated_at,
        COALESCE(
          (SELECT json_agg(c.tag ORDER BY c.tag) FROM hospital_capabilities c WHERE c.hospital_id = h.id),
          '[]'::json
        ) AS capabilities,
        COALESCE(
          (SELECT json_object_agg(b.bed_type, json_build_object('total', b.total, 'available', b.available))
           FROM bed_inventory b WHERE b.hospital_id = h.id),
          '{}'::json
        ) AS bed_inventory,
        (SELECT MAX(b.updated_at) FROM bed_inventory b WHERE b.hospital_id = h.id) AS beds_updated_at
      FROM hospitals h
      ORDER BY h.id;
    `);
    return res.rows.map(r => this.mapHospital(r));
  }

  async getHospitalById(id) {
    const res = await query(`
      SELECT 
        h.id,
        h.name,
        h.address,
        h.phone,
        ST_Y(h.location::geometry) AS lat,
        ST_X(h.location::geometry) AS lng,
        ST_Y(h.ed_entrance_location::geometry) AS ed_lat,
        ST_X(h.ed_entrance_location::geometry) AS ed_lng,
        h.arrival_radius_m,
        h.status,
        h.ed_occupancy_percent,
        h.updated_at,
        COALESCE(
          (SELECT json_agg(c.tag ORDER BY c.tag) FROM hospital_capabilities c WHERE c.hospital_id = h.id),
          '[]'::json
        ) AS capabilities,
        COALESCE(
          (SELECT json_object_agg(b.bed_type, json_build_object('total', b.total, 'available', b.available))
           FROM bed_inventory b WHERE b.hospital_id = h.id),
          '{}'::json
        ) AS bed_inventory,
        (SELECT MAX(b.updated_at) FROM bed_inventory b WHERE b.hospital_id = h.id) AS beds_updated_at
      FROM hospitals h
      WHERE h.id = $1;
    `, [id]);
    return res.rows.length > 0 ? this.mapHospital(res.rows[0]) : null;
  }

  async updateHospitalBeds(hospitalId, beds) {
    for (const [bedType, count] of Object.entries(beds || {})) {
      const total = count.total !== undefined ? count.total : null;
      const available = count.available !== undefined ? count.available : null;

      await query(`
        INSERT INTO bed_inventory (hospital_id, bed_type, total, available, updated_at)
        VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), now())
        ON CONFLICT (hospital_id, bed_type)
        DO UPDATE SET
          total = CASE WHEN $3::int IS NOT NULL THEN $3::int ELSE bed_inventory.total END,
          available = CASE WHEN $4::int IS NOT NULL THEN $4::int ELSE bed_inventory.available END,
          updated_at = now()
      `, [hospitalId, bedType, total, available]);
    }
    await this.logAudit('UPDATE_BEDS', 'HOSPITAL', hospitalId, { beds });
    return await this.getHospitalById(hospitalId);
  }

  async updateHospitalStatus(hospitalId, status) {
    await query(`
      UPDATE hospitals
      SET status = $2, updated_at = now()
      WHERE id = $1
    `, [hospitalId, status]);
    await this.logAudit('UPDATE_HOSPITAL_STATUS', 'HOSPITAL', hospitalId, { status });
    return await this.getHospitalById(hospitalId);
  }

  // --- Incidents ---
  async getIncidentById(id) {
    const res = await query(`
      SELECT 
        i.id,
        i.ambulance_id,
        i.dispatcher_id,
        i.paramedic_id,
        i.status,
        ST_Y(i.scene_location::geometry) AS scene_lat,
        ST_X(i.scene_location::geometry) AS scene_lng,
        i.scene_address,
        i.esi_level,
        i.esi_suggested,
        i.trauma_types,
        i.mechanism,
        i.notes,
        i.selected_hospital_id,
        i.override_reason_code,
        i.override_note,
        i.created_at,
        i.picked_up_at,
        i.hospital_selected_at,
        i.arrived_at,
        i.updated_at,
        p.id AS patient_id,
        p.full_name,
        p.age_years,
        p.sex,
        p.weight_kg,
        p.is_pediatric
      FROM incidents i
      LEFT JOIN patients p ON p.incident_id = i.id
      WHERE i.id = $1;
    `, [id]);
    return res.rows.length > 0 ? this.mapIncident(res.rows[0]) : null;
  }

  async getAllIncidents() {
    const res = await query(`
      SELECT 
        i.id,
        i.ambulance_id,
        i.dispatcher_id,
        i.paramedic_id,
        i.status,
        ST_Y(i.scene_location::geometry) AS scene_lat,
        ST_X(i.scene_location::geometry) AS scene_lng,
        i.scene_address,
        i.esi_level,
        i.esi_suggested,
        i.trauma_types,
        i.mechanism,
        i.notes,
        i.selected_hospital_id,
        i.override_reason_code,
        i.override_note,
        i.created_at,
        i.picked_up_at,
        i.hospital_selected_at,
        i.arrived_at,
        i.updated_at,
        p.id AS patient_id,
        p.full_name,
        p.age_years,
        p.sex,
        p.weight_kg,
        p.is_pediatric
      FROM incidents i
      LEFT JOIN patients p ON p.incident_id = i.id
      ORDER BY i.created_at DESC;
    `);
    return res.rows.map(r => this.mapIncident(r));
  }

  async createIncident(data = {}) {
    const id = data.id || `inc_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
    const ambulanceId = data.ambulanceId || 'amb_108_014';
    const dispatcherId = data.dispatcherId || 'usr_dispatcher_1';
    const paramedicId = data.paramedicId || 'usr_paramedic_1';
    const status = data.status || IncidentStatus.CREATED;
    const lat = data.sceneLocation?.lat ?? 30.3110;
    const lng = data.sceneLocation?.lng ?? 78.0280;
    const address = data.sceneAddress || 'Scene Location';

    await query(`
      INSERT INTO incidents (
        id, ambulance_id, dispatcher_id, paramedic_id, status,
        scene_location, scene_address, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography, $8, now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET updated_at = now()
    `, [id, ambulanceId, dispatcherId, paramedicId, status, lat, lng, address]);

    const pat = data.patient || {};
    const patId = pat.id || `pat_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
    const fullName = pat.fullName || pat.name || 'Unknown';
    const ageYears = pat.ageYears !== undefined ? pat.ageYears : null;
    const sex = pat.sex || 'UNKNOWN';
    const weightKg = pat.weightKg !== undefined ? pat.weightKg : null;

    await query(`
      INSERT INTO patients (id, incident_id, full_name, age_years, sex, weight_kg)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (incident_id) DO NOTHING
    `, [patId, id, fullName, ageYears, sex, weightKg]);

    await this.logAudit('CREATE_INCIDENT', 'INCIDENT', id, { ambulanceId });
    return await this.getIncidentById(id);
  }

  async updateIncidentIntake(id, intake) {
    let existing = await this.getIncidentById(id);
    if (!existing) {
      existing = await this.createIncident({ id });
    }

    const traumaTypes = intake.traumaTypes || null;
    const mechanism = intake.mechanism || null;
    const notes = intake.notes || null;
    const esiLevel = intake.acuity?.esiLevel || null;
    const esiSuggested = intake.acuity?.esiSuggested || null;

    await query(`
      UPDATE incidents
      SET
        trauma_types = COALESCE($2, trauma_types),
        mechanism = COALESCE($3, mechanism),
        notes = COALESCE($4, notes),
        esi_level = COALESCE($5, esi_level),
        esi_suggested = COALESCE($6, esi_suggested),
        status = 'INTAKE_DONE',
        updated_at = now()
      WHERE id = $1
    `, [id, traumaTypes, mechanism, notes, esiLevel, esiSuggested]);

    if (intake.patient) {
      const p = intake.patient;
      const patId = p.id || `pat_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
      const fullName = p.fullName || p.name || 'Unknown';
      const ageYears = p.ageYears !== undefined ? p.ageYears : null;
      const sex = p.sex || 'UNKNOWN';
      const weightKg = p.weightKg !== undefined ? p.weightKg : null;

      await query(`
        INSERT INTO patients (id, incident_id, full_name, age_years, sex, weight_kg)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (incident_id) DO UPDATE SET
          full_name = COALESCE(EXCLUDED.full_name, patients.full_name),
          age_years = COALESCE(EXCLUDED.age_years, patients.age_years),
          sex = COALESCE(EXCLUDED.sex, patients.sex),
          weight_kg = COALESCE(EXCLUDED.weight_kg, patients.weight_kg)
      `, [patId, id, fullName, ageYears, sex, weightKg]);
    }

    if (intake.vitals) {
      await this.addVitalsReading(id, {
        ...intake.vitals,
        gcsEye: intake.gcs?.eye,
        gcsVerbal: intake.gcs?.verbal,
        gcsMotor: intake.gcs?.motor
      });
    }

    await this.logAudit('UPDATE_INTAKE', 'INCIDENT', id, { traumaTypes: intake.traumaTypes });
    return await this.getIncidentById(id);
  }

  // --- Vitals Readings ---
  async addVitalsReading(incidentId, vitalsData) {
    const readingId = vitalsData.id || `vit_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
    const recordedBy = vitalsData.recordedBy || vitalsData.recorded_by || 'usr_paramedic_1';
    const sbp = vitalsData.sbp !== undefined && vitalsData.sbp !== null ? vitalsData.sbp : null;
    const dbp = vitalsData.dbp !== undefined && vitalsData.dbp !== null ? vitalsData.dbp : null;
    const heartRate = vitalsData.heartRate ?? vitalsData.heart_rate ?? null;
    const respiratoryRate = vitalsData.respiratoryRate ?? vitalsData.respiratory_rate ?? null;
    const spo2 = vitalsData.spo2 !== undefined && vitalsData.spo2 !== null ? vitalsData.spo2 : null;
    const tempC = vitalsData.temperatureC ?? vitalsData.temperature_c ?? null;
    const glucose = vitalsData.glucoseMgDl ?? vitalsData.glucose_mg_dl ?? null;
    const gcsEye = vitalsData.gcsEye ?? vitalsData.gcs_eye ?? null;
    const gcsVerbal = vitalsData.gcsVerbal ?? vitalsData.gcs_verbal ?? null;
    const gcsMotor = vitalsData.gcsMotor ?? vitalsData.gcs_motor ?? null;
    const gcsTotal = vitalsData.gcsTotal ?? vitalsData.gcs_total ?? (gcsEye !== null && gcsVerbal !== null && gcsMotor !== null ? calculateGcsTotal(gcsEye, gcsVerbal, gcsMotor) : null);
    const rtsTriage = vitalsData.rtsTriage ?? vitalsData.rts_triage ?? (gcsTotal !== null && sbp !== null && respiratoryRate !== null ? calculateRtsTriage(gcsTotal, sbp, respiratoryRate) : null);
    const rtsWeighted = vitalsData.rtsWeighted ?? vitalsData.rts_weighted ?? (gcsTotal !== null && sbp !== null && respiratoryRate !== null ? calculateRtsWeighted(gcsTotal, sbp, respiratoryRate) : null);

    const res = await query(`
      INSERT INTO vitals_readings (
        id, incident_id, taken_at, recorded_by,
        sbp, dbp, heart_rate, respiratory_rate, spo2, temperature_c, glucose_mg_dl,
        gcs_eye, gcs_verbal, gcs_motor, gcs_total, rts_triage, rts_weighted
      ) VALUES (
        $1, $2, now(), $3,
        $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `, [
      readingId, incidentId, recordedBy,
      sbp, dbp, heartRate, respiratoryRate, spo2, tempC, glucose,
      gcsEye, gcsVerbal, gcsMotor, gcsTotal, rtsTriage, rtsWeighted
    ]);

    return this.mapVitals(res.rows[0]);
  }

  async getVitalsForIncident(incidentId) {
    const res = await query(`
      SELECT * FROM vitals_readings
      WHERE incident_id = $1
      ORDER BY taken_at ASC
    `, [incidentId]);
    return res.rows.map(r => this.mapVitals(r));
  }

  // --- Hospital Selection & Pre-Alerts ---
  async selectHospitalForIncident(incidentId, hospitalId, override = null) {
    let existing = await this.getIncidentById(incidentId);
    if (!existing) {
      existing = await this.createIncident({ id: incidentId });
    }

    const reasonCode = override?.reasonCode || null;
    const overrideNote = override?.note || override?.notes || null;

    await query(`
      UPDATE incidents
      SET
        selected_hospital_id = $2,
        status = 'HOSPITAL_SELECTED',
        hospital_selected_at = now(),
        override_reason_code = $3,
        override_note = $4,
        updated_at = now()
      WHERE id = $1
    `, [incidentId, hospitalId, reasonCode, overrideNote]);

    const alertId = `alr_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
    const alertRes = await query(`
      INSERT INTO alerts (id, incident_id, hospital_id, sent_at)
      VALUES ($1, $2, $3, now())
      RETURNING *
    `, [alertId, incidentId, hospitalId]);

    await this.logAudit('SELECT_HOSPITAL', 'INCIDENT', incidentId, { hospitalId, override });
    const incident = await this.getIncidentById(incidentId);
    const alert = this.mapAlert(alertRes.rows[0]);
    return { incident, alert };
  }

  async getIncomingForHospital(hospitalId) {
    const incRes = await query(`
      SELECT 
        i.id,
        i.ambulance_id,
        i.dispatcher_id,
        i.paramedic_id,
        i.status,
        ST_Y(i.scene_location::geometry) AS scene_lat,
        ST_X(i.scene_location::geometry) AS scene_lng,
        i.scene_address,
        i.esi_level,
        i.esi_suggested,
        i.trauma_types,
        i.mechanism,
        i.notes,
        i.selected_hospital_id,
        i.override_reason_code,
        i.override_note,
        i.created_at,
        i.picked_up_at,
        i.hospital_selected_at,
        i.arrived_at,
        i.updated_at,
        p.id AS patient_id,
        p.full_name,
        p.age_years,
        p.sex,
        p.weight_kg,
        p.is_pediatric
      FROM incidents i
      LEFT JOIN patients p ON p.incident_id = i.id
      WHERE i.selected_hospital_id = $1
        AND i.status IN ('HOSPITAL_SELECTED', 'EN_ROUTE', 'ARRIVING')
      ORDER BY i.created_at DESC
    `, [hospitalId]);

    const activeIncidents = [];
    for (const row of incRes.rows) {
      const inc = this.mapIncident(row);
      const vitals = await this.getVitalsForIncident(inc.id);
      const lastVitals = vitals[vitals.length - 1] || null;

      const alertRes = await query(`
        SELECT * FROM alerts
        WHERE incident_id = $1 AND hospital_id = $2
        ORDER BY sent_at DESC
        LIMIT 1
      `, [inc.id, hospitalId]);
      const alert = alertRes.rows.length > 0 ? this.mapAlert(alertRes.rows[0]) : null;

      activeIncidents.push({
        incident: inc,
        vitalsHistory: vitals,
        lastVitals,
        alert
      });
    }

    return activeIncidents;
  }

  async acknowledgeAlert(incidentId, userId = 'usr_er_1') {
    const res = await query(`
      UPDATE alerts
      SET acknowledged_at = now(), acknowledged_by = $2
      WHERE incident_id = $1
      RETURNING *
    `, [incidentId, userId]);

    if (res.rows.length > 0) {
      const alert = this.mapAlert(res.rows[0]);
      await this.logAudit('ACK_ALERT', 'ALERT', alert.id, { userId });
      return alert;
    }
    return null;
  }

  async assignBed(incidentId, bedType, bedLabel) {
    const bedPayload = {
      bedType,
      bedLabel,
      assignedAt: new Date().toISOString()
    };

    const res = await query(`
      UPDATE alerts
      SET assigned_bed = $2
      WHERE incident_id = $1
      RETURNING *
    `, [incidentId, JSON.stringify(bedPayload)]);

    if (res.rows.length > 0) {
      const alert = this.mapAlert(res.rows[0]);
      // Decrement available beds in bed_inventory
      await query(`
        UPDATE bed_inventory
        SET available = GREATEST(0, available - 1), updated_at = now()
        WHERE hospital_id = $1 AND bed_type = $2
      `, [alert.hospitalId, bedType]);

      await this.logAudit('ASSIGN_BED', 'INCIDENT', incidentId, { bedType, bedLabel });
      return alert;
    }
    return null;
  }

  async markIncidentArrived(incidentId) {
    const res = await query(`
      UPDATE incidents
      SET status = 'ARRIVED', arrived_at = now(), updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [incidentId]);

    if (res.rows.length > 0) {
      await this.logAudit('MARK_ARRIVED', 'INCIDENT', incidentId, {});
      return await this.getIncidentById(incidentId);
    }
    return null;
  }

  // --- Audit Logs ---
  async logAudit(action, entity, entityId, details = {}, userId = 'SYSTEM') {
    try {
      const res = await query(`
        INSERT INTO audit_logs (action, entity, entity_id, details, user_id, ts)
        VALUES ($1, $2, $3, $4, $5, now())
        RETURNING *
      `, [action, entity, entityId, JSON.stringify(details), userId]);
      return this.mapAudit(res.rows[0]);
    } catch (err) {
      console.error('[DB Store] logAudit error:', err.message);
      return null;
    }
  }

  async getAuditLogs(limit = 50) {
    const lim = parseInt(limit, 10) || 50;
    const res = await query(`
      SELECT * FROM audit_logs
      ORDER BY id DESC
      LIMIT $1
    `, [lim]);
    return res.rows.map(r => this.mapAudit(r));
  }

  // --- Users ---
  async getUserByEmail(email) {
    try {
      const res = await query(`
        SELECT id, email, full_name, role, hospital_id, ambulance_id, is_active
        FROM users
        WHERE email = $1
      `, [email]);
      if (res.rows.length > 0) {
        return this.mapUser(res.rows[0]);
      }
    } catch (err) {
      console.warn('[DB Store] Error querying user by email:', err.message);
    }
    return this.users.find(u => u.email === email) || null;
  }
}

// Singleton database store instance
const dbStore = new DatabaseStore();

module.exports = {
  DatabaseStore,
  dbStore
};
