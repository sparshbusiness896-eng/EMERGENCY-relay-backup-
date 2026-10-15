/**
 * In-Memory Hospital State Management & Event Broker
 * Pre-populated with datasets from data-set/seed
 */

const path = require('path');
const dataset = require('../../../data-set/index.js');

class HospitalStore {
  constructor() {
    this.reset();
    this.sseClients = new Set();
  }

  reset() {
    this.hospitals = JSON.parse(JSON.stringify(dataset.getHospitals()));
    this.staff = JSON.parse(JSON.stringify(dataset.getStaff()));
    this.cases = JSON.parse(JSON.stringify(dataset.getCases()));
    this.capacity = JSON.parse(JSON.stringify(dataset.getCapacity()));
    this.resources = JSON.parse(JSON.stringify(dataset.getResources()));
    this.templates = JSON.parse(JSON.stringify(dataset.getQuickTemplates()));
    this.auditLogs = JSON.parse(JSON.stringify(dataset.getAuditLogs()));
    this.processedIdempotencyKeys = new Set(this.cases.map(c => c.idempotency_key).filter(Boolean));
  }

  // --- SSE Broadcasting ---
  subscribe(res) {
    this.sseClients.add(res);
  }

  unsubscribe(res) {
    this.sseClients.delete(res);
  }

