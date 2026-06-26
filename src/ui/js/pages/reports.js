window.Pages = window.Pages || {};

window.Pages.reports = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="flex-between">
          <div>
            <h1 class="page-title">Reports</h1>
            <div class="page-subtitle">Export local HTML and JSON security reports for review or support records</div>
          </div>
          <button class="btn btn-primary" id="generateReport">${iconFor('list-checks')} Generate Security Report</button>
        </div>
      </div>

      <div class="panel" style="margin-bottom:18px;">
        <div class="panel-title">Latest Export</div>
        <div id="reportResult" class="empty-state">No report generated in this session.</div>
      </div>

      <div class="panel" style="margin-bottom:18px;">
        <div class="panel-title">Scan Reports</div>
        <div id="scanReportHistory" class="history-list"><div class="empty-state">Loading scan reports...</div></div>
      </div>

      <div class="panel">
        <div class="panel-title">Saved Security Reports</div>
        <div id="reportHistory" class="history-list"><div class="empty-state">Loading saved reports\u2026</div></div>
      </div>
    `;

    container.querySelector('#generateReport').addEventListener('click', () => this.generate(container));
    this.listScanReports(container);
    this.listReports(container);
  },

  async generate(container) {
    const btn = container.querySelector('#generateReport');
    const result = container.querySelector('#reportResult');
    setButtonLoading(btn, true, 'Generating\u2026');
    result.innerHTML = '<div class="empty-state">Collecting security checks and writing report\u2026</div>';
    try {
      const appInfo = await Api.getAppInfo();
      const data = await Api.runTool('generate-security-report', { version: appInfo.version });
      result.classList.remove('empty-state');
      result.innerHTML = `
        <div class="history-title">Security report generated</div>
        <div class="history-meta">Score: <span class="${data.report.overview.level}">${data.report.overview.score}</span></div>
        <div class="history-mono mono">HTML: ${escapeHtml(data.files.html)}</div>
        <div class="history-mono mono">JSON: ${escapeHtml(data.files.json)}</div>
      `;
      this.listReports(container);
    } catch (err) {
      result.innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
    } finally {
      setButtonLoading(btn, false);
    }
  },

  async listScanReports(container) {
    const el = container.querySelector('#scanReportHistory');
    try {
      const reports = await window.api.invoke('scanReports:list', 25);
      if (!reports.length) {
        el.innerHTML = '<div class="empty-state">No scan reports saved yet.</div>';
        return;
      }
      el.innerHTML = reports.map((r) => {
        const statusClass = r.status === 'completed' ? 'clean' : r.status === 'canceled' ? 'warn' : 'match';
        const targets = Array.isArray(r.target_paths) ? r.target_paths.join(', ') : '';
        return `
          <div class="history-item">
            <div style="min-width:0;">
              <div class="history-title">${escapeHtml(r.scan_type)} scan <span class="log-tag ${statusClass}">${escapeHtml(r.status)}</span></div>
              <div class="history-meta">${escapeHtml(new Date(r.timestamp).toLocaleString())} | ${r.files_scanned} file(s), ${r.threats_found} threat(s), ${Math.round((r.duration_ms || 0) / 1000)}s</div>
              <div class="history-meta mono">${escapeHtml(targets)}</div>
              <div class="history-mono mono">HTML: ${escapeHtml(r.html_path || '')}</div>
              <div class="history-mono mono">JSON: ${escapeHtml(r.json_path || '')}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm open-scan-report" data-path="${escapeHtml(r.html_path || r.json_path || '')}">Open</button>
              <button class="btn btn-sm delete-scan-report" data-id="${escapeHtml(r.id)}">Delete</button>
            </div>
          </div>`;
      }).join('');
      el.querySelectorAll('.open-scan-report').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.dataset.path) window.api.invoke('shell:showItemInFolder', btn.dataset.path);
        });
      });
      el.querySelectorAll('.delete-scan-report').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const res = await window.api.invoke('scanReports:delete', Number(btn.dataset.id));
          if (!res.success) alert(res.error || 'Unable to delete report.');
          this.listScanReports(container);
        });
      });
    } catch (err) {
      el.innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
    }
  },

  async listReports(container) {
    const el = container.querySelector('#reportHistory');
    try {
      const files = await window.api.invoke('reports:list');
      if (!files.length) {
        el.innerHTML = '<div class="empty-state">No saved reports found.</div>';
        return;
      }
      el.innerHTML = files.map((f) => `
        <div class="history-item" style="cursor:pointer;">
          <div>
            <div class="history-title">${escapeHtml(f.name)}</div>
            <div class="history-meta mono">${escapeHtml(f.path)}</div>
            <div class="history-meta">${escapeHtml(new Date(f.mtime).toLocaleString())}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm open-report" data-path="${escapeHtml(f.path)}">Open</button>
            <button class="btn btn-sm delete-report" data-path="${escapeHtml(f.path)}">Delete</button>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('.open-report').forEach(btn => {
        btn.addEventListener('click', () => {
          window.api.invoke('shell:showItemInFolder', btn.dataset.path);
        });
      });
      el.querySelectorAll('.delete-report').forEach(btn => {
        btn.addEventListener('click', async () => {
          const res = await window.api.invoke('reports:delete', btn.dataset.path);
          if (!res.success) alert(res.error || 'Unable to delete report.');
          this.listReports(container);
        });
      });
    } catch (err) {
      el.innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
    }
  }
};
