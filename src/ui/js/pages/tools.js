window.Pages = window.Pages || {};
window.Pages.tools = {
  allowedScripts: [
    'clear-temp-files',
    'large-files-report',
    'list-startup-items',
    'browser-cache-report',
    'disk-space-report',
    'windows-services-report'
  ],

  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Tools & Maintenance</h1>
        <div class="page-subtitle">Run focused maintenance checks.</div>
      </div>
      <div id="scriptList" class="dashboard-grid compact"></div>
      <div class="card" style="padding:0; overflow:hidden; margin-top:24px;">
        <div style="padding:16px; background:var(--bg-surface-hover); border-bottom:1px solid var(--glass-border); font-weight:600; display:flex; justify-content:space-between; align-items:center;">
          <span>Output</span>
          <button class="btn btn-sm" id="clearOutputBtn" style="display:none;">Clear</button>
        </div>
        <div class="log-surface" id="toolOutput" style="padding:16px; min-height:240px; max-height:460px; overflow-y:auto;"><div class="empty-state"></div></div>
      </div>`;
    this.load(container);
  },

  async load(container) {
    const scriptList = container.querySelector('#scriptList');
    container.querySelector('#clearOutputBtn').addEventListener('click', () => {
      container.querySelector('#toolOutput').innerHTML = '<div class="empty-state">Cleared.</div>';
      container.querySelector('#clearOutputBtn').style.display = 'none';
    });

    try {
      const scripts = (await Api.runTool('list-scripts', {}))
        .filter((script) => this.allowedScripts.includes(script.id))
        .sort((a, b) => this.allowedScripts.indexOf(a.id) - this.allowedScripts.indexOf(b.id));
      scriptList.innerHTML = scripts.map((s) => `
        <div class="card compact" style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="status-icon info" style="width:38px;height:38px;">${iconFor(this.iconForScript(s.id))}</div>
            <div style="font-weight:600;">${escapeHtml(s.name)}</div>
          </div>
          <div class="page-subtitle" style="font-size:0.85rem;">${escapeHtml(s.description)}</div>
          <div class="history-meta" data-complete-for="${escapeHtml(s.id)}">Not run yet.</div>
          <button class="btn btn-primary btn-sm" data-script-id="${escapeHtml(s.id)}">Run</button>
        </div>`).join('');
      scriptList.querySelectorAll('[data-script-id]').forEach((btn) => btn.addEventListener('click', () => this.runScript(container, btn)));
    } catch (err) {
      showToolError(scriptList, err);
    }
  },

  iconForScript(id) {
    return {
      'clear-temp-files': 'archive',
      'large-files-report': 'search',
      'list-startup-items': 'list',
      'browser-cache-report': 'archive',
      'disk-space-report': 'activity',
      'windows-services-report': 'list-checks'
    }[id] || 'terminal';
  },

  async runScript(container, btn) {
    const scriptId = btn.dataset.scriptId;
    const output = container.querySelector('#toolOutput');
    const status = container.querySelector(`[data-complete-for="${scriptId}"]`);
    const scriptArgs = scriptId === 'clear-temp-files' ? { dryRun: false } : {};
    setButtonLoading(btn, true, 'Running...');
    output.innerHTML = '<div class="empty-state">Running...</div>';
    if (status) status.textContent = 'Running...';
    try {
      const result = await Api.runTool('run-script', { scriptId, scriptArgs });
      const when = new Date().toLocaleString();
      if (status) status.textContent = `Completed ${when}`;
      output.innerHTML = this.renderOutput(scriptId, result, when);
    } catch (err) {
      if (status) status.textContent = 'Failed.';
      showToolError(output, err);
    } finally {
      setButtonLoading(btn, false);
      container.querySelector('#clearOutputBtn').style.display = 'block';
    }
  },

  renderOutput(scriptId, result, when) {
    let html = `<div class="log-row" style="background:var(--panel-raised);"><span class="log-tag clean">done</span><span class="log-path">Completed ${escapeHtml(when)}</span></div>`;
    if (scriptId === 'clear-temp-files') {
      html += `<div class="log-row"><span class="log-tag clean">cleared</span><span class="log-path">${result.deletedCount || 0} file(s), ${result.freedMB || 0} MB freed from ${escapeHtml(result.tempDir || 'temp')}</span></div>`;
      html += (result.log || []).slice(0, 120).map(line => `<div class="log-row"><span class="log-path">${escapeHtml(line)}</span></div>`).join('');
    } else if (scriptId === 'disk-space-report' && Array.isArray(result.volumes)) {
      html += result.volumes.map(v => `<div class="log-row"><span class="log-tag ${v.usePercent > 90 ? 'match' : v.usePercent > 75 ? 'warn' : 'clean'}">${v.usePercent}%</span><span class="log-path">${escapeHtml(v.mount)} - ${v.usedGB}/${v.sizeGB} GB used, ${v.freeGB} GB free</span></div>`).join('');
    } else if (scriptId === 'browser-cache-report' && Array.isArray(result.browsers)) {
      html += `<div class="log-row"><span class="log-tag info">total</span><span class="log-path">${result.totalMB || 0} MB</span></div>`;
      html += result.browsers.map(b => `<div class="log-row"><span class="log-tag ${b.exists ? 'info' : 'warn'}">${b.sizeMB || 0} MB</span><span class="log-path">${escapeHtml(b.name)}${b.exists ? '' : ' (not found)'}</span></div>`).join('');
    } else if (scriptId === 'large-files-report' && Array.isArray(result.files)) {
      html += `<div class="log-row"><span class="log-tag info">${result.count || 0}</span><span class="log-path">Files over ${result.minSizeMB || 0} MB under ${escapeHtml(result.root || '')}</span></div>`;
      html += result.files.slice(0, 100).map(f => `<div class="log-row"><span class="log-tag warn">${f.sizeMB} MB</span><span class="log-path">${escapeHtml(f.path)}</span></div>`).join('');
    } else if (scriptId === 'list-startup-items' && Array.isArray(result.items)) {
      html += `<div class="log-row"><span class="log-tag info">${result.itemCount || result.items.length}</span><span class="log-path">${escapeHtml(result.note || 'Startup entries')}</span></div>`;
      html += result.items.map(item => `<div class="log-row"><span class="log-tag info">item</span><span class="log-path">${escapeHtml(JSON.stringify(item))}</span></div>`).join('');
    } else if (scriptId === 'windows-services-report') {
      html += `<div class="log-row"><span class="log-tag info">${result.autoStartCount || 0}</span><span class="log-path">Auto-start services, ${result.flaggedCount || 0} flagged</span></div>`;
      html += (result.flagged || []).map(s => `<div class="log-row"><span class="log-tag match">flag</span><span class="log-path">${escapeHtml(s.displayName || s.name)} ${s.pathName ? '(' + escapeHtml(s.pathName) + ')' : ''}</span></div>`).join('');
      html += (result.services || []).slice(0, 120).map(s => `<div class="log-row"><span class="log-tag clean">${escapeHtml(s.state || '')}</span><span class="log-path">${escapeHtml(s.displayName || s.name)}</span></div>`).join('');
    } else {
      html += `<pre class="log-path" style="white-space:pre-wrap;">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
    }
    return html;
  }
};
