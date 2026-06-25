window.Pages = window.Pages || {};

window.Pages.processes = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="flex-between">
          <div>
            <h1 class="page-title">Processes</h1>
            <div class="page-subtitle">Process tree metadata, CPU, memory, executable path, publisher, and suspicious process scoring</div>
          </div>
          <button class="btn" id="refreshBtn">Refresh</button>
        </div>
      </div>

      <div class="panel" style="padding:0; overflow:hidden;">
        <div id="processList"><div class="empty-state">Loading processes...</div></div>
      </div>
    `;

    container.querySelector('#refreshBtn').addEventListener('click', () => this.load(container));
    this.load(container);
  },

  async load(container) {
    const listEl = container.querySelector('#processList');
    listEl.innerHTML = '<div class="empty-state">Loading processes...</div>';
    try {
      const processes = await Api.runTool('process-viewer', {});
      const rows = processes.slice(0, 150).map((p) => `
        <div class="data-row ${p.risk.score >= 35 ? 'row-risk' : ''}">
          <div class="risk-pill risk-${escapeHtml(p.risk.level)}">${escapeHtml(p.risk.score)}</div>
          <div>
            <div class="history-title">${escapeHtml(p.name)} <span class="row-meta">PID ${escapeHtml(p.pid)} / Parent ${escapeHtml(p.ppid || 'n/a')}</span></div>
            <div class="history-meta mono">${escapeHtml(p.path || p.cmd || 'Path unavailable')}</div>
            <div class="history-meta">${escapeHtml(p.publisher || p.signatureStatus || 'Publisher unavailable')} - ${escapeHtml(p.recommendedAction)}</div>
          </div>
          <div class="metric-pair">
            <span>${p.cpu !== null ? p.cpu + '% CPU' : 'CPU n/a'}</span>
            <span>${p.memory !== null ? p.memory + '% RAM' : 'RAM n/a'}</span>
          </div>
        </div>
      `).join('');

      listEl.innerHTML = `<div class="data-table">${rows || '<div class="empty-state">No processes returned.</div>'}</div>`;
    } catch (err) {
      showToolError(listEl, err);
    }
  }
};
