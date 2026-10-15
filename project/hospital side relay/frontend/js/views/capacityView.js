/**
 * Capacity & Resources Management View
 * Implements Pages & Navigation spec section 3.7
 */

function renderCapacityView(state) {
  const cap = state.capacity;
  const res = state.resources;
  if (!cap) return '<p>Loading capacity details...</p>';

  const departments = cap.by_department || [];
  const deptRows = departments.map(d => {
    const safeName = escapeHtml(d.name);
    const safeTotal = escapeHtml(d.total);
    const safeAvail = escapeHtml(d.available);
    const safeOcc = escapeHtml(d.occupied);
    const occRatio = (Number(d.occupied) || 0) / (Number(d.total) || 1);
    const occPercent = Math.min(100, Math.round(occRatio * 100));

    return `
      <tr>
        <td><strong>${safeName}</strong></td>
        <td style="font-family: var(--font-mono);">${safeTotal}</td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: ${d.available < 2 ? 'var(--red-600)' : 'var(--slate-900)'};">${safeAvail}</td>
        <td style="font-family: var(--font-mono);">${safeOcc}</td>
        <td>
          <div class="progress-track" style="width: 120px;">
            <div class="progress-bar-fill ${occRatio > 0.85 ? 'fill-red' : 'fill-green'}" style="width: ${occPercent}%"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const equipmentList = (res && res.equipment) || [];
  const equipCards = equipmentList.map(e => {
    const safeName = escapeHtml(e.name);
    const safeLocation = escapeHtml(e.location || 'Central ED');
    const safeStatus = escapeHtml(e.status);
    const safeQtyAvail = escapeHtml(e.quantity_available);
    const safeQtyTotal = escapeHtml(e.quantity_total);
    const safeNotes = escapeHtml(e.notes);

    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 800; font-size: 13px;">${safeName}</div>
            <div style="font-size: 11px; color: var(--slate-500);">${safeLocation}</div>
          </div>
          <span class="btn btn-sm ${e.is_available ? 'btn-success' : 'btn-danger'}" style="pointer-events: none;">
            ${safeStatus}
          </span>
        </div>
        ${e.quantity_available !== undefined ? `
          <div style="margin-top: 8px; font-size: 12px; font-family: var(--font-mono); font-weight: 700;">
            ${safeQtyAvail} of ${safeQtyTotal} Available
          </div>
        ` : ''}
        ${e.notes ? `<div style="font-size: 11px; color: var(--red-600); margin-top: 4px;">⚠️ ${safeNotes}</div>` : ''}
      </div>
    `;
  }).join('');

  const bloodList = (res && res.blood_products) || [];
  const bloodHtml = bloodList.map(b => {
    const safeLabel = escapeHtml(b.label);
    const safeUnits = escapeHtml(b.units_available);
    const safeStatus = escapeHtml(b.status);

    return `
      <div style="background: var(--slate-50); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; text-align: center;">
        <div style="font-size: 11px; font-weight: 800; color: var(--slate-600);">${safeLabel}</div>
        <div style="font-size: 22px; font-weight: 800; font-family: var(--font-mono); color: var(--red-700); margin: 4px 0;">
          ${safeUnits} <span style="font-size: 11px; font-weight: 600; color: var(--slate-500);">units</span>
        </div>
        <span style="font-size: 10px; font-weight: 700; color: #059669;">● ${safeStatus}</span>
      </div>
    `;
  }).join('');

  const safeRecordedTime = escapeHtml(new Date(cap.recorded_at).toLocaleTimeString());
  const freshnessClass = `freshness-${escapeHtml(String(cap.freshness_status || '').toLowerCase())}`;
  const safeAvailBeds = escapeHtml(cap.available_beds);
  const safeTotalBeds = escapeHtml(cap.total_beds);
  const safeOccBeds = escapeHtml(cap.occupied_beds);
  const safeIcuVacant = escapeHtml(cap.icu_beds_vacant);
  const safeIcuTotal = escapeHtml(cap.icu_beds_total);
  const safeTheatersAvail = escapeHtml(cap.operating_theaters_available);
  const safeTheatersTotal = escapeHtml(cap.operating_theaters_total);
  const safeTraumaAvail = escapeHtml(cap.trauma_bays_available);
  const safeTraumaTotal = escapeHtml(cap.trauma_bays_total);

  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--slate-900);">🏥 Capacity & Emergency Resources</h2>
          <p style="font-size: 13px; color: var(--slate-600);">Real-time availability of acute beds, operating theaters, on-duty specialists, and diagnostic suites.</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" onclick="handleConfirmCapacity()">✓ Confirm Still Accurate</button>
          <button class="btn btn-primary" onclick="AppState.openQuickUpdate()">⚡ Edit Capacity Figures</button>
        </div>
      </div>

      <!-- Quick Metrics Overview -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        <div class="capacity-card" style="margin-bottom: 0;">
          <div class="metric-num ${cap.available_beds < 5 ? 'highlight-red' : ''}">${safeAvailBeds}</div>
          <div class="metric-label">Available Acute Beds (of ${safeTotalBeds})</div>
          <div style="font-size: 11px; color: var(--slate-500); margin-top: 6px;">${safeOccBeds} currently occupied</div>
        </div>
        <div class="capacity-card" style="margin-bottom: 0;">
          <div class="metric-num ${cap.icu_beds_vacant < 2 ? 'highlight-red' : ''}">${safeIcuVacant}</div>
          <div class="metric-label">Vacant ICU Beds (of ${safeIcuTotal})</div>
          <div style="font-size: 11px; color: var(--slate-500); margin-top: 6px;">Critical care team on-site</div>
        </div>
        <div class="capacity-card" style="margin-bottom: 0;">
          <div class="metric-num">${safeTheatersAvail}</div>
          <div class="metric-label">Available Theaters (of ${safeTheatersTotal})</div>
          <div style="font-size: 11px; color: var(--slate-500); margin-top: 6px;">OR 1 & OR 2 on emergency standby</div>
        </div>
        <div class="capacity-card" style="margin-bottom: 0;">
          <div class="metric-num">${safeTraumaAvail}</div>
          <div class="metric-label">Available Trauma Bays (of ${safeTraumaTotal})</div>
          <div style="font-size: 11px; color: var(--slate-500); margin-top: 6px;">Level 1 Resuscitation ready</div>
        </div>
      </div>

      <!-- Department & Ward Bed Allocation Table -->
      <div class="data-table-container">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 14px; font-weight: 800;">Department Bed Allocation</h3>
          <span class="badge-freshness ${freshnessClass}">
            Last Updated ${safeRecordedTime}
          </span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Department / Ward</th>
              <th>Total Capacity</th>
              <th>Available Beds</th>
              <th>Occupied</th>
              <th>Occupancy Bar</th>
            </tr>
          </thead>
          <tbody>
            ${deptRows}
          </tbody>
        </table>
      </div>

      <!-- Critical Diagnostic Equipment & Theaters -->
      <div>
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px;">🔬 Diagnostic Equipment & Surgical Suites</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
          ${equipCards}
        </div>
      </div>

      <!-- Emergency Blood Bank Reserve -->
      <div>
        <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px; color: var(--red-800);">🩸 Emergency Blood Bank Stock (Uncrossmatched Emergency Reserve)</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          ${bloodHtml}
        </div>
      </div>
    </div>
  `;
}

window.renderCapacityView = renderCapacityView;
