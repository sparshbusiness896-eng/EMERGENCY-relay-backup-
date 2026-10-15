/**
 * Alert History & Archives View
 * Implements Pages & Navigation spec section 3.9
 */

function renderHistoryView(state) {
  const allCases = state.cases || [];

  const rows = allCases.map(c => {
    const isCritical = c.priority === 'CRITICAL';
    const submittedTime = escapeHtml(new Date(c.submitted_at).toLocaleString());
    const ackTime = c.acknowledged_by
      ? escapeHtml(new Date(c.acknowledged_by.acknowledged_at).toLocaleTimeString())
      : 'N/A';
    const safeCaseId = escapeHtml(c.case_id);
    const safePriority = escapeHtml(c.priority);
    const safeEmergencyType = escapeHtml(c.emergency_type);
    const safeUnit = escapeHtml(c.paramedic ? c.paramedic.unit_id : '');
    const safeStatus = escapeHtml(c.response_status);

    return `
      <tr class="${isCritical ? 'table-row-critical' : ''}">
        <td style="font-family: var(--font-mono); font-weight: 700;">#${safeCaseId}</td>
        <td><span class="badge-priority priority-${escapeHtml(String(c.priority || '').toLowerCase())}">${safePriority}</span></td>
        <td>
          <strong>${safeEmergencyType}</strong>
          <div style="font-size: 11px; color: var(--slate-500);">${safeUnit}</div>
        </td>
        <td>
          <span class="badge-status status-${escapeHtml(String(c.response_status || '').toLowerCase())}">
            ${safeStatus}
          </span>
        </td>
        <td style="font-family: var(--font-mono); font-size: 12px;">${submittedTime}</td>
        <td style="font-family: var(--font-mono); font-size: 12px;">${ackTime}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="handleOpenCaseModal('${safeCaseId}')">
            View Record
          </button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 800; color: var(--slate-900);">📁 Emergency Case Archive & History</h2>
        <p style="font-size: 13px; color: var(--slate-600);">Searchable registry of all paramedic-coordinated emergency transports, response times, and handover outcomes.</p>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Priority</th>
              <th>Emergency Type / Unit</th>
              <th>Status</th>
              <th>Received Time</th>
              <th>Acknowledged At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows : '<tr><td colspan="7" style="text-align:center; padding: 32px;">No historical records found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.renderHistoryView = renderHistoryView;
