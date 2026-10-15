/**
 * Hospital Emergency Portal - Global Application State
 */

if (!window.escapeHtml) {
  window.escapeHtml = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
}

const AppState = {
  // Current logged in persona (switchable in top-bar for testing all role capabilities)
  currentUser: {
    id: 'usr_marcus_vance',
    name: 'Marcus Vance, BSN, RN',
    role: 'EMERGENCY_STAFF',
    title: 'Charge Nurse / Trauma Triage Lead'
  },

  // Available staff personas for switcher
  availableUsers: [
    {
      id: 'usr_sarah_chen',
      name: 'Dr. Sarah Chen, MD',
      role: 'ADMIN',
      title: 'Medical Director'
    },
    {
      id: 'usr_marcus_vance',
      name: 'Marcus Vance, BSN, RN',
      role: 'EMERGENCY_STAFF',
      title: 'Charge Nurse / Trauma Triage Lead'
    },
    {
      id: 'usr_elena_rostova',
      name: 'Elena Rostova',
      role: 'CAPACITY_COORDINATOR',
      title: 'Bed Capacity Coordinator'
    },
    {
      id: 'usr_david_morales',
      name: 'David Morales',
      role: 'VIEWER_AUDITOR',
      title: 'Quality & Compliance Auditor'
    }
  ],

  activeTab: 'dashboard',
  filterStatus: 'ALL',
  searchQuery: '',
  isMuted: false,
  connectionStatus: 'ONLINE',

  // Live collections
  cases: [],
  capacity: null,
  resources: null,
  hospital: null,
  staff: [],
  auditLogs: [],

  // Active modal
  selectedCaseId: null,
  isQuickUpdateOpen: false,
  isSimulatorOpen: false,

  // Listeners
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
  },

  notify() {
    for (const fn of this.listeners) {
      fn(this);
    }
  },

  setUser(userId) {
    const found = this.availableUsers.find(u => u.id === userId);
    if (found) {
      this.currentUser = found;
      this.notify();
    }
  },

  setTab(tab) {
    this.activeTab = tab;
    this.notify();
  },

  setFilter(filter) {
    this.filterStatus = filter;
    this.notify();
  },

  setSearch(query) {
    this.searchQuery = query;
    this.notify();
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    window.EmergencyAudio.setMuted(this.isMuted);
    this.notify();
  },

  openCaseModal(caseId) {
    this.selectedCaseId = caseId;
    this.notify();
  },

  closeCaseModal() {
    this.selectedCaseId = null;
    this.notify();
  },

  openQuickUpdate() {
    this.isQuickUpdateOpen = true;
    this.notify();
  },

  closeQuickUpdate() {
    this.isQuickUpdateOpen = false;
    this.notify();
  },

  openSimulator() {
    this.isSimulatorOpen = true;
    this.notify();
  },

  closeSimulator() {
    this.isSimulatorOpen = false;
    this.notify();
  }
};

window.AppState = AppState;
