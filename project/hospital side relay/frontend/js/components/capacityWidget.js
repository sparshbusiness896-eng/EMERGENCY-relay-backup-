/**
 * Capacity Widget & Quick Update Component
 * Implements Dashboard & UI Spec section 6
 */

function renderCapacityWidget(capacity, resources) {
  if (!capacity) return '<div class="capacity-card"><p>Loading capacity figures...</p></div>';

  const totalBeds = Number(capacity.total_beds) || 120;
  const availBeds = Number(capacity.available_beds) || 0;
  const occBeds = Number(capacity.occupied_beds) || 0;
  const bedPercent = Math.min(100, Math.round((occBeds / totalBeds) * 100));

  const icuTotal = Number(capacity.icu_beds_total) || 20;
  const icuVacant = Number(capacity.icu_beds_vacant) || 0;
  const icuPercent = Math.min(100, Math.round(((icuTotal - icuVacant) / icuTotal) * 100));

  const theatersTotal = Number(capacity.operating_theaters_total) || 6;
  const theatersAvail = Number(capacity.operating_theaters_available) || 0;

  const freshnessClass = `freshness-${escapeHtml(String(capacity.freshness_status || '').toLowerCase())}`;
  const freshnessLabel = capacity.freshness_status === 'FRESH'
    ? '✓ Fresh Data'
    : (capacity.freshness_status === 'AGING' ? '⏳ Update Soon' : '⚠️ Stale, may be out of date');

  // Key on-duty specialists
  const specialists = (resources && resources.specialists) || [];
  const specsHtml = specialists.slice(0, 4).map(s => {
    const safeName = escapeHtml(s.name);
    const safePhysician = escapeHtml(s.physician || '');
    const safeStatus = escapeHtml(String(s.status || '').replace('_', ' '));
    const isDuty = s.status === 'ON_DUTY';
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
        <div>
          <strong>${safeName}</strong>
          <div style="font-size: 10px; color: var(--slate-500);">${safePhysician}</div>
        </div>
        <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: var(--radius-sm); ${isDuty ? 'background: #ECFDF5; color: #059669;' : 'background: #FFFBEB; color: #D97706;'}">
          ${safeStatus}
        </span>
      </div>
    `;
  }).join('');

  const safeRecordedTime = escapeHtml(new Date(capacity.recorded_at).toLocaleTimeString());
  const safeRecordedByName = escapeHtml(capacity.recorded_by_name || 'Coordinator');

  return `
    <div class="capacity-card">
      <div class="capacity-header">
        <div class="capacity-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 7h18M3 12h18M3 17h18"></path></svg>
          Hospital Emergency Capacity
        </div>
        <span class="badge-freshness ${freshnessClass}">${freshnessLabel}</span>
      </div>

      <!-- General Beds & ICU Metric Boxes -->
      <div class="metric-row">
        <div class="metric-box">
          <div class="metric-num ${availBeds < 5 ? 'highlight-red' : ''}">${availBeds}</div>
          <div class="metric-label">Available Beds (of ${totalBeds})</div>
        </div>
        <div class="metric-box">
          <div class="metric-num ${icuVacant < 2 ? 'highlight-red' : ''}">${icuVacant}</div>
          <div class="metric-label">Vacant ICU Beds (of ${icuTotal})</div>
        </div>
      </div>

      <!-- Bed Occupancy Bar -->
      <div class="capacity-progress-wrapper">
        <div class="progress-labels">
          <span>Bed Occupancy</span>
          <span>${bedPercent}% (${occBeds} occupied)</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill ${bedPercent > 85 ? 'fill-red' : (bedPercent > 70 ? 'fill-amber' : 'fill-green')}" style="width: ${bedPercent}%"></div>
        </div>
      </div>

      <!-- Operating Theaters -->
      <div style="background: var(--slate-50); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 12px; font-weight: 700; color: var(--slate-800);">Operating Theaters</div>
          <div style="font-size: 11px; color: var(--slate-500);">${theatersAvail} of ${theatersTotal} available</div>
        </div>
        <span class="btn btn-sm ${theatersAvail > 0 ? 'btn-success' : 'btn-danger'}" style="pointer-events: none;">
          ${theatersAvail > 0 ? `${theatersAvail} Ready` : 'Full'}
        </span>
      </div>

      <!-- Quick Actions -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="AppState.openQuickUpdate()">
          ⚡ Quick Update
        </button>
        <button class="btn btn-secondary btn-sm" onclick="handleConfirmCapacity()">
          ✓ Confirm Still Accurate
        </button>
      </div>

      <div style="font-size: 10px; color: var(--slate-500); margin-bottom: 16px; text-align: center;">
        Last updated ${safeRecordedTime} by ${safeRecordedByName}.
        <br><em>Figures are not a guarantee of acceptance.</em>
      </div>

      <!-- On Duty Specialists -->
      <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px;">
        <div style="font-size: 12px; font-weight: 800; color: var(--slate-700); text-transform: uppercase; margin-bottom: 8px;">
          👨‍⚕️ Emergency Specialists On Duty
        </div>
        ${specsHtml}
      </div>
    </div>
  `;
}

function renderQuickUpdateModal(capacity) {
  if (!capacity) return '';

  const safeTotalBeds = escapeHtml(capacity.total_beds);
  const safeAvailBeds = escapeHtml(capacity.available_beds);
  const safeOccBeds = escapeHtml(capacity.occupied_beds);
  const safeIcuTotal = escapeHtml(capacity.icu_beds_total);
  const safeIcuVacant = escapeHtml(capacity.icu_beds_vacant);
  const safeTheatersTotal = escapeHtml(capacity.operating_theaters_total);
  const safeTheatersAvail = escapeHtml(capacity.operating_theaters_available);

  return `
    <div class="modal-backdrop" id="quick-update-backdrop" onclick="handleQuickUpdateBackdropClick(event)">
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <div style="font-weight: 800; font-size: 16px;">⚡ Quick Capacity Update</div>
          <button class="btn btn-secondary btn-sm" onclick="AppState.closeQuickUpdate()">✕</button>
        </div>
        <div class="modal-body">
          <form id="quick-update-form" onsubmit="handleQuickUpdateSubmit(event)">
            <div class="form-group">
              <label class="form-label">Available Acute Beds (of ${safeTotalBeds}):</label>
              <input type="number" id="qu-avail-beds" class="form-input" value="${safeAvailBeds}" min="0" max="${safeTotalBeds}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Occupied Beds:</label>
              <input type="number" id="qu-occ-beds" class="form-input" value="${safeOccBeds}" min="0" max="${safeTotalBeds}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Vacant ICU Beds (of ${safeIcuTotal}):</label>
              <input type="number" id="qu-icu-beds" class="form-input" value="${safeIcuVacant}" min="0" max="${safeIcuTotal}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Available Operating Theaters (of ${safeTheatersTotal}):</label>
              <input type="number" id="qu-theaters" class="form-input" value="${safeTheatersAvail}" min="0" max="${safeTheatersTotal}" required />
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" class="btn btn-secondary" onclick="AppState.closeQuickUpdate()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save & Broadcast</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

window.renderCapacityWidget = renderCapacityWidget;
window.renderQuickUpdateModal = renderQuickUpdateModal;