  broadcast(eventType, payload) {
    const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(data);
      } catch (err) {
        this.sseClients.delete(client);
      }
    }
  }

  // --- Audit Logging ---
  addAuditLog({ userId = 'usr_marcus_vance', userName = 'Marcus Vance, BSN, RN', role = 'EMERGENCY_STAFF', action, targetType, targetId, details = {}, outcome = 'SUCCESS', ip = '127.0.0.1' }) {
    const entry = {
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      hospital_id: 'hosp_metro_01',
      user_id: userId,
      user_name: userName,
      role: role,
      action: action,
      target_type: targetType,
      target_id: targetId,
      details: details,
      outcome: outcome,
      ip_address: ip,
      occurred_at: new Date().toISOString()
    };
    this.auditLogs.unshift(entry);
    return entry;
  }

  // --- Hospital Profile ---
  getHospital(id = 'hosp_metro_01') {
    return this.hospitals.find(h => h.id === id) || this.hospitals[0];
  }

  updateHospital(id, updates) {
    const hosp = this.getHospital(id);
    if (!hosp) return null;
    Object.assign(hosp, updates, { updated_at: new Date().toISOString() });
    this.addAuditLog({
      action: 'HOSPITAL_PROFILE_UPDATED',
      targetType: 'HOSPITAL',
      targetId: id,
      details: updates
    });
    return hosp;
  }

  // --- Cases ---
  getCases(filters = {}) {
    let list = [...this.cases];
    if (filters.status) {
      if (filters.status === 'ACTIVE') {
        list = list.filter(c => !['HANDOVER_COMPLETE', 'CANCELLED', 'UNABLE_TO_RECEIVE'].includes(c.response_status));
      } else if (filters.status === 'HISTORY') {
        list = list.filter(c => ['HANDOVER_COMPLETE', 'CANCELLED', 'UNABLE_TO_RECEIVE'].includes(c.response_status));
      } else {
        list = list.filter(c => c.response_status === filters.status);
      }
    }
    if (filters.priority) {
      list = list.filter(c => c.priority === filters.priority);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(c =>
        c.case_id.toLowerCase().includes(q) ||
        c.emergency_type.toLowerCase().includes(q) ||
        (c.paramedic && c.paramedic.unit_id.toLowerCase().includes(q))
      );
    }

    // Sort: CRITICAL first, then NEW status, then earliest ETA
    const priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNSPECIFIED: 0 };
    list.sort((a, b) => {
      const pDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (pDiff !== 0) return pDiff;
      if (a.response_status === 'NEW' && b.response_status !== 'NEW') return -1;
      if (b.response_status === 'NEW' && a.response_status !== 'NEW') return 1;
      return new Date(a.eta || 0) - new Date(b.eta || 0);
    });

    return list;
  }

  getCase(caseId) {
    return this.cases.find(c => c.case_id === caseId);
  }

  createCase(caseData) {
    const { idempotency_key, case_id } = caseData;
    
    // Idempotency check
    if (idempotency_key && this.processedIdempotencyKeys.has(idempotency_key)) {
      const existing = this.cases.find(c => c.idempotency_key === idempotency_key || c.case_id === case_id);
      return { duplicate: true, case: existing };
    }

    const now = new Date().toISOString();
    const newCase = {
      case_id: case_id || `case_${Math.random().toString(16).substring(2, 10)}`,
      idempotency_key: idempotency_key || `key_${Date.now()}`,
      version: caseData.version || 1,
      hospital_id: caseData.hospital_id || 'hosp_metro_01',
      source: caseData.source || 'MANUAL',
      submitted_at: caseData.submitted_at || now,
      received_at: now,
      priority: caseData.priority || 'CRITICAL',
      emergency_type: caseData.emergency_type || 'Acute Medical Emergency',
      patient_condition_summary: caseData.patient_condition_summary || 'Urgent medical intervention requested',
      patient: caseData.patient || { age: 40, age_group: 'ADULT', sex: 'unknown', identifier: null },
      vital_signs: caseData.vital_signs || [],
      notes: caseData.notes || '',
      treatment_given: caseData.treatment_given || '',
      paramedic: caseData.paramedic || { unit_id: 'MEDIC-RELAY-01', name_or_code: 'Paramedic Dispatch', callback_phone: '+1 (555) 911-0000' },
      eta: caseData.eta || new Date(Date.now() + 15 * 60000).toISOString(),
      delivery_state: 'DELIVERED',
      response_status: 'NEW',
      acknowledged_by: null,
      resources_requested: caseData.resources_requested || [],
      instructions_to_paramedic: null,
      unable_to_receive_reason: null,
      timeline: [
        {
          timestamp: caseData.submitted_at || now,
          actor: caseData.paramedic ? caseData.paramedic.unit_id : 'Paramedic Unit',
          action: 'CASE_SUBMITTED',
          detail: 'Emergency transport submitted by field paramedic unit'
        },
        {
          timestamp: now,
          actor: 'Hospital Relay Server',
          action: 'SERVER_ACKNOWLEDGED',
          detail: 'Alert successfully validated, delivered, and displayed on live dashboard'
        }
      ]
    };

    if (newCase.idempotency_key) {
      this.processedIdempotencyKeys.add(newCase.idempotency_key);
    }

    this.cases.unshift(newCase);

    this.addAuditLog({
      action: 'CASE_RECEIVED_FROM_PARAMEDIC',
      targetType: 'CASE',
      targetId: newCase.case_id,
      details: { priority: newCase.priority, emergency_type: newCase.emergency_type, unit: newCase.paramedic.unit_id }
    });

    this.broadcast('NEW_CASE_ALERT', newCase);

    return { duplicate: false, case: newCase };
  }

  acknowledgeCase(caseId, user = { id: 'usr_marcus_vance', name: 'Marcus Vance, BSN, RN', role: 'EMERGENCY_STAFF' }) {
    const c = this.getCase(caseId);
    if (!c) return null;
    if (c.response_status === 'NEW') {
      c.response_status = 'RECEIVED';
      const now = new Date().toISOString();
      c.acknowledged_by = {
        user_id: user.id,
        user_name: user.name,
        role: user.role,
        acknowledged_at: now
      };
      c.timeline.push({
        timestamp: now,
        actor: user.name,
        action: 'STATUS_CHANGED',
        detail: `Alert acknowledged by ${user.name} (${user.role}). Response relay sent to paramedic.`
      });

      this.addAuditLog({
        userId: user.id,
        userName: user.name,
        role: user.role,
        action: 'CASE_ACKNOWLEDGED',
        targetType: 'CASE',
        targetId: caseId,
        details: { status: 'RECEIVED' }
      });

      this.broadcast('CASE_STATUS_UPDATED', c);
    }
    return c;
  }

  updateCaseStatus(caseId, newStatus, extra = {}, user = { id: 'usr_marcus_vance', name: 'Marcus Vance, BSN, RN', role: 'EMERGENCY_STAFF' }) {
    const c = this.getCase(caseId);
    if (!c) return null;

    const allowedTransitions = {
      NEW: ['RECEIVED', 'PREPARING', 'READY', 'UNABLE_TO_RECEIVE', 'CANCELLED'],
      RECEIVED: ['PREPARING', 'READY', 'UNABLE_TO_RECEIVE', 'PATIENT_ARRIVED', 'CANCELLED'],
      PREPARING: ['READY', 'UNABLE_TO_RECEIVE', 'PATIENT_ARRIVED', 'CANCELLED'],
      READY: ['PATIENT_ARRIVED', 'UNABLE_TO_RECEIVE', 'CANCELLED'],
      UNABLE_TO_RECEIVE: [],
      PATIENT_ARRIVED: ['HANDOVER_COMPLETE'],
      HANDOVER_COMPLETE: [],
      CANCELLED: []
    };

    if (!allowedTransitions[c.response_status]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${c.response_status} to ${newStatus}`);
    }

    if (newStatus === 'UNABLE_TO_RECEIVE' && !extra.reason_code) {
      throw new Error('Choosing "Unable to receive" requires a valid reason_code');
    }

    const now = new Date().toISOString();
    c.response_status = newStatus;

    if (newStatus === 'UNABLE_TO_RECEIVE') {
      c.unable_to_receive_reason = {
        reason_code: extra.reason_code,
        reason_note: extra.reason_note || ''
      };
      c.closed_at = now;
    } else if (newStatus === 'HANDOVER_COMPLETE') {
      c.closed_at = now;
    }

    let detailStr = `Status changed to ${newStatus}`;
    if (extra.reason_code) {
      detailStr += ` (Reason: ${extra.reason_code} - ${extra.reason_note || ''})`;
    }

    c.timeline.push({
      timestamp: now,
      actor: user.name,
      action: 'STATUS_CHANGED',
      detail: detailStr
    });

    this.addAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: 'CASE_STATUS_CHANGED',
      targetType: 'CASE',
      targetId: caseId,
      details: { newStatus, extra }
    });

    this.broadcast('CASE_STATUS_UPDATED', c);
    return c;
  }

  sendInstructions(caseId, instructionText, resources = [], user = { id: 'usr_marcus_vance', name: 'Marcus Vance, BSN, RN', role: 'EMERGENCY_STAFF' }) {
    const c = this.getCase(caseId);
    if (!c) return null;

    const now = new Date().toISOString();
    if (instructionText) {
      c.instructions_to_paramedic = instructionText;
    }
    if (Array.isArray(resources) && resources.length > 0) {
      c.resources_requested = resources;
    }

    c.timeline.push({
      timestamp: now,
      actor: user.name,
      action: 'INSTRUCTION_SENT',
      detail: `Relay instruction sent to ambulance unit: "${instructionText}"`
    });

    this.addAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: 'INSTRUCTION_DISPATCHED',
      targetType: 'CASE',
      targetId: caseId,
      details: { instruction: instructionText, resources }
    });

    this.broadcast('CASE_STATUS_UPDATED', c);
    return c;
  }

  // --- Capacity ---
  getCapacity() {
    const snap = { ...this.capacity };
    const recordedTime = new Date(snap.recorded_at).getTime();
    const now = Date.now();
    const diffMinutes = Math.round((now - recordedTime) / 60000);

    const threshold = snap.freshness_threshold_minutes || 30;
    let freshnessStatus = 'FRESH';
    if (diffMinutes >= threshold) {
      freshnessStatus = 'STALE';
    } else if (diffMinutes >= threshold * 0.75) {
      freshnessStatus = 'AGING';
    }

    return {
      ...snap,
      diff_minutes: diffMinutes,
      freshness_status: freshnessStatus
    };
  }

  updateCapacity(updates, user = { id: 'usr_marcus_vance', name: 'Marcus Vance, BSN, RN', role: 'EMERGENCY_STAFF' }) {
    const now = new Date().toISOString();
    this.capacity = {
      ...this.capacity,
      ...updates,
      recorded_at: now,
      recorded_by_user_id: user.id,
      recorded_by_name: user.name,
      confirmed_without_change: false
    };

    this.addAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: 'CAPACITY_UPDATED',
      targetType: 'CAPACITY',
      targetId: this.capacity.id,
      details: updates
    });

    this.broadcast('CAPACITY_UPDATED', this.getCapacity());
    return this.getCapacity();
  }

  confirmCapacityAccurate(user = { id: 'usr_marcus_vance', name: 'Marcus Vance, BSN, RN', role: 'EMERGENCY_STAFF' }) {
    const now = new Date().toISOString();
    this.capacity.recorded_at = now;
    this.capacity.recorded_by_user_id = user.id;
    this.capacity.recorded_by_name = user.name;
    this.capacity.confirmed_without_change = true;

    this.addAuditLog({
      userId: user.id,
      userName: user.name,
      role: user.role,
      action: 'CAPACITY_CONFIRMED_STILL_ACCURATE',
      targetType: 'CAPACITY',
      targetId: this.capacity.id,
      details: { confirmed: true }
    });

    this.broadcast('CAPACITY_UPDATED', this.getCapacity());
    return this.getCapacity();
  }

  // --- Resources ---
  getResources() {
    return this.resources;
  }

  updateResource(category, id, updates) {
    if (category === 'specialists') {
      const item = this.resources.specialists.find(s => s.id === id);
      if (item) Object.assign(item, updates, { updated_at: new Date().toISOString() });
    } else if (category === 'equipment') {
      const item = this.resources.equipment.find(e => e.id === id);
      if (item) Object.assign(item, updates, { updated_at: new Date().toISOString() });
    }
    this.broadcast('RESOURCES_UPDATED', this.resources);
    return this.resources;
  }

  // --- Staff ---
  getStaff() {
    return this.staff;
  }

  inviteStaff({ full_name, email, role, title }) {
    const newStaff = {
      id: `usr_${Date.now()}`,
      hospital_id: 'hosp_metro_01',
      full_name,
      email,
      role: role || 'EMERGENCY_STAFF',
      title: title || 'Emergency Clinical Staff',
      status: 'INVITED',
      second_factor_enabled: false,
      last_sign_in_at: null
    };
    this.staff.push(newStaff);
    this.addAuditLog({
      action: 'STAFF_INVITED',
      targetType: 'STAFF',
      targetId: newStaff.id,
      details: { email, role }
    });
    return newStaff;
  }

  updateStaff(id, updates) {
    const member = this.staff.find(s => s.id === id);
    if (!member) return null;
    Object.assign(member, updates);
    this.addAuditLog({
      action: 'STAFF_ROLE_OR_STATUS_MODIFIED',
      targetType: 'STAFF',
      targetId: id,
      details: updates
    });
    return member;
  }

  // --- Audit ---
  getAuditLogs(query = {}) {
    let list = [...this.auditLogs];
    if (query.action) list = list.filter(l => l.action.includes(query.action));
    if (query.target_id) list = list.filter(l => l.target_id === query.target_id);
    if (query.user_id) list = list.filter(l => l.user_id === query.user_id);
    return list;
  }
}

// Singleton state
const store = new HospitalStore();
module.exports = store;
