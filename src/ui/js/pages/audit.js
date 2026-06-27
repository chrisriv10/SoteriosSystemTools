window.Pages = window.Pages || {};
window.Pages['audit'] = {
  render(container) {
    container.innerHTML = `
      <header class="page-header">
        <h1 class="page-title">Windows Security Audit</h1>
        <p class="page-subtitle">Comprehensive check of system security policies and configurations</p>
      </header>
      <div id="auditContent">
        <div class="empty-state">Running audit checks\u2026</div>
      </div>
    `;
    this.load(container);
  },
  async load(container) {
    const content = container.querySelector('#auditContent');
    try {
      const results = await window.api.invoke('audit:run');
      const ignored = await window.api.invoke('warnings:listIgnored');
      const ignoredIds = new Set((ignored || []).map((w) => w.id));
      if (!results || results.length === 0) {
        content.innerHTML = '<div class="empty-state">No audit results returned.</div>';
        return;
      }
      let pass = 0, fail = 0, warn = 0, err = 0;
      const visibleResults = results.filter((r) => !ignoredIds.has(this.warningId(r)));
      visibleResults.forEach(r => { if (r.status === 'pass') pass++; else if (r.status === 'fail') fail++; else if (r.status === 'warn') warn++; else if (r.status === 'error') err++; });
      let html = `<div class="grid grid-4" style="margin-bottom:18px;">
        <div class="stat-tile"><div class="stat-label">Passed</div><div class="stat-value" style="color:var(--ok);">${pass}</div></div>
        <div class="stat-tile"><div class="stat-label">Failed</div><div class="stat-value" style="color:var(--danger);">${fail}</div></div>
        <div class="stat-tile"><div class="stat-label">Warnings</div><div class="stat-value" style="color:var(--warn);">${warn}</div></div>
        <div class="stat-tile"><div class="stat-label">Errors</div><div class="stat-value" style="color:var(--text-dim);">${err}</div></div>
      </div>`;
      html += '<div class="dashboard-grid">';
      for (const res of visibleResults) {
        let iconClass = 'info';
        let iconSvg = '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>';
        let statusLabel = 'Info';
        if (res.status === 'pass') { iconClass = 'safe'; iconSvg = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'; statusLabel = 'Pass'; }
        else if (res.status === 'fail') { iconClass = 'danger'; iconSvg = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'; statusLabel = 'Fail'; }
        else if (res.status === 'warn') { iconClass = 'warning'; iconSvg = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'; statusLabel = 'Warn'; }
        else if (res.status === 'error') { iconClass = 'danger'; iconSvg = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'; statusLabel = 'Error'; }
        html += `<div class="card" style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:center; gap:16px;">
            <div class="status-icon ${iconClass}" style="width:40px;height:40px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;">${iconSvg}</svg>
            </div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:600; font-size:1.1rem;">${escapeHtml(res.name)}</div>
                <span style="font-size:0.8rem; font-weight:600; text-transform:uppercase; color:${iconClass === 'safe' ? 'var(--ok)' : iconClass === 'danger' ? 'var(--danger)' : 'var(--warn)'};">${statusLabel}</span>
              </div>
              <div class="page-subtitle" style="font-size:0.9rem; margin-top:4px;">${escapeHtml(res.message)}</div>
            </div>
          </div>
          ${res.detail ? `<div style="font-size:0.85rem; color:var(--text-dim); padding:8px; background:var(--bg-surface); border-radius:6px; font-family:monospace;">${escapeHtml(res.detail)}</div>` : ''}
          ${res.recommendation ? `<div style="font-size:0.85rem;"><strong>Recommendation:</strong> ${escapeHtml(res.recommendation)}</div>` : ''}
          ${res.status === 'warn' || res.status === 'fail' ? `<button class="btn btn-sm audit-ignore" data-id="${escapeHtml(this.warningId(res))}" data-title="${escapeHtml(res.name)}" data-detail="${escapeHtml(res.message || res.detail || '')}">Ignore Warning</button>` : ''}
        </div>`;
      }
      html += '</div>';
      if ((ignored || []).some((w) => String(w.id || '').startsWith('audit:'))) {
        html += `<div class="panel" style="margin-top:18px;"><div class="panel-title">Ignored Audit Warnings</div>
          <div class="history-list">${ignored.filter((w) => String(w.id || '').startsWith('audit:')).map((w) => `
            <div class="history-item"><div><div class="history-title">${escapeHtml(w.title)}</div><div class="history-meta">${escapeHtml(w.detail || '')}</div></div>
            <button class="btn btn-sm audit-restore" data-id="${escapeHtml(w.id)}">Restore</button></div>`).join('')}</div></div>`;
      }
      content.innerHTML = html;
      content.querySelectorAll('.audit-ignore').forEach((btn) => btn.addEventListener('click', async () => {
        const card = btn.closest('.card');
        btn.disabled = true;
        try {
          await window.api.invoke('warnings:ignore', { id: btn.dataset.id, title: btn.dataset.title, detail: btn.dataset.detail });
          if (card) card.remove();
          await this.load(container);
        } catch (err) {
          btn.disabled = false;
          alert(err.message || 'Unable to ignore warning.');
        }
      }));
      content.querySelectorAll('.audit-restore').forEach((btn) => btn.addEventListener('click', async () => {
        const item = btn.closest('.history-item');
        btn.disabled = true;
        try {
          await window.api.invoke('warnings:unignore', btn.dataset.id);
          if (item) item.remove();
          await this.load(container);
        } catch (err) {
          btn.disabled = false;
          alert(err.message || 'Unable to restore warning.');
        }
      }));
    } catch (e) {
      content.innerHTML = `<div class="empty-state">Error running audit: ${escapeHtml(e.message)}</div>`;
    }
  }
  ,
  warningId(result) {
    return 'audit:' + String(result.name || result.message || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
};
