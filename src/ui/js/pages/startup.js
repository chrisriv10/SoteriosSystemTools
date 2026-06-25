window.Pages = window.Pages || {};

window.Pages.startup = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="flex-between">
          <div>
            <h1 class="page-title">Startup Apps</h1>
            <div class="page-subtitle">Registry Run keys, startup folders, scheduled tasks, and Windows services with risk scoring</div>
          </div>
          <button class="btn" id="scanStartup">Scan Startup</button>
        </div>
      </div>

      <div class="grid grid-4" id="startupSummary" style="margin-bottom:18px;"></div>
      <div class="panel" style="padding:0; overflow:hidden;">
        <div id="startupList"><div class="empty-state">Run a startup scan to review persistence entries.</div></div>
      </div>
    `;

    container.querySelector('#scanStartup').addEventListener('click', () => this.load(container));
    this.load(container);
  },

  async load(container) {
    const list = container.querySelector('#startupList');
    const summary = container.querySelector('#startupSummary');
    list.innerHTML = '<div class="empty-state">Scanning startup persistence...</div>';
    try {
      const data = await Api.runTool('startup-persistence-scan', {});
      summary.innerHTML = `
        <div class="stat-tile"><div class="stat-label">Total</div><div class="stat-value">${data.summary.total}</div></div>
        <div class="stat-tile"><div class="stat-label">Risky</div><div class="stat-value ${data.summary.risky ? 'warn' : 'ok'}">${data.summary.risky}</div></div>
        <div class="stat-tile"><div class="stat-label">High Risk</div><div class="stat-value danger">${data.summary.highRisk}</div></div>
        <div class="stat-tile"><div class="stat-label">Services</div><div class="stat-value">${data.summary.services}</div></div>
      `;
      list.innerHTML = `
        <div class="data-table">
          ${data.items.map(renderStartupItem).join('') || '<div class="empty-state">No startup entries found.</div>'}
        </div>
      `;
    } catch (err) {
      showToolError(list, err);
    }
  }
};

function renderStartupItem(item) {
  const signals = (item.risk.signals || []).map((signal) => escapeHtml(signal.message)).join(' ');
  return `
    <div class="data-row ${item.risk.score >= 35 ? 'row-risk' : ''}">
      <div class="risk-pill risk-${escapeHtml(item.risk.level)}">${escapeHtml(item.risk.score)}</div>
      <div>
        <div class="history-title">${escapeHtml(item.name)} <span class="row-meta">${escapeHtml(item.source)}</span></div>
        <div class="history-meta mono">${escapeHtml(item.command || item.path || '')}</div>
        <div class="history-meta">${escapeHtml(item.publisher || item.signatureStatus || 'Publisher unavailable')} - ${escapeHtml(item.recommendedAction)}</div>
        ${signals ? `<div class="history-meta warn">${signals}</div>` : ''}
      </div>
      <div class="metric-pair">
        <span>${escapeHtml(item.location || '')}</span>
        <span>${item.exists ? 'File found' : 'Path not verified'}</span>
      </div>
    </div>
  `;
}
