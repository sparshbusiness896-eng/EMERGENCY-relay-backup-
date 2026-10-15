/**
 * Hospital Emergency Portal - API Client & SSE Stream
 */

const API_BASE = '/api';

const ApiClient = {
  getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { ...this.getHeaders(), ...(options.headers || {}) };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || err.message || `Request failed with ${response.status}`);
    }
    return response.json();
  },

  // Cases
  async getCases(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await this.request(`/cases${query ? '?' + query : ''}`);
    return res.cases;
  },

  async getCase(id) {
    const res = await this.request(`/cases/${encodeURIComponent(id)}`);
    return res.case;
  },

  async acknowledgeCase(id) {
    const res = await this.request(`/cases/${encodeURIComponent(id)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    return res.case;
  },

  async updateCaseStatus(id, status, extra = {}) {
    const payload = { status };
    if (extra.reason_code) payload.reason_code = extra.reason_code;
    if (extra.reason_note) payload.reason_note = extra.reason_note;

    const res = await this.request(`/cases/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.case;
  },

  async sendInstructions(id, instruction, resources = []) {
    const payload = {};
    if (instruction) payload.instruction = instruction;
    if (Array.isArray(resources) && resources.length > 0) payload.resources = resources;

    const res = await this.request(`/cases/${encodeURIComponent(id)}/instructions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.case;
  },

  // Capacity & Resources
  async getCapacity() {
    const res = await this.request('/capacity');
    return res.capacity;
  },

  async updateCapacity(updates) {
    const res = await this.request('/capacity', {
      method: 'POST',
      body: JSON.stringify(updates)
    });
    return res.capacity;
  },

  async confirmCapacity() {
    const res = await this.request('/capacity/confirm', {
      method: 'POST',
      body: JSON.stringify({})
    });
    return res.capacity;
  },

  async getResources() {
    const res = await this.request('/resources');
    return res.resources;
  },

  async updateResource(category, id, updates) {
    const res = await this.request(`/resources/${encodeURIComponent(category)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return res.resources;
  },

  // Hospital, Staff & Audit
  async getHospital() {
    const res = await this.request('/hospital');
    return res.hospital;
  },

  async updateHospital(updates) {
    const res = await this.request('/hospital', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return res.hospital;
  },

  async getStaff() {
    const res = await this.request('/staff');
    return res.staff;
  },

  async inviteStaff(data) {
    const res = await this.request('/staff', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.staff;
  },

  async getAudit(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await this.request(`/audit${query ? '?' + query : ''}`);
    return res.logs;
  },

  // Simulator
  async simulateCase(preset, custom = null) {
    const payload = {};
    if (preset) payload.preset = preset;
    if (custom) payload.custom = custom;

    const res = await this.request('/simulator/send-case', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.case;
  },

  async simulateCancel(caseId, reason) {
    const payload = { case_id: caseId };
    if (reason) payload.reason = reason;

    const res = await this.request('/simulator/cancel-case', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.case;
  },

  async resetData() {
    const res = await this.request('/simulator/reset', { method: 'POST', body: JSON.stringify({}) });
    return res;
  },

  // SSE Stream
  initEventStream(onEvent, onStatusChange) {
    let eventSource = null;

    const connect = () => {
      onStatusChange('CONNECTING');
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('CONNECTED', (e) => {
        onStatusChange('ONLINE');
      });

      eventSource.addEventListener('NEW_CASE_ALERT', (e) => {
        const payload = JSON.parse(e.data);
        onEvent('NEW_CASE_ALERT', payload);
      });

      eventSource.addEventListener('CASE_STATUS_UPDATED', (e) => {
        const payload = JSON.parse(e.data);
        onEvent('CASE_STATUS_UPDATED', payload);
      });

      eventSource.addEventListener('CAPACITY_UPDATED', (e) => {
        const payload = JSON.parse(e.data);
        onEvent('CAPACITY_UPDATED', payload);
      });

      eventSource.addEventListener('RESOURCES_UPDATED', (e) => {
        const payload = JSON.parse(e.data);
        onEvent('RESOURCES_UPDATED', payload);
      });

      eventSource.addEventListener('STORE_RESET', () => {
        onEvent('STORE_RESET', {});
      });

      eventSource.onerror = () => {
        onStatusChange('OFFLINE');
        eventSource.close();
        setTimeout(connect, 4000); // Auto reconnect
      };
    };

    connect();
  }
};

window.ApiClient = ApiClient;
