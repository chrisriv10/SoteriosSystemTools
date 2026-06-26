window.Pages = window.Pages || {};
window.Pages['firewall'] = {
  render(container) {
    container.innerHTML = `
      <header class="page-header">
        <h1 class="page-title">Firewall Management</h1>
        <p class="page-subtitle">Windows Firewall Profiles and Rule Summary</p>
      </header>
      <div id="firewallContent">
        <div class="empty-state">Loading firewall profiles\u2026</div>
      </div>
    `;
    this.load(container);
  },
  async load(container) {
    const content = container.querySelector('#firewallContent');
    try {
      const [profiles, rules] = await Promise.all([
        window.api.invoke('firewall:status'),
        window.api.invoke('firewall:rules')
      ]);

      let html = '';

      // Rules summary
      if (rules) {
        html += `<div class="grid grid-4" style="margin-bottom:18px;">
          <div class="stat-tile"><div class="stat-label">Total Rules</div><div class="stat-value">${rules.total}</div></div>
          <div class="stat-tile"><div class="stat-label">Inbound / Outbound</div><div class="stat-value">${rules.inbound} / ${rules.outbound}</div></div>
          <div class="stat-tile"><div class="stat-label">Allow / Block</div><div class="stat-value" style="color:var(--ok);">${rules.allow} / <span style="color:var(--danger);">${rules.block}</span></div></div>
          <div class="stat-tile"><div class="stat-label">Enabled / Disabled</div><div class="stat-value" style="color:var(--ok);">${rules.enabled} / <span style="color:var(--text-dim);">${rules.disabled}</span></div></div>
        </div>`;
        html += `<div class="grid grid-3" style="margin-bottom:18px;">
          <div class="stat-tile"><div class="stat-label">Domain Rules</div><div class="stat-value">${rules.profiles.domain}</div></div>
          <div class="stat-tile"><div class="stat-label">Private Rules</div><div class="stat-value">${rules.profiles.private}</div></div>
          <div class="stat-tile"><div class="stat-label">Public Rules</div><div class="stat-value">${rules.profiles.public}</div></div>
        </div>`;
      }

      // Profile cards
      let list = profiles;
      if (!Array.isArray(list)) list = [list];
      html += '<div class="dashboard-grid">';
      for (const res of list) {
        if (!res) continue;
        const enabled = res.Enabled === 1 || res.Enabled === true;
        const iconClass = enabled ? 'safe' : 'danger';
        const iconSvg = enabled
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
          : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
        html += `<div class="card" style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:center; gap:16px;">
            <div class="status-icon ${iconClass}" style="width:40px;height:40px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;">${iconSvg}</svg>
            </div>
            <div style="flex:1; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-size:1.1rem;">${escapeHtml(res.Name || 'Profile')}</div>
                <div class="page-subtitle" style="font-size:0.85rem; margin-top:2px;">
                  Status: <span style="color:${enabled ? 'var(--ok)' : 'var(--danger)'}; font-weight:600;">${enabled ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>
          </div>
          ${rules ? `<div style="display:flex; gap:16px; font-size:0.85rem; color:var(--text-dim);">
            <span>Rules affecting this profile: ${rules.profiles[((res.Name || '').toLowerCase())] || 0}</span>
          </div>` : ''}
        </div>`;
      }
      html += '</div>';
      content.innerHTML = html;
    } catch (e) {
      content.innerHTML = `<div class="empty-state">Error loading firewall: ${escapeHtml(e.message)}</div>`;
    }
  }
};
