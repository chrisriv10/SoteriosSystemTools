window.Pages = window.Pages || {};
window.Pages.processes = {
  render(container) {
    container.innerHTML = `
      <div class="page-header"><div class="flex-between">
        <div><h1 class="page-title">Processes</h1><div class="page-subtitle">Running processes with risk scoring</div></div>
        <button class="btn" id="refreshBtn">Refresh</button></div></div>
      <div class="card" style="padding:0; flex:1; overflow-y:auto; border:none; background:transparent;"><div id="processList" style="padding-right:8px;"><div class="empty-state">Loading processes...</div></div></div>`;
    container.querySelector('#refreshBtn').addEventListener('click', () => this.load(container));
    this.load(container);
  },
  async load(container) {
    const listEl = container.querySelector('#processList');
    listEl.innerHTML = '<div class="empty-state">Loading processes...</div>';
    try {
      const processes = await Api.runTool('process-viewer', {});
      const rows = processes.slice(0, 150).map((p) => {
        const rawPath = p.path || p.cmd || '';
        const shortPath = truncatePath(rawPath || 'Path unavailable', 56);
        const command = p.cmd && p.cmd !== p.path ? truncatePath(p.cmd, 72) : '';
        return `
        <div class="card" style="display:flex; flex-direction:column; gap:8px; padding:16px; border-left: 4px solid ${p.risk.score >= 35 ? 'var(--accent-danger)' : 'var(--accent-success)'};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="min-width:0;">
              <div style="font-weight:600; font-size:1.1rem;">${escapeHtml(p.name)} <span class="page-subtitle" style="font-size:0.85rem;">(PID ${escapeHtml(p.pid)})</span></div>
              <div class="path-chip" title="${escapeHtml(rawPath)}">${escapeHtml(shortPath)}</div>
              ${command ? `<div class="history-meta mono" style="margin-top:4px;" title="${escapeHtml(p.cmd)}">Args: ${escapeHtml(command)}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <div style="font-weight:600; font-size:1.1rem; color:${p.risk.score >= 35 ? 'var(--accent-danger)' : 'var(--accent-success)'}">${escapeHtml(p.risk.score)} Risk</div>
              <div class="page-subtitle" style="font-size:0.8rem; text-transform:uppercase;">${escapeHtml(p.risk.level)}</div>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid var(--glass-border);">
            <div style="font-size:0.85rem; color:var(--accent-warning);">${escapeHtml(p.recommendedAction)}</div>
            <div style="display:flex; gap:16px; font-size:0.85rem; font-weight:500;">
              <span>${p.cpu !== null ? p.cpu + '% CPU' : 'CPU n/a'}</span>
              <span>${p.memory !== null ? p.memory + '% RAM' : 'RAM n/a'}</span>
            </div>
          </div>
        </div>`;
      }).join('');
      listEl.innerHTML = `<div style="display:flex; flex-direction:column; gap:12px;">${rows || '<div class="empty-state">No processes returned.</div>'}</div>`;
    } catch (err) { showToolError(listEl, err); }
  }
};
