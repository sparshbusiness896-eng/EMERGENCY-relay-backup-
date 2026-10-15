/**
 * Hospital Emergency Coordination Portal - Application Orchestrator
 */

// Global Event Handlers for UI Interactions
window.handleAcknowledgeClick = async function(caseId) {
  try {
    const updated = await ApiClient.acknowledgeCase(caseId);
    window.EmergencyAudio.playAckFeedback();
    const idx = AppState.cases.findIndex(c => c.case_id === caseId);
    if (idx !== -1) AppState.cases[idx] = updated;
    AppState.notify();
  } catch (err) {
    alert('Error acknowledging case: ' + err.message);
  }
};

window.handleOpenCaseModal = function(caseId) {
  AppState.openCaseModal(caseId);
};

window.handleBackdropClick = function(event) {
  if (event.target.id === 'case-modal-overlay') {
    AppState.closeCaseModal();
  }
};

window.handleQuickUpdateBackdropClick = function(event) {
  if (event.target.id === 'quick-update-backdrop') {
    AppState.closeQuickUpdate();
  }
};

window.toggleUnableReasonField = function(val) {
  const container = document.getElementById('unable-reason-container');
  if (container) {
    container.style.display = (val === 'UNABLE_TO_RECEIVE') ? 'block' : 'none';
  }
};

window.applyTemplate = function(text) {
  const textarea = document.getElementById('modal-instruction-text');
  if (textarea) {
    textarea.value = text;
  }
};

window.submitModalAcknowledge = async function(caseId) {
  await window.handleAcknowledgeClick(caseId);
  const updated = AppState.cases.find(c => c.case_id === caseId);
  if (updated) {
    AppState.selectedCaseId = caseId;
    AppState.notify();
  }
};

window.submitModalStatus = async function(caseId) {
  const select = document.getElementById('modal-status-select');
  const newStatus = select ? select.value : '';
  if (!newStatus) {
    alert('Please select a valid response status.');
    return;
  }

  let extra = {};
  if (newStatus === 'UNABLE_TO_RECEIVE') {
    const reasonCode = document.getElementById('modal-reason-code').value;
    const reasonNote = document.getElementById('modal-reason-note').value;
    if (!reasonCode) {
      alert('A reason code is mandatory for UNABLE_TO_RECEIVE.');
      return;
    }
    extra = { reason_code: reasonCode, reason_note: reasonNote };
  }

  try {
    const updated = await ApiClient.updateCaseStatus(caseId, newStatus, extra);
    const idx = AppState.cases.findIndex(c => c.case_id === caseId);
    if (idx !== -1) AppState.cases[idx] = updated;
    AppState.notify();
  } catch (err) {
    alert('Could not update status: ' + err.message);
  }
};

window.submitModalInstructions = async function(caseId) {
  const textarea = document.getElementById('modal-instruction-text');
  const text = textarea ? textarea.value.trim() : '';
  if (!text) {
    alert('Please enter an instruction or select a template.');
    return;
  }

  try {
    const updated = await ApiClient.sendInstructions(caseId, text);
    const idx = AppState.cases.findIndex(c => c.case_id === caseId);
    if (idx !== -1) AppState.cases[idx] = updated;
    alert('Relay instructions sent to field paramedic unit!');
    AppState.notify();
  } catch (err) {
    alert('Failed to send instructions: ' + err.message);
  }
};

window.handleConfirmCapacity = async function() {
  try {
    const updated = await ApiClient.confirmCapacity();
    AppState.capacity = updated;
    AppState.notify();
    alert('Capacity confirmed accurate! Freshness timer refreshed.');
  } catch (err) {
    alert('Error confirming capacity: ' + err.message);
  }
};

window.handleQuickUpdateSubmit = async function(event) {
  event.preventDefault();
  const updates = {
    available_beds: Number(document.getElementById('qu-avail-beds').value),
    occupied_beds: Number(document.getElementById('qu-occ-beds').value),
    icu_beds_vacant: Number(document.getElementById('qu-icu-beds').value),
    operating_theaters_available: Number(document.getElementById('qu-theaters').value)
  };

  try {
    const updated = await ApiClient.updateCapacity(updates);
    AppState.capacity = updated;
    AppState.closeQuickUpdate();
    AppState.notify();
  } catch (err) {
    alert('Error updating capacity: ' + err.message);
  }
};

window.handleProfileSubmit = async function(event) {
  event.preventDefault();
  const updates = {
    name: document.getElementById('prof-name').value,
    phone: document.getElementById('prof-phone').value,
    email: document.getElementById('prof-email').value,
    address: {
      street: document.getElementById('prof-street').value,
      city: document.getElementById('prof-city').value,
      region: document.getElementById('prof-region').value,
      postal_code: document.getElementById('prof-postal').value,
      country: 'US'
    }
  };

  try {
    const updated = await ApiClient.updateHospital(updates);
    AppState.hospital = updated;
    alert('Hospital profile saved successfully!');
    AppState.notify();
  } catch (err) {
    alert('Error updating profile: ' + err.message);
  }
};

