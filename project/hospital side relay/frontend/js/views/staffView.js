/**
 * Staff & Permissions Management View
 * Implements Pages & Navigation spec section 3.8 & Security spec section 2
 */

function renderStaffView(state) {
  const staff = state.staff || [];

  const roleClass = {
    ADMIN: 'role-admin',
    EMERGENCY_STAFF: 'role-emergency',
    CAPACITY_COORDINATOR: 'role-capacity',
    VIEWER_AUDITOR: 'role-auditor'
  };

  const rows = staff.map(s => {
    const safeName = escapeHtml(s.full_name);
    const safeTitle = escapeHtml(s.title);
    const safeEmail = escapeHtml(s.email);
    const safeRole = escapeHtml(s.role || '');
    const safeRoleDisplay = escapeHtml(String(s.role || '').replace('_', ' '));
    const safeStatus = escapeHtml(s.status);
    const safeLastSignIn = s.last_sign_in_at
      ? escapeHtml(new Date(s.last_sign_in_at).toLocaleDateString())
      : 'Never';

    return `
      <tr>
        <td>
          <strong>${safeName}</strong>
          <div style="font-size: 11px; color: var(--slate-500);">${safeTitle}</div>
        </td>
        <td style="font-family: var(--font-mono); font-size: 12px;">${safeEmail}</td>
        <td>
          <span class="badge-role ${roleClass[s.role] || 'role-auditor'}">${safeRoleDisplay}</span>
        </td>
        <td>
          <span style="font-size: 11px; font-weight: 700; color: ${s.status === 'ACTIVE' ? '#059669' : '#D97706'};">
            ● ${safeStatus}
          </span>
        </td>
        <td style="font-size: 12px; color: var(--slate-600);">
          ${s.second_factor_enabled ? '✓ 2FA Enabled' : 'Disabled'}
        </td>
        <td style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-500);">
          ${safeLastSignIn}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 800; color: var(--slate-900);">👥 Staff & Role-Based Access</h2>
          <p style="font-size: 13px; color: var(--slate-600);">Manage authorized hospital clinicians, triage leads, bed coordinators, and compliance auditors.</p>
        </div>
        <button class="btn btn-primary" onclick="openInviteModal()">
          + Invite Clinical Staff
        </button>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Contact Email</th>
              <th>System Role</th>
              <th>Account Status</th>
              <th>2FA Security</th>
              <th>Last Sign-In</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <!-- Role Permissions Matrix Panel -->
      <div style="background: var(--slate-50); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px;">
        <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 12px;">Role Capability Reference:</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; font-size: 12px;">
          <div style="background: #FFFFFF; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <strong style="color: var(--red-800);">ADMIN:</strong>
            <p style="color: var(--slate-600); margin-top: 4px;">Manage facility profile, invite/deactivate staff, view full cases, dispatch updates, full audit access.</p>
          </div>
          <div style="background: #FFFFFF; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <strong style="color: #1D4ED8;">EMERGENCY STAFF:</strong>
            <p style="color: var(--slate-600); margin-top: 4px;">Watch live alerts, acknowledge cases, update triage status, send instructions to paramedics.</p>
          </div>
          <div style="background: #FFFFFF; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <strong style="color: #B45309;">CAPACITY COORDINATOR:</strong>
            <p style="color: var(--slate-600); margin-top: 4px;">Update beds, ICU counts, surgical suites, specialists on duty, and confirm data freshness.</p>
          </div>
          <div style="background: #FFFFFF; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <strong style="color: #475569;">VIEWER / AUDITOR:</strong>
            <p style="color: var(--slate-600); margin-top: 4px;">Read-only inspection of case statistics and immutable audit trail for security compliance.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.renderStaffView = renderStaffView;
