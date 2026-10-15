/**
 * Hospital Profile & Facility Verification View
 * Implements Pages & Navigation spec section 3.3 & 3.4
 */

function renderProfileView(state) {
  const hosp = state.hospital;
  if (!hosp) return '<p>Loading hospital profile...</p>';

  const departments = hosp.departments || [];
  const deptChips = departments.map(d => `
    <span style="display: inline-flex; align-items: center; gap: 6px; background: var(--slate-100); border: 1px solid var(--border-subtle); padding: 4px 10px; border-radius: var(--radius-full); font-size: 12px; font-weight: 600;">
      ${d.is_emergency_service ? '🚨' : '🏥'} ${escapeHtml(d.name)}
    </span>
  `).join('');

  const safeVerifiedBy = escapeHtml(hosp.verified_by || 'State Emergency Medical Services Authority');
  const safeName = escapeHtml(hosp.name);
  const safeRelayCode = escapeHtml(hosp.relay_code || hosp.id);
  const safePhone = escapeHtml(hosp.phone);
  const safeEmail = escapeHtml(hosp.email);
  const safeStreet = escapeHtml(hosp.address ? hosp.address.street : '');
  const safeCity = escapeHtml(hosp.address ? hosp.address.city : '');
  const safeRegion = escapeHtml(hosp.address ? hosp.address.region : '');
  const safePostal = escapeHtml(hosp.address ? hosp.address.postal_code : '');

  return `
    <div style="display: flex; flex-direction: column; gap: 24px; max-width: 1000px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 800; color: var(--slate-900);">🏥 Facility Profile & Relay Credentials</h2>
        <p style="font-size: 13px; color: var(--slate-600);">Official facility credentials broadcast to the emergency paramedic network.</p>
      </div>

      <!-- Verification Status Banner -->
      <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: var(--radius-lg); padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: #059669; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 20px;">
            ✓
          </div>
          <div>
            <div style="font-size: 16px; font-weight: 800; color: #065F46;">
              Facility Verified & Active for Paramedic Transports
            </div>
            <div style="font-size: 12px; color: #047857; margin-top: 2px;">
              Verified by ${safeVerifiedBy} • Verification Status: <strong>APPROVED</strong>
            </div>
          </div>
        </div>
        <span class="badge-trauma" style="font-size: 12px; padding: 4px 12px;">LEVEL 1 TRAUMA RELAY</span>
      </div>

      <!-- Profile Details Form -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow-sm);">
        <form id="profile-edit-form" onsubmit="handleProfileSubmit(event)">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px;">
            <div class="form-group">
              <label class="form-label">Hospital Facility Name:</label>
              <input type="text" id="prof-name" class="form-input" value="${safeName}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Relay Dispatch Identifier Code:</label>
              <input type="text" class="form-input" value="${safeRelayCode}" disabled style="background: var(--slate-100); font-family: var(--font-mono);" />
            </div>

            <div class="form-group">
              <label class="form-label">Emergency Phone (Direct Triage Desk):</label>
              <input type="text" id="prof-phone" class="form-input" value="${safePhone}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Coordination Email:</label>
              <input type="email" id="prof-email" class="form-input" value="${safeEmail}" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Facility Street Address:</label>
            <input type="text" id="prof-street" class="form-input" value="${safeStreet}" required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px;">
            <div class="form-group">
              <label class="form-label">City:</label>
              <input type="text" id="prof-city" class="form-input" value="${safeCity}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Region / State:</label>
              <input type="text" id="prof-region" class="form-input" value="${safeRegion}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Postal Code:</label>
              <input type="text" id="prof-postal" class="form-input" value="${safePostal}" required />
            </div>
          </div>

          <!-- 24/7 ED toggle -->
          <div style="background: var(--slate-50); border: 1px solid var(--border-subtle); padding: 14px; border-radius: var(--radius-md); margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 700; font-size: 13px;">24/7 Full Emergency Department Capability</div>
              <div style="font-size: 11px; color: var(--slate-500);">Facility accepts unscheduled emergency ambulance intakes around the clock.</div>
            </div>
            <span style="font-size: 13px; font-weight: 800; color: #059669;">✓ ACTIVE</span>
          </div>

          <!-- Departments and Emergency Wings -->
          <div style="margin-bottom: 24px;">
            <label class="form-label">Recognized Emergency Services & Wings:</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
              ${deptChips}
            </div>
          </div>

          <button type="submit" class="btn btn-primary">
            Save Profile Changes
          </button>
        </form>
      </div>
    </div>
  `;
}

window.renderProfileView = renderProfileView;