window.triggerSimulationPreset = async function(preset) {
  try {
    const newCase = await ApiClient.simulateCase(preset);
    if (newCase.priority === 'CRITICAL') {
      window.EmergencyAudio.playCriticalAlert();
    } else {
      window.EmergencyAudio.playNormalAlert();
    }
    AppState.setTab('dashboard');
    AppState.setFilter('ALL');
  } catch (err) {
    alert('Error dispatching simulation: ' + err.message);
  }
};

window.handleCustomDispatchSubmit = async function(event) {
  event.preventDefault();
  const priority = document.getElementById('cust-priority').value;
  const emergency_type = document.getElementById('cust-emergency-type').value;
  const eta_minutes = Number(document.getElementById('cust-eta-min').value);
  const hr = Number(document.getElementById('cust-hr').value);
  const bp = document.getElementById('cust-bp').value;
  const spo2 = Number(document.getElementById('cust-spo2').value);
  const unit = document.getElementById('cust-unit').value || 'AMB-RELAY-99';
  const notes = document.getElementById('cust-notes').value;

  const custom = {
    priority,
    emergency_type,
    patient_condition_summary: `${emergency_type} transport reported by ${unit}`,
    eta_minutes,
    vital_signs: [
      { type: 'heart_rate', value: hr, unit: 'bpm', measured_at: new Date().toISOString() },
      { type: 'blood_pressure', value: bp, unit: 'mmHg', measured_at: new Date().toISOString() },
      { type: 'oxygen_saturation', value: spo2, unit: '%', measured_at: new Date().toISOString() }
    ],
    paramedic: { unit_id: unit, name_or_code: 'Simulation Unit', callback_phone: '+1 (555) 911-0000' },
    notes: notes
  };

  try {
    await ApiClient.simulateCase('TRAUMA', custom);
    if (priority === 'CRITICAL') {
      window.EmergencyAudio.playCriticalAlert();
    } else {
      window.EmergencyAudio.playNormalAlert();
    }
    AppState.setTab('dashboard');
    AppState.setFilter('ALL');
  } catch (err) {
    alert('Error dispatching custom alert: ' + err.message);
  }
};

window.handleSimCancelClick = async function() {
  const select = document.getElementById('sim-cancel-case-select');
  const caseId = select ? select.value : '';
  if (!caseId) {
    alert('Please select an active case to cancel.');
    return;
  }

  try {
    await ApiClient.simulateCancel(caseId, 'Paramedic unit redirected to regional center');
    alert('Case #' + caseId + ' has been cancelled/redirected.');
  } catch (err) {
    alert('Error cancelling case: ' + err.message);
  }
};

window.handleResetSimulation = async function() {
  if (confirm('Reset all hospital cases, capacity, and logs to initial seed data?')) {
    try {
      await ApiClient.resetData();
      alert('Data reset successfully.');
    } catch (err) {
      alert('Error resetting data: ' + err.message);
    }
  }
};

window.openInviteModal = function() {
  const name = prompt('Enter staff full name:');
  if (!name) return;
  const email = prompt('Enter staff email:');
  if (!email) return;
  const role = prompt('Enter role (ADMIN, EMERGENCY_STAFF, CAPACITY_COORDINATOR, VIEWER_AUDITOR):', 'EMERGENCY_STAFF');
  if (!role) return;

  ApiClient.inviteStaff({ full_name: name, email, role, title: 'Clinical Staff' })
    .then(newStaff => {
      AppState.staff.push(newStaff);
      AppState.notify();
      alert(`Invitation sent to ${email} as ${role}!`);
    })
    .catch(err => alert('Failed to invite: ' + err.message));
};

// Main App Controller
class HospitalApp {
  constructor() {
    this.root = document.getElementById('app-root');
  }

  async init() {
    // Subscribe to state changes
    AppState.subscribe(() => this.render());

    // Fetch initial datasets
    try {
      const [cases, cap, res, hosp, staff, audit] = await Promise.all([
        ApiClient.getCases(),
        ApiClient.getCapacity(),
        ApiClient.getResources(),
        ApiClient.getHospital(),
        ApiClient.getStaff(),
        ApiClient.getAudit()
      ]);

      AppState.cases = cases;
      AppState.capacity = cap;
      AppState.resources = res;
      AppState.hospital = hosp;
      AppState.staff = staff;
      AppState.auditLogs = audit;
    } catch (err) {
      console.error('Initialization error:', err);
    }

    // Connect Real-Time SSE Stream
    ApiClient.initEventStream(
      (eventType, payload) => this.handleLiveEvent(eventType, payload),
      (status) => {
        AppState.connectionStatus = status;
        this.updateConnectionPill();
      }
    );

    // Initial render
    this.render();

    // Start 1-second interval for clock & ETA countdown updates
    setInterval(() => this.tick(), 1000);
  }

