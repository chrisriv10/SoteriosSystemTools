window.Pages = window.Pages || {};
window.Pages['network'] = {
  render(container) {
    container.innerHTML = `
      <header class="page-header">
        <h1 class="page-title">Network Monitor</h1>
        <p class="page-subtitle">Active connections and interface bandwidth</p>
      </header>
      <div id="networkContent">
        <div class="empty-state">Loading network stats\u2026</div>
      </div>
    `;
    this.load(container);
  },
  async load(container) {
    const content = container.querySelector('#networkContent');
    try {
      const [statsResult, connectionsResult] = await Promise.allSettled([
        window.api.invoke('network:stats'),
        window.api.invoke('network:connections')
      ]);
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
      const connections = connectionsResult.status === 'fulfilled' ? connectionsResult.value : null;

      let html = '';

      // Connection state summary
      if (stats && stats.connections) {
        const c = stats.connections;
        html += `<div class="grid grid-5" style="margin-bottom:18px;">
          <div class="stat-tile"><div class="stat-label">Total TCP</div><div class="stat-value">${c.total}</div></div>
          <div class="stat-tile"><div class="stat-label">Established</div><div class="stat-value" style="color:var(--ok);">${c.established}</div></div>
          <div class="stat-tile"><div class="stat-label">Listening</div><div class="stat-value" style="color:var(--accent-primary);">${c.listen}</div></div>
          <div class="stat-tile"><div class="stat-label">Time Wait</div><div class="stat-value" style="color:var(--warn);">${c.timeWait}</div></div>
          <div class="stat-tile"><div class="stat-label">Close Wait</div><div class="stat-value" style="color:var(--danger);">${c.closeWait}</div></div>
        </div>`;
      }

      // Interface bandwidth stats
      if (stats && stats.interfaces && stats.interfaces.length > 0) {
        html += '<h3 style="margin-bottom:10px; font-size:1rem;">Bandwidth</h3><div class="grid grid-3" style="margin-bottom:18px;">';
        for (const iface of stats.interfaces) {
          html += `<div class="stat-tile">
            <div class="stat-label">${escapeHtml(iface.iface)}</div>
            <div class="stat-value" style="font-size:0.85rem;">
              \u25B2 ${iface.txSec} KB/s &nbsp; \u25BC ${iface.rxSec} KB/s
            </div>
            <div style="font-size:0.7rem; color:var(--text-dim);">
              Total: \u25B2 ${iface.txTotal} MB / \u25BC ${iface.rxTotal} MB
            </div>
          </div>`;
        }
        html += '</div>';
      }

      // Active connections list
      html += '<h3 style="margin-bottom:10px; font-size:1rem;">Active Connections (Established)</h3>';
      if (!connections || connections.length === 0) {
        html += '<div class="empty-state">No active connections found.</div>';
      } else {
        html += '<div style="display:flex; flex-direction:column; gap:8px; max-height:400px; overflow-y:auto;">';
        for (const c of connections) {
          const proc = c.OwningProcess ? ` (PID: ${c.OwningProcess})` : '';
          html += `<div class="card" style="display:flex; flex-direction:column; gap:4px; padding:12px 16px; border-left:4px solid var(--accent-primary);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-family:monospace;">${escapeHtml(c.RemoteAddress)}:${escapeHtml(c.RemotePort)}</div>
                <div class="page-subtitle" style="font-size:0.85rem;">Local: ${escapeHtml(c.LocalAddress || '')}:${escapeHtml(c.LocalPort || '')}${proc}</div>
              </div>
            </div>
          </div>`;
        }
        html += '</div>';
      }

      content.innerHTML = html;
    } catch (e) {
      content.innerHTML = `<div class="empty-state">Error loading network: ${escapeHtml(e.message)}</div>`;
    }
  }
};
