/**
 * Interactive Paramedic Relay Dispatch Simulator
 * Lets staff and testers dispatch live ambulance alerts to test real-time alerting
 */

function renderSimulatorView(state) {
  return `
    <div style="display: flex; flex-direction: column; gap: 24px; max-width: 1000px;">
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: var(--slate-900); display: flex; align-items: center; gap: 8px;">
              🚑 Pre-Hospital Paramedic Relay Dispatch Simulator
            </h2>
            <p style="font-size: 13px; color: var(--slate-600);">
              Simulate live field ambulance submissions to experience real-time alerting, audio chimes, and server acknowledgments.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="window.EmergencyAudio.playCriticalAlert()">
              🔊 Test Critical Siren
            </button>
            <button class="btn btn-danger btn-sm" onclick="handleResetSimulation()">
              ↺ Reset All Seed Data
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Preset Cards -->
      <div>
        <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 12px; color: var(--slate-700);">
          ⚡ Click a Preset to Dispatch a Live Alert Instantly:
        </h3>
        <div class="sim-preset-cards">
          <div class="sim-preset-card" onclick="triggerSimulationPreset('TRAUMA')">
            <span class="badge-priority priority-critical" style="margin-bottom: 8px;">CRITICAL</span>
            <div class="sim-preset-title">Pedestrian vs SUV</div>
            <div class="sim-preset-desc">Bilateral femur fractures, BP 78/42, HR 140, ETA 8 min. Massive bleeding.</div>
            <button class="btn btn-primary btn-sm" style="width: 100%; margin-top: 12px;">Dispatch Now →</button>
          </div>

          <div class="sim-preset-card" onclick="triggerSimulationPreset('CARDIAC')">
            <span class="badge-priority priority-critical" style="margin-bottom: 8px;">CRITICAL</span>
            <div class="sim-preset-title">Post-ROSC Cardiac Arrest</div>
            <div class="sim-preset-desc">VF arrest shocked x3, return of pulse, ST elevation on 12-lead, ETA 10 min.</div>
            <button class="btn btn-primary btn-sm" style="width: 100%; margin-top: 12px;">Dispatch Now →</button>
          </div>

          <div class="sim-preset-card" onclick="triggerSimulationPreset('STROKE')">
            <span class="badge-priority priority-high" style="margin-bottom: 8px;">HIGH</span>
            <div class="sim-preset-title">Code Stroke (LVO)</div>
            <div class="sim-preset-desc">Acute vertigo, ataxia, quadriplegia, 35m onset, ETA 14 min. Rapid CT requested.</div>
            <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 12px;">Dispatch Now →</button>
          </div>

          <div class="sim-preset-card" onclick="triggerSimulationPreset('PEDIATRIC')">
            <span class="badge-priority priority-medium" style="margin-bottom: 8px;">MEDIUM</span>
            <div class="sim-preset-title">Pediatric Status Epilepticus</div>
            <div class="sim-preset-desc">Child (4y), 18 min seizure, post-ictal, high fever, ETA 16 min.</div>
            <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 12px;">Dispatch Now →</button>
          </div>
        </div>
      </div>

      <!-- Custom Case Dispatch Form -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 22px; box-shadow: var(--shadow-sm);">
        <h3 style="font-size: 15px; font-weight: 800; margin-bottom: 14px; color: var(--slate-900);">
          🛠️ Custom Emergency Transport Dispatcher
        </h3>
        <form id="custom-dispatch-form" onsubmit="handleCustomDispatchSubmit(event)">
          <div style="display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Priority Level:</label>
              <select id="cust-priority" class="form-select">
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Emergency Category / Condition:</label>
              <input type="text" id="cust-emergency-type" class="form-input" placeholder="e.g. Penetrating Chest Trauma" required />
            </div>

            <div class="form-group">
              <label class="form-label">Ambulance ETA (Minutes):</label>
              <input type="number" id="cust-eta-min" class="form-input" value="12" min="1" max="90" required />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Heart Rate (bpm):</label>
              <input type="number" id="cust-hr" class="form-input" value="115" />
            </div>
            <div class="form-group">
              <label class="form-label">Blood Pressure (mmHg):</label>
              <input type="text" id="cust-bp" class="form-input" value="90/55" />
            </div>
            <div class="form-group">
              <label class="form-label">SpO2 (%):</label>
              <input type="number" id="cust-spo2" class="form-input" value="92" />
            </div>
            <div class="form-group">
              <label class="form-label">Paramedic Unit ID:</label>
              <input type="text" id="cust-unit" class="form-input" value="AMB-SIM-42" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Clinical Summary & Vitals Notes:</label>
            <textarea id="cust-notes" class="form-textarea" rows="2" placeholder="Field paramedic clinical triage notes..."></textarea>
          </div>

          <button type="submit" class="btn btn-primary">
            🚀 Submit Paramedic Alert to Hospital Portal
          </button>
        </form>
      </div>

      <!-- Paramedic Case Diversion / Cancellation Simulation -->
      <div style="background: var(--slate-50); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 18px;">
        <h3 style="font-size: 14px; font-weight: 800; color: var(--red-800); margin-bottom: 10px;">
          🛑 Simulate Paramedic Cancellation / Facility Diversion
        </h3>
        <p style="font-size: 12px; color: var(--slate-600); margin-bottom: 12px;">
          Choose an active case to simulate an ambulance redirecting to an alternate trauma center or cancelling in the field.
        </p>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <select id="sim-cancel-case-select" class="form-select" style="max-width: 340px;">
            <option value="" disabled selected>Select an active case...</option>
            ${state.cases.filter(c => !['HANDOVER_COMPLETE', 'CANCELLED'].includes(c.response_status)).map(c => `
              <option value="${escapeHtml(c.case_id)}">#${escapeHtml(c.case_id)} - ${escapeHtml(c.emergency_type)} (${escapeHtml(c.priority)})</option>
            `).join('')}
          </select>
          <button class="btn btn-danger btn-sm" onclick="handleSimCancelClick()">
            Simulate Paramedic Cancellation
          </button>
        </div>
      </div>
    </div>
  `;
}

window.renderSimulatorView = renderSimulatorView;