  handleLiveEvent(eventType, payload) {
    if (eventType === 'NEW_CASE_ALERT') {
      AppState.cases.unshift(payload);
      if (payload.priority === 'CRITICAL') {
        window.EmergencyAudio.playCriticalAlert();
      } else {
        window.EmergencyAudio.playNormalAlert();
      }
      AppState.notify();
    } else if (eventType === 'CASE_STATUS_UPDATED') {
      const idx = AppState.cases.findIndex(c => c.case_id === payload.case_id);
      if (idx !== -1) {
        AppState.cases[idx] = payload;
      } else {
        AppState.cases.unshift(payload);
      }
      AppState.notify();
    } else if (eventType === 'CAPACITY_UPDATED') {
      AppState.capacity = payload;
      AppState.notify();
    } else if (eventType === 'RESOURCES_UPDATED') {
      AppState.resources = payload;
      AppState.notify();
    } else if (eventType === 'STORE_RESET') {
      Promise.all([
        ApiClient.getCases(),
        ApiClient.getCapacity(),
        ApiClient.getResources(),
        ApiClient.getAudit()
      ]).then(([cases, cap, res, audit]) => {
        AppState.cases = cases;
        AppState.capacity = cap;
        AppState.resources = res;
        AppState.auditLogs = audit;
        AppState.notify();
      });
    }
  }

  tick() {
    // Update live clock in top bar
    const clockEl = document.getElementById('live-clock-display');
    if (clockEl) {
      const now = new Date();
      clockEl.innerText = now.toLocaleTimeString([], { hour12: false }) + ' UTC';
    }

    // Update ETA countdowns on visible cards without re-rendering entire DOM
    for (const c of AppState.cases) {
      const etaEl = document.getElementById(`eta-${c.case_id}`);
      if (etaEl) {
        const info = formatEtaCountdown(c.eta);
        etaEl.innerText = `${info.label} (${info.timeStr || '--:--'})`;
      }
    }
  }

  updateConnectionPill() {
    const pill = document.getElementById('relay-status-pill');
    if (!pill) return;
    const isOnline = AppState.connectionStatus === 'ONLINE';
    pill.innerHTML = `
      <span class="status-dot-live" style="background: ${isOnline ? '#10B981' : '#EF4444'};"></span>
      <span>${isOnline ? 'LIVE RELAY [CONNECTED]' : 'RELAY RECONNECTING...'}</span>
    `;
  }

  render() {
    if (!this.root) return;

    let viewHtml = '';
    switch (AppState.activeTab) {
      case 'dashboard':
        viewHtml = renderDashboardView(AppState);
        break;
      case 'capacity':
        viewHtml = renderCapacityView(AppState);
        break;
      case 'history':
        viewHtml = renderHistoryView(AppState);
        break;
      case 'staff':
        viewHtml = renderStaffView(AppState);
        break;
      case 'profile':
        viewHtml = renderProfileView(AppState);
        break;
      case 'audit':
        viewHtml = renderAuditView(AppState);
        break;
      case 'simulator':
        viewHtml = renderSimulatorView(AppState);
        break;
      default:
        viewHtml = renderDashboardView(AppState);
    }

    // Modal check
    let modalHtml = '';
    if (AppState.selectedCaseId) {
      const selCase = AppState.cases.find(c => c.case_id === AppState.selectedCaseId);
      modalHtml = renderCaseModal(selCase);
    } else if (AppState.isQuickUpdateOpen) {
      modalHtml = renderQuickUpdateModal(AppState.capacity);
    }

    this.root.innerHTML = viewHtml + modalHtml;
    this.attachTemplateListeners();
    this.updateNavigationActive();
  }

  attachTemplateListeners() {
    const templateBtns = this.root.querySelectorAll('.template-btn');
    templateBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const text = btn.getAttribute('data-template');
        if (text && typeof window.applyTemplate === 'function') {
          window.applyTemplate(text);
        }
      });
    });
  }

  updateNavigationActive() {
    const tabs = document.querySelectorAll('.nav-tab-item');
    tabs.forEach(t => {
      const tabName = t.getAttribute('data-tab');
      if (tabName === AppState.activeTab) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    // Update unacknowledged badge count in navigation
    const newBadge = document.getElementById('nav-unack-badge');
    if (newBadge) {
      const count = AppState.cases.filter(c => c.response_status === 'NEW').length;
      newBadge.style.display = count > 0 ? 'inline-block' : 'none';
      newBadge.innerText = count;
    }
  }
}

// Global delegated event listener for template buttons as backup
document.addEventListener('click', (event) => {
  const btn = event.target.closest('.template-btn');
  if (btn) {
    const text = btn.getAttribute('data-template');
    if (text && typeof window.applyTemplate === 'function') {
      window.applyTemplate(text);
    }
  }
});

// Bootstrap once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.appInstance = new HospitalApp();
  window.appInstance.init();
});
