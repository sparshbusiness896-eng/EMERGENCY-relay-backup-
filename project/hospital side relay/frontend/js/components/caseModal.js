/**
 * Case Details & Paramedic Response Modal Component
 * Implements Pages & Navigation spec section 3.6
 */

function renderCaseModal(c) {
  if (!c) return '';

  const isCritical = c.priority === 'CRITICAL';
  const isNew = c.response_status === 'NEW';
  const etaInfo = formatEtaCountdown(c.eta);

  // Vitals Grid
  const vitalsHtml = (c.vital_signs || []).map(v => {
    let isDanger = false;
    if (v.type === 'oxygen_saturation' && Number(v.value) < 92) isDanger = true;
    if (v.type === 'heart_rate' && (Number(v.value) > 120 || Number(v.value) < 50)) isDanger = true;
    const label = escapeHtml(String(v.type || '').replace(/_/g, ' ').toUpperCase());
    return `
      <div class="vital-card">
        <span class="vital-label">${label}</span>
        <span class="vital-val ${isDanger ? 'danger' : ''}">${escapeHtml(v.value)}</span>
        <span style="font-size: 11px; color: var(--slate-500);">${escapeHtml(v.unit)}</span>
      </div>
    `;
  }).join('');

  // Timeline entries
  const timelineHtml = (c.timeline || []).map(item => `
    <div class="timeline-item">
      <div class="timeline-time">${escapeHtml(new Date(item.timestamp).toLocaleTimeString())}</div>
      <div class="timeline-desc">${escapeHtml(item.detail)}</div>
      <div class="timeline-actor">By: ${escapeHtml(item.actor)}</div>
    </div>
  `).join('');

  // Quick templates - Rendered without inline onclick; handled via addEventListener
  const templates = [
    { text: 'Route ambulance directly to Trauma Bay 1. Level 1 Surgical Trauma Team mobilized.' },
    { text: 'Cath Lab Suite 2 is prepped. Interventional team standing by for immediate transfer.' },
    { text: 'Code Stroke active. Transfer patient directly to CT Scanner 1 bed upon arrival.' },
    { text: 'Ambulance Bay 3 is cleared. Pediatric resuscitation team standing by.' },
    { text: 'Please provide repeat blood pressure and oxygen saturation prior to arrival.' }
  ];

  const templatesHtml = templates.map((t) => `
    <button type="button" class="template-btn" data-template="${escapeHtml(t.text)}">
      ${escapeHtml(t.text.substring(0, 48))}...
    </button>
  `).join('');

  const safeCaseId = escapeHtml(c.case_id);
  const safePriority = escapeHtml(c.priority);
  const safePriorityClass = `priority-${escapeHtml(String(c.priority || '').toLowerCase())}`;
  const safeParamedicUnit = escapeHtml(c.paramedic ? c.paramedic.unit_id : '');
  const safeEmergencyType = escapeHtml(c.emergency_type);
  const safeStatus = escapeHtml(c.response_status);
  const safeEtaLabel = escapeHtml(etaInfo.label);
  const safeConditionSummary = escapeHtml(c.patient_condition_summary);
  const safePatientAge = escapeHtml(c.patient ? c.patient.age || 'Unknown' : 'N/A');
  const safePatientSex = escapeHtml(c.patient ? c.patient.sex || 'Unknown' : 'N/A');
  const safeNotes = escapeHtml(c.notes || 'No paramedic notes recorded.');
  const safeTreatment = escapeHtml(c.treatment_given || 'No treatment details provided.');
  const safeInstructions = escapeHtml(c.instructions_to_paramedic || '');

  return `
    <div class="modal-backdrop" id="case-modal-overlay" onclick="handleBackdropClick(event)">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge-priority ${safePriorityClass}">${safePriority}</span>
              <span style="font-size: 18px; font-weight: 800;">Case #${safeCaseId}</span>
              <span style="font-size: 12px; color: var(--slate-500); font-family: var(--font-mono);">${safeParamedicUnit}</span>
            </div>
            <div style="font-size: 13px; color: var(--slate-600); margin-top: 4px;">
              ${safeEmergencyType} • Status: <strong>${safeStatus}</strong>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="AppState.closeCaseModal()">✕ Close</button>
        </div>

        <div class="modal-body">
          <div class="case-detail-grid">
            <!-- Critical banner if applicable -->
            ${isCritical ? `
              <div class="case-critical-banner">
                <div class="case-banner-text">
                  ⚠️ <strong>CRITICAL TRIAGE ALERT:</strong> Immediate clinical preparation required. Live ETA countdown: <strong>${safeEtaLabel}</strong>
                </div>
                ${isNew ? `
                  <button class="btn btn-primary btn-sm" onclick="submitModalAcknowledge('${safeCaseId}')">
                    Acknowledge Case Now
                  </button>
                ` : ''}
              </div>
            ` : ''}

            <!-- Patient and Condition -->
            <div>
              <div class="case-section-title">👤 Patient Condition & Demographics</div>
              <div class="clinical-notes-box">
                <p><strong>Condition:</strong> ${safeConditionSummary}</p>
                <p style="margin-top: 6px;"><strong>Demographics:</strong> Age: ${safePatientAge}, Sex: ${safePatientSex}</p>
              </div>
            </div>

            <!-- Vitals Grid -->
            <div>
              <div class="case-section-title">📊 Pre-Hospital Vital Signs</div>
              <div class="vitals-grid">
                ${vitalsHtml}
              </div>
            </div>

            <!-- Paramedic Notes & Treatment Given -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <div class="case-section-title">📝 Field Notes (Paramedic)</div>
                <div class="clinical-notes-box">${safeNotes}</div>
              </div>
              <div>
                <div class="case-section-title">💉 Field Treatment Administered</div>
                <div class="clinical-notes-box">${safeTreatment}</div>
              </div>
            </div>

            <!-- Hospital Response & Action Form -->
            <div style="background: var(--slate-50); border: 2px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 18px;">
              <div class="case-section-title" style="color: var(--red-700);">
                🚑 Hospital Status & Relay Instructions
              </div>

              <!-- Status Selector -->
              <div style="display: flex; gap: 12px; align-items: flex-end; margin-bottom: 16px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 220px;">
                  <label class="form-label">Update Response Status:</label>
                  <select id="modal-status-select" class="form-select" onchange="toggleUnableReasonField(this.value)">
                    <option value="" disabled selected>Select Next Status...</option>
                    ${isNew ? `<option value="RECEIVED">RECEIVED (Acknowledge Alert)</option>` : ''}
                    <option value="PREPARING" ${c.response_status === 'PREPARING' ? 'selected' : ''}>PREPARING (Mobilizing resources)</option>
                    <option value="READY" ${c.response_status === 'READY' ? 'selected' : ''}>READY (Hospital reports ready to receive)</option>
                    <option value="PATIENT_ARRIVED" ${c.response_status === 'PATIENT_ARRIVED' ? 'selected' : ''}>PATIENT_ARRIVED (Ambulance at bay)</option>
                    <option value="HANDOVER_COMPLETE" ${c.response_status === 'HANDOVER_COMPLETE' ? 'selected' : ''}>HANDOVER_COMPLETE (Admitted / Closed)</option>
                    <option value="UNABLE_TO_RECEIVE">UNABLE TO RECEIVE (Divert Ambulance)</option>
                  </select>
                </div>

                <button class="btn btn-primary" onclick="submitModalStatus('${safeCaseId}')">
                  Update Status
                </button>
              </div>

              <!-- Reason fields for UNABLE_TO_RECEIVE -->
              <div id="unable-reason-container" style="display: none; background: #FEF2F2; border: 1px solid #FECACA; padding: 14px; border-radius: var(--radius-md); margin-bottom: 16px;">
                <div class="form-group">
                  <label class="form-label" style="color: var(--red-800);">Reason Code for Diversion (Mandatory):</label>
                  <select id="modal-reason-code" class="form-select">
                    <option value="NO_CAPACITY">NO_CAPACITY - All trauma/acute beds occupied</option>
                    <option value="RESOURCE_UNAVAILABLE">RESOURCE_UNAVAILABLE - Specialized resource offline (Cath/CT/Burn)</option>
                    <option value="DIVERSION">DIVERSION - Emergency department closed to new arrivals</option>
                    <option value="OTHER">OTHER - Administrative redirect</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="color: var(--red-800);">Reason Details & Advice to Paramedic:</label>
                  <input type="text" id="modal-reason-note" class="form-input" placeholder="e.g. Redirect to Regional Burn Unit 8 miles east." />
                </div>
              </div>

              <!-- Relay Instructions -->
              <div class="form-group">
                <label class="form-label">Instructions Dispatched to Field Paramedic Unit:</label>
                <textarea id="modal-instruction-text" class="form-textarea" rows="2" placeholder="Type instructions or select a template below...">${safeInstructions}</textarea>
              </div>

              <div style="margin-bottom: 12px;">
                <label class="form-label" style="font-size: 11px;">Quick Response Templates:</label>
                <div class="template-grid">
                  ${templatesHtml}
                </div>
              </div>

              <button class="btn btn-secondary btn-sm" onclick="submitModalInstructions('${safeCaseId}')">
                📡 Send Instructions to Paramedic Unit
              </button>
            </div>

            <!-- Case Audit Timeline -->
            <div>
              <div class="case-section-title">⏱️ Clinical Audit Timeline</div>
              <div class="timeline-list">
                ${timelineHtml}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="AppState.closeCaseModal()">Close</button>
        </div>
      </div>
    </div>
  `;
}

window.renderCaseModal = renderCaseModal;
