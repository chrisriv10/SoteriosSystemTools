window.Pages = window.Pages || {};

window.Pages.dashboard = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="flex-between">
          <div>
            <h1 class="page-title">Security Dashboard</h1>
            <div class="page-subtitle">Windows protection status, startup risk, system health, and prioritized recommendations</div>
          </div>
          <button class="btn" id="refreshDashboard">Refresh</button>
        </div>
      </div>

      <div id="dashboardBody"><div class="empty-state">Checking Windows security posture...</div></div>
    `;

    container.querySelector('#refreshDashboard').addEventListener('click', () => this.load(container));
    this.load(container);
  },

  async load(container) {
    const body = container.querySelector('#dashboardBody');
    body.innerHTML = '<div class="empty-state">Checking Windows security posture...</div>';
    try {
      const data = await Api.runTool('security-overview', {});
      const level = data.level || 'ok';
      const rail = document.getElementById('statusRail');
      if (rail) rail.dataset.level = level;

      body.innerHTML = `
        <div class="grid grid-2 dashboard-top" style="margin-bottom:18px;">
          <div class="panel security-score-panel">
            <div class="panel-title">Overall Security Score</div>
            ${renderScore(data)}
          </div>
          <div class="panel">
            <div class="flex-between" style="margin-bottom:14px;">
              <div class="panel-title" style="margin-bottom:0;">Recommendations</div>
              <button class="btn btn-sm" data-open-page="actions">Open All</button>
            </div>
            <div class="action-list">
              ${data.recommendations.slice(0, 4).map(renderRecommendation).join('')}
            </div>
          </div>
        </div>

        <div class="grid grid-4" style="margin-bottom:18px;">
          ${statusTile('Defender', defenderText(data.defender), defenderLevel(data.defender))}
          ${statusTile('Firewall', firewallText(data.firewall), data.firewall.some((p) => !p.enabled) ? 'danger' : 'ok')}
          ${statusTile('Updates', updatesText(data.updates), data.updates.pendingCount > 0 ? 'warn' : 'ok')}
          ${statusTile('Startup Risk', String(data.startup.risky || 0), (data.startup.risky || 0) ? 'warn' : 'ok')}
        </div>

        <div class="grid grid-3" style="margin-bottom:18px;">
          ${statusTile('Suspicious Processes', String(data.suspiciousProcesses || 0), (data.suspiciousProcesses || 0) ? 'warn' : 'ok')}
          ${statusTile('Disk Health', data.disk ? `${data.disk.usePercent}% used` : 'Unavailable', data.disk && data.disk.usePercent >= 90 ? 'danger' : data.disk && data.disk.usePercent >= 80 ? 'warn' : 'ok')}
          ${statusTile('System Load', `${data.system.cpuLoad}% CPU / ${data.system.memoryUse}% RAM`, data.system.cpuLoad >= 90 || data.system.memoryUse >= 92 ? 'warn' : 'ok')}
        </div>

        <div class="panel">
          <div class="panel-title">Detected Issues</div>
          ${data.issues.length ? data.issues.map(renderIssue).join('') : '<div class="empty-state">No urgent security issues detected.</div>'}
        </div>
      `;

      body.querySelectorAll('[data-open-page]').forEach((btn) => {
        btn.addEventListener('click', () => window.AppRouter.navigate(btn.dataset.openPage));
      });
    } catch (err) {
      showToolError(body, err);
    }
  }
};

function renderScore(data) {
  const score = data.score;
  const color = score >= 80 ? 'var(--ok)' : score >= 60 ? 'var(--warn)' : 'var(--danger)';
  return `
    <div class="score-hero">
      <div class="score-number" style="color:${color}">${score}</div>
      <div>
        <div class="score-label">${escapeHtml(data.level.toUpperCase())}</div>
        <div class="muted-line">Calculated from Defender, firewall, updates, startup persistence, scan history, quarantine, disk, and load.</div>
      </div>
    </div>
  `;
}

function defenderLevel(defender) {
  if (!defender || !defender.available) return 'warn';
  if (!defender.antivirusEnabled || !defender.realTimeProtectionEnabled) return 'danger';
  return Number(defender.signaturesAge) > 7 ? 'warn' : 'ok';
}

function defenderText(defender) {
  if (!defender || !defender.available) return 'Unavailable';
  return defender.realTimeProtectionEnabled ? 'Protected' : 'Protection off';
}

function firewallText(profiles) {
  const disabled = profiles.filter((profile) => !profile.enabled);
  return disabled.length ? `${disabled.length} off` : 'Enabled';
}

function updatesText(updates) {
  if (updates.pendingCount === null || updates.pendingCount === undefined) return 'Unavailable';
  return updates.pendingCount ? `${updates.pendingCount} pending` : 'Current';
}

function statusTile(label, value, level) {
  return `
    <div class="stat-tile">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value ${escapeHtml(level)}">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderRecommendation(item) {
  return `
    <div class="mini-action mini-${escapeHtml(item.level)}">
      <span>${escapeHtml(item.title)}</span>
      <button class="btn btn-sm" data-open-page="${escapeHtml(item.actionPage)}">Open</button>
    </div>
  `;
}

function renderIssue(issue) {
  return `
    <div class="action-item action-${escapeHtml(issue.level)}">
      <div class="action-level">${escapeHtml(issue.level)}</div>
      <div>
        <div class="action-title">${escapeHtml(issue.title)}</div>
        <div class="action-detail">${escapeHtml(issue.detail)}</div>
      </div>
      <button class="btn btn-sm" data-open-page="${escapeHtml(issue.actionPage)}">Review</button>
    </div>
  `;
}
