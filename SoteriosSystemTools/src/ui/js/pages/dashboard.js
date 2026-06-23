window.Pages = window.Pages || {};

window.Pages.dashboard = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <div class="page-subtitle">Security posture, device health, and recent maintenance at a glance</div>
      </div>

      <div class="grid grid-2 dashboard-top" style="margin-bottom:18px;">
        <div class="panel">
          <div class="panel-title">System Health Score</div>
          <div class="health-ring-wrap" id="healthRingWrap">
            <div class="empty-state" style="padding:8px 0;">Loading...</div>
          </div>
        </div>

        <div class="panel">
          <div class="flex-between" style="margin-bottom:14px;">
            <div class="panel-title" style="margin-bottom:0;">Action Center</div>
            <button class="btn btn-sm" id="openActions">Open</button>
          </div>
          <div id="dashboardActions"><div class="empty-state">Loading recommendations...</div></div>
        </div>
      </div>

      <div class="grid grid-3" id="statTiles" style="margin-bottom:18px;">
        <div class="stat-tile"><div class="stat-label">CPU Load</div><div class="stat-value">-</div></div>
        <div class="stat-tile"><div class="stat-label">Memory</div><div class="stat-value">-</div></div>
        <div class="stat-tile"><div class="stat-label">Disk Free</div><div class="stat-value">-</div></div>
      </div>

      <div class="panel" style="margin-bottom:18px;">
        <div class="panel-title">System Timeline</div>
        <div class="timeline-bars" id="timelineBars"><div class="empty-state">Collecting timeline sample...</div></div>
      </div>

      <div class="grid grid-2">
        <div class="panel">
          <div class="panel-title">Last Scan</div>
          <div id="lastScanSummary" class="empty-state">No scan has been run yet.</div>
        </div>
        <div class="panel">
          <div class="panel-title">Recent Activity</div>
          <div id="recentActivity" class="history-list"><div class="empty-state">No recent activity yet.</div></div>
        </div>
      </div>
    `;

    container.querySelector('#openActions').addEventListener('click', () => window.AppRouter.navigate('actions'));

    this.loadHealthScore(container);
    this.loadStats(container);
    this.loadActions(container);
    this.loadLastScan(container);
    this.loadRecentActivity(container);
    this.loadTimeline(container);
  },

  async loadHealthScore(container) {
    const wrap = container.querySelector('#healthRingWrap');
    try {
      const scans = await Api.getHistory('scans', 1);
      const latestScan = scans[0] && scans[0].summary;
      const args = {
        lastScanMatches: latestScan ? latestScan.matches : null,
        passwordScore: window.AppState ? window.AppState.lastPasswordScore : null
      };
      const result = await Api.runTool('health-score', args);
      renderHealthRing(wrap, result);

      const rail = document.getElementById('statusRail');
      if (rail) {
        const level = result.score >= 70 ? 'ok' : result.score >= 40 ? 'warn' : 'danger';
        rail.dataset.level = level;
      }
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state">Could not compute health score: ${escapeHtml(err.message)}</div>`;
    }
  },

  async loadStats(container) {
    const tiles = container.querySelector('#statTiles');
    try {
      const data = await Api.runTool('system-monitor', {});
      tiles.innerHTML = `
        <div class="stat-tile">
          <div class="stat-label">CPU Load</div>
          <div class="stat-value ${tileColor(data.cpu.currentLoadPercent, 70, 90)}">${data.cpu.currentLoadPercent}%</div>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${data.cpu.currentLoadPercent}%"></div></div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Memory</div>
          <div class="stat-value ${tileColor(data.memory.usedPercent, 75, 90)}">${data.memory.usedPercent}%</div>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${data.memory.usedPercent}%"></div></div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Disk (primary)</div>
          <div class="stat-value ${tileColor(data.disks[0]?.usePercent || 0, 80, 92)}">${data.disks[0] ? data.disks[0].usePercent + '%' : 'n/a'}</div>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${data.disks[0]?.usePercent || 0}%"></div></div>
        </div>
      `;
    } catch (err) {
      tiles.innerHTML = `<div class="empty-state">Could not load system stats: ${escapeHtml(err.message)}</div>`;
    }
  },

  async loadActions(container) {
    const el = container.querySelector('#dashboardActions');
    try {
      const data = await Api.runTool('action-center', {});
      el.innerHTML = data.items.slice(0, 3).map((item) => `
        <div class="mini-action mini-${escapeHtml(item.level)}">
          <span>${escapeHtml(item.title)}</span>
          <button class="btn btn-sm" data-page="${escapeHtml(item.actionPage)}">Open</button>
        </div>
      `).join('');
      el.querySelectorAll('[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => window.AppRouter.navigate(btn.dataset.page));
      });
    } catch (err) {
      showToolError(el, err);
    }
  },

  async loadTimeline(container) {
    const el = container.querySelector('#timelineBars');
    try {
      await Api.runTool('system-timeline-sample', {});
      const samples = await Api.getHistory('health', 24);
      if (!samples.length) {
        el.innerHTML = '<div class="empty-state">No timeline samples yet.</div>';
        return;
      }
      el.innerHTML = ['cpu', 'memory', 'disk'].map((key) => `
        <div class="timeline-row">
          <div class="timeline-label">${key.toUpperCase()}</div>
          <div class="timeline-track">
            ${samples.slice().reverse().map((sample) => `<span class="timeline-bar ${tileColor(sample[key] || 0, 75, 90)}" style="height:${Math.max(6, sample[key] || 0)}%"></span>`).join('')}
          </div>
        </div>
      `).join('');
    } catch (err) {
      showToolError(el, err);
    }
  },

  async loadLastScan(container) {
    const el = container.querySelector('#lastScanSummary');
    const scans = await Api.getHistory('scans', 1);
    const scan = scans[0];
    if (!scan) return;
    const summary = scan.summary;
    el.classList.remove('empty-state');
    el.innerHTML = `
      <div class="grid grid-4">
        <div class="stat-tile"><div class="stat-label">Scanned</div><div class="stat-value">${summary.totalScanned}</div></div>
        <div class="stat-tile"><div class="stat-label">Clean</div><div class="stat-value ok">${summary.clean}</div></div>
        <div class="stat-tile"><div class="stat-label">Suspicious</div><div class="stat-value warn">${summary.suspicious}</div></div>
        <div class="stat-tile"><div class="stat-label">Matches</div><div class="stat-value danger">${summary.matches}</div></div>
      </div>
      <div class="muted-line" style="margin-top:10px;">${escapeHtml(summary.targetPath)} - ${escapeHtml(new Date(summary.completedAt).toLocaleString())}</div>
    `;
  },

  async loadRecentActivity(container) {
    const el = container.querySelector('#recentActivity');
    const actions = await Api.getHistory('actions', 6);
    if (!actions.length) return;
    el.innerHTML = actions.map((action) => `
      <div class="history-item compact">
        <div>
          <div class="history-title">${escapeHtml(action.title)}</div>
          <div class="history-meta">${escapeHtml(action.detail || '')}</div>
        </div>
        <div class="history-meta">${escapeHtml(new Date(action.createdAt).toLocaleString())}</div>
      </div>
    `).join('');
  }
};

function tileColor(value, warnAt, dangerAt) {
  if (value >= dangerAt) return 'danger';
  if (value >= warnAt) return 'warn';
  return 'ok';
}

function renderHealthRing(wrap, result) {
  const score = result.score;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? 'var(--ok)' : score >= 40 ? 'var(--warn)' : 'var(--danger)';

  const rowsHtml = Object.entries(result.breakdown)
    .map(([, info]) => `
      <div class="health-row">
        <span class="label">${escapeHtml(info.reason)}</span>
        <span class="pts">${info.points}/${info.max}</span>
      </div>
    `)
    .join('');

  wrap.innerHTML = `
    <div class="health-ring">
      <svg width="108" height="108" viewBox="0 0 108 108">
        <circle class="health-ring-track" cx="54" cy="54" r="${radius}"></circle>
        <circle class="health-ring-value" cx="54" cy="54" r="${radius}"
          stroke="${color}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"></circle>
      </svg>
      <div class="health-ring-number" style="color:${color}">${score}</div>
    </div>
    <div class="health-breakdown">${rowsHtml}</div>
  `;
}
