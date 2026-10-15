/**
 * Immutable Compliance Audit Trail View
 * Implements Security & Privacy spec section 5
 */

function renderAuditView(state) {
  const logs = state.auditLogs || [];

  const rows = logs.map(l => {
    const time = escapeHtml(new Date(l.occurred_at).toLocaleString());
    const isSuccess = l.outcome === 'SUCCESS';
    const safeUserName = escapeHtml(l.user_name || 'System Relay');
    const safeRole = escapeHtml(l.role || 'SYSTEM');
    const safeAction = escapeHtml(l.action);
    const safeTargetType = escapeHtml(l.target_type);
    const safeTargetId = escapeHtml(l.target_id);
    const safeOutcome = escapeHtml(l.outcome);
    const safeIp = escapeHtml(l.ip_address || '127.0.0.1');

    return `
      <tr>
        <td style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-600);">${time}</td>
        <td>
          <strong>${safeUserName}</strong>
          <div style="font-size: 10px; color: var(--slate-500);">${safeRole}</div>
        </td>
        <td>
          <span style="font-family: var(--font-mono); font-weight: 700; font-size: 12px; color: var(--slate-800);">
            ${safeAction}
          </span>
        </td>
        <td>
          <span style="font-size: 11px; background: var(--slate-100); padding: 2px 6px; border-radius: var(--radius-sm); font-family: var(--font-mono);">
            ${safeTargetType}: ${safeTargetId}
          </span>
        </td>
        <td>
          <span style="font-size: 11px; font-weight: 800; color: ${isSuccess ? '#059669' : '#DC2626'};">
            ${safeOutcome}
          </span>
        </td>
        <td style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-500);">${safeIp}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 800; color: var(--slate-900);">🔒 Clinical Audit Trail & Access Logs</h2>
        <p style="font-size: 13px; color: var(--slate-600);">Immutable, append-only record of case views, acknowledgment times, capacity updates, and paramedic instructions.</p>
      </div>

      <div style="background: #F8FAFC; border: 1px solid var(--border-subtle); padding: 14px 18px; border-radius: var(--radius-md); font-size: 12px; color: var(--slate-700); display: flex; align-items: center; gap: 10px;">
        <span>ℹ️</span>
        <span>
          <strong>Data Protection Notice:</strong> In compliance with healthcare privacy mandates, patient names are minimized from audit logs. All accesses to clinical records are permanently logged.
        </span>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Clinician / Actor</th>
              <th>Action Executed</th>
              <th>Target Entity</th>
              <th>Outcome</th>
              <th>Origin IP</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows : '<tr><td colspan="6" style="text-align: center; padding: 32px;">No audit logs found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.renderAuditView = renderAuditView;
