(function configureTriageApi() {
  const isTriageBackendOrigin = window.location.protocol.startsWith('http') && window.location.port === '4000';
  const hostname = window.location.hostname || 'localhost';
  const apiBase = isTriageBackendOrigin ? '' : `http://${hostname}:4000`;

  window.TRIAGE_API_BASE = window.TRIAGE_API_BASE ?? apiBase;
  window.TRIAGE_API_ORIGIN = window.TRIAGE_API_BASE || window.location.origin;
})();
