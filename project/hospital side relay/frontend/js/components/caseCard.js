/**
 * Alert Card Component
 * Implements Dashboard & UI Spec section 3 & 4
 */

function formatEtaCountdown(etaIso) {
  if (!etaIso) return { label: 'ETA: Unknown', isImminent: false };
  const target = new Date(etaIso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((target - now) / 1000);

  if (diffSec <= 0) {
    return { label: 'ARRIVED OR AT BAY', isImminent: true, timeStr: '00:00' };
  }

  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return {
    label: `ETA in ${mins}m ${secs}s`,
    timeStr: timeStr,
    isImminent: mins < 10
  };
}

function renderCaseCard(c) {
  const isCritical = c.priority === 'CRITICAL';
  const isNew = c.response_status === 'NEW';
  const isNewCritical = isCritical && isNew;
  const etaInfo = formatEtaCountdown(c.eta);

  // Vitals summary (up to 3 key vitals)
  const vitalsHtml = (c.vital_signs || []).slice(0, 3).map(v => {
    let isDanger = false;
    if (v.type === 'oxygen_saturation' && Number(v.value) < 92) isDanger = true;
    if (v.type === 'heart_rate' && (Number(v.value) > 120 || Number(v.value) < 50)) isDanger = true;
    const label = escapeHtml(String(v.type || '').replace(/_/g, ' ').toUpperCase());
    return `
      <div class="vital-chip">
        <span class="vital-label">${label}:</span>
        <span class="vital-val ${isDanger ? 'danger' : ''}">${escapeHtml(v.value)} ${escapeHtml(v.unit)}</span>
      </div>
    `;
  }).join('');

  // Status badge config
  const statusLabels = {
    NEW: { label: 'New Alert', class: 'status-new', icon: '🔔' },
    RECEIVED: { label: 'Received (Acknowledged)', class: 'status-received', icon: '👁️' },
    PREPARING: { label: 'Preparing Resources', class: 'status-preparing', icon: '⏳' },
    READY: { label: 'Reports Ready to Receive', class: 'status-ready', icon: '✓' },
    UNABLE_TO_RECEIVE: { label: 'Unable to Receive', class: 'status-unable', icon: '⛔' },
    PATIENT_ARRIVED: { label: 'Patient Arrived', class: 'status-arrived', icon: '🚪' },
    HANDOVER_COMPLETE: { label: 'Handover Complete', class: 'status-complete', icon: '✓✓' },
    CANCELLED: { label: 'Cancelled / Diverted', class: 'status-cancelled', icon: '✕' }
  };
  const statusMeta = statusLabels[c.response_status] || { label: escapeHtml(c.response_status), class: 'status-complete', icon: '•' };

  // Priority badge config
  const priorityClass = `priority-${escapeHtml(String(c.priority || '').toLowerCase())}`;
  const safeCaseId = escapeHtml(c.case_id);
  const safePriority = escapeHtml(c.priority);
  const safeEmergencyType = escapeHtml(c.emergency_type);
  const safeConditionSummary = escapeHtml(c.patient_condition_summary);
  const safeUnitId = escapeHtml(c.paramedic ? c.paramedic.unit_id : 'PARAMEDIC');
  const safePhone = escapeHtml(c.paramedic ? c.paramedic.callback_phone : 'N/A');
  const safeTime = escapeHtml(new Date(c.received_at || c.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const safeEtaLabel = escapeHtml(etaInfo.label);
  const safeEtaTimeStr = escapeHtml(etaInfo.timeStr || '--:--');

  return `
    <div class="alert-card ${isCritical ? 'is-critical' : ''} ${isNewCritical ? 'is-new-critical' : ''}" id="card-${safeCaseId}">
      <div class="alert-header">
        <div class="alert-header-left">
          <span class="badge-priority ${priorityClass}">
            ${isCritical ? '⚠️' : '▲'} ${safePriority}
          </span>
          <span class="badge-status ${statusMeta.class}">
            ${statusMeta.icon} ${escapeHtml(statusMeta.label)}
          </span>
          <span style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-500);">#${safeCaseId}</span>
        </div>

        <div class="eta-block">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          <span class="eta-timer" id="eta-${safeCaseId}">${safeEtaLabel} (${safeEtaTimeStr})</span>
        </div>
      </div>

      <div class="alert-title-row">
        <div class="alert-emergency-title">${safeEmergencyType}</div>
        <div class="alert-condition-summary">${safeConditionSummary}</div>
      </div>

      ${vitalsHtml ? `<div class="vitals-strip">${vitalsHtml}</div>` : ''}

      <div class="alert-card-footer">
        <div class="paramedic-unit-info">
          <span>🚑 <strong>${safeUnitId}</strong></span>
          <span>•</span>
          <span>📞 ${safePhone}</span>
          <span>•</span>
          <span>Received ${safeTime}</span>
        </div>

        <div class="alert-actions">
          ${isNew ? `
            <button class="btn btn-primary btn-sm btn-ack" onclick="handleAcknowledgeClick('${safeCaseId}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Acknowledge Alert
            </button>
          ` : ''}
          <button class="btn btn-secondary btn-sm" onclick="handleOpenCaseModal('${safeCaseId}')">
            Manage Case & Response →
          </button>
        </div>
      </div>
    </div>
  `;
}

window.renderCaseCard = renderCaseCard;
window.formatEtaCountdown = formatEtaCountdown;

