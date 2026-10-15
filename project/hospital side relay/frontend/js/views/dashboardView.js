/**
 * Dashboard View (2/3 Alert Feed + 1/3 Capacity Sidebar)
 */

function renderDashboardView(state) {
  // Filter cases based on state.filterStatus and state.searchQuery
  let filtered = [...state.cases];

  if (state.filterStatus === 'NEW') {
    filtered = filtered.filter(c => c.response_status === 'NEW');
  } else if (state.filterStatus === 'PREPARING') {
    filtered = filtered.filter(c => c.response_status === 'PREPARING');
  } else if (state.filterStatus === 'READY') {
    filtered = filtered.filter(c => c.response_status === 'READY');
  } else if (state.filterStatus === 'CRITICAL') {
    filtered = filtered.filter(c => c.priority === 'CRITICAL');
  } else if (state.filterStatus === 'ACTIVE') {
    filtered = filtered.filter(c => !['HANDOVER_COMPLETE', 'CANCELLED', 'UNABLE_TO_RECEIVE'].includes(c.response_status));
  } else {
    // Default 'ALL' excludes closed history from main feed
    filtered = filtered.filter(c => !['HANDOVER_COMPLETE', 'CANCELLED', 'UNABLE_TO_RECEIVE'].includes(c.response_status));
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      c.case_id.toLowerCase().includes(q) ||
      c.emergency_type.toLowerCase().includes(q) ||
      (c.paramedic && c.paramedic.unit_id.toLowerCase().includes(q))
    );
  }

  // Count unacknowledged
  const newCount = state.cases.filter(c => c.response_status === 'NEW').length;

  const cardsHtml = filtered.length > 0
    ? filtered.map(c => renderCaseCard(c)).join('')
    : `
      <div style="background: var(--bg-surface); border: 2px dashed var(--border-subtle); border-radius: var(--radius-lg); padding: 48px; text-align: center; color: var(--slate-500);">
        <div style="font-size: 32px; margin-bottom: 8px;">🚑</div>
        <div style="font-size: 16px; font-weight: 700; color: var(--slate-700);">No Active Emergency Cases Matching Filters</div>
        <p style="font-size: 13px; margin-top: 4px;">Use the Paramedic Relay Simulator in the top right to dispatch a test case.</p>
        <button class="btn btn-primary btn-sm" style="margin-top: 16px;" onclick="AppState.openSimulator()">
          Open Dispatch Simulator
        </button>
      </div>
    `;

  return `
    <!-- Top Filter Bar -->
    <div class="filter-bar">
      <div class="filter-pills">
        <button class="filter-pill ${state.filterStatus === 'ALL' ? 'active' : ''}" onclick="AppState.setFilter('ALL')">
          All Active (${state.cases.filter(c => !['HANDOVER_COMPLETE', 'CANCELLED', 'UNABLE_TO_RECEIVE'].includes(c.response_status)).length})
        </button>
        <button class="filter-pill ${state.filterStatus === 'NEW' ? 'active' : ''}" onclick="AppState.setFilter('NEW')">
          🔔 Needs Acknowledgment (${newCount})
        </button>
        <button class="filter-pill ${state.filterStatus === 'CRITICAL' ? 'active' : ''}" onclick="AppState.setFilter('CRITICAL')">
          ⚠️ Critical Only
        </button>
        <button class="filter-pill ${state.filterStatus === 'PREPARING' ? 'active' : ''}" onclick="AppState.setFilter('PREPARING')">
          ⏳ Preparing
        </button>
        <button class="filter-pill ${state.filterStatus === 'READY' ? 'active' : ''}" onclick="AppState.setFilter('READY')">
          ✓ Ready to Receive
        </button>
      </div>

      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          class="search-input"
          placeholder="Search by Case ID or Emergency Type..."
          value="${escapeHtml(state.searchQuery)}"
          oninput="AppState.setSearch(this.value)"
        />
      </div>
    </div>

    <!-- 2/3 and 1/3 Grid Layout -->
    <div class="dashboard-grid">
      <!-- Left 2/3: Live Emergency Alerts Feed -->
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
          <h2 style="font-size: 16px; font-weight: 800; color: var(--slate-900); display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--red-600);">●</span> Incoming & Active Emergency Transport Alerts
          </h2>
          <span style="font-size: 12px; color: var(--slate-500); font-weight: 600;">
            Showing ${filtered.length} active case${filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        <div id="alert-feed-container">
          ${cardsHtml}
        </div>
      </div>

      <!-- Right 1/3: Real-Time Capacity & Resources Sidebar -->
      <div>
        ${renderCapacityWidget(state.capacity, state.resources)}
      </div>
    </div>
  `;
}

window.renderDashboardView = renderDashboardView;
