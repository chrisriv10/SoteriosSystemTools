window.Pages = window.Pages || {};

window.Pages.reports = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div class="flex-between">
          <div>
            <h1 class="page-title">Reports</h1>
            <div class="page-subtitle">Browse scan and security reports</div>
          </div>
          <button class="btn btn-primary" id="generateReport">${iconFor('list-checks')} Generate Security Report</button>
        </div>
      </div>

      <div class="reports-layout">
        <section class="panel report-browser">
          <div class="panel-title">Scan Reports</div>
          <div id="scanReportHistory" class="history-list"><div class="empty-state">Loading scan reports...</div></div>

          <div class="panel-title" style="margin-top:18px;">Saved Security Reports</div>
          <div id="reportHistory" class="history-list"><div class="empty-state">Loading saved reports...</div></div>
        </section>

        <section class="panel report-viewer">
          <div class="flex-between">
            <div>
              <div class="panel-title">Report Viewer</div>
              <div id="reportViewerTitle" class="history-title">Select a report</div>
            </div>
            <button class="btn btn-sm" id="closeReportViewer" style="display:none;">Close</button>
          </div>
          <div id="reportResult" class="empty-state">Choose a report from the list to view its details.</div>
        </section>
      </div>
    `;

    container.querySelector('#generateReport').addEventListener('click', () => this.generate(container));
    container.querySelector('#closeReportViewer').addEventListener('click', () => this.clearViewer(container));
    this.listScanReports(container);
    this.listReports(container);
  },

  clearViewer(container) {
    container.querySelector('#reportViewerTitle').textContent = 'Select a report';
    container.querySelector('#closeReportViewer').style.display = 'none';
    container.querySelector('#reportResult').className = 'empty-state';
    container.querySelector('#reportResult').innerHTML = 'Choose a report from the list to view its details without leaving the app.';
  },

  showViewer(container, title, html) {
    container.querySelector('#reportViewerTitle').textContent = title;
    container.querySelector('#closeReportViewer').style.display = 'inline-flex';
    const result = container.querySelector('#reportResult');
    result.className = 'report-content';
    result.innerHTML = html;
  },

  renderScanReport(r) {
    const details = r.details || {};
    const threats = details.threats || [];
    const errors = details.errors || [];
    const targets = Array.isArray(r.target_paths) ? r.target_paths : [];
    return `
      <div class="report-stats">
        <div class="stat-tile"><div class="stat-label">Status</div><div class="stat-value ${r.status === 'completed' ? 'ok' : r.status === 'canceled' ? 'warn' : 'danger'}">${escapeHtml(r.status)}</div></div>
        <div class="stat-tile"><div class="stat-label">Files</div><div class="stat-value">${escapeHtml(r.files_scanned)}</div></div>
        <div class="stat-tile"><div class="stat-label">Threats</div><div class="stat-value ${r.threats_found ? 'danger' : 'ok'}">${escapeHtml(r.threats_found)}</div></div>
        <div class="stat-tile"><div class="stat-label">Duration</div><div class="stat-value">${Math.round((r.duration_ms || 0) / 1000)}s</div></div>
      </div>
      <div class="report-section"><div class="panel-title">Targets</div><pre>${escapeHtml(targets.join('\n') || 'No targets recorded.')}</pre></div>
      <div class="report-section"><div class="panel-title">Threat Details</div>
        ${threats.length ? threats.map((t) => `<div class="log-row"><span class="log-tag match">threat</span><span class="log-path">${escapeHtml(t.name || 'Threat')} - ${escapeHtml(t.path || '')}</span></div>`).join('') : '<div class="empty-state compact-empty">No threats found.</div>'}
      </div>
      <div class="report-section"><div class="panel-title">Errors and Notes</div>
        ${errors.length ? errors.map((e) => `<div class="log-row"><span class="log-tag warn">note</span><span class="log-path">${escapeHtml(e)}</span></div>`).join('') : '<div class="empty-state compact-empty">No scan errors recorded.</div>'}
      </div>`;
  },

  renderSecurityReport(report) {
    const overview = report.overview || {};
    const recommendations = report.recommendations || overview.recommendations || [];
    return `
      <div class="report-stats">
        <div class="stat-tile"><div class="stat-label">App</div><div class="stat-value">${escapeHtml((report.app && report.app.name) || 'Soterios')}</div></div>
        <div class="stat-tile"><div class="stat-label">Version</div><div class="stat-value">${escapeHtml((report.app && report.app.version) || '')}</div></div>
        <div class="stat-tile"><div class="stat-label">Score</div><div class="stat-value ${escapeHtml(overview.level || '')}">${escapeHtml(overview.score ?? 'N/A')}</div></div>
        <div class="stat-tile"><div class="stat-label">Generated</div><div class="stat-value small">${escapeHtml(report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '')}</div></div>
      </div>
      <div class="report-section"><div class="panel-title">Recommendations</div>
        ${recommendations.length ? recommendations.map((i) => `<div class="log-row"><span class="log-tag ${i.level === 'danger' ? 'match' : i.level === 'warn' ? 'warn' : 'clean'}">${escapeHtml(i.level)}</span><span class="log-path"><strong>${escapeHtml(i.title)}</strong><br>${escapeHtml(i.detail || '')}</span></div>`).join('') : '<div class="empty-state compact-empty">No recommendations recorded.</div>'}
      </div>
      <div class="report-section"><div class="panel-title">System Snapshot</div><pre>${escapeHtml(JSON.stringify(report.system || {}, null, 2))}</pre></div>`;
  },

  async generate(container) {
    const btn = container.querySelector('#generateReport');
    setButtonLoading(btn, true, 'Generating...');
    try {
      const appInfo = await Api.getAppInfo();
      const data = await Api.runTool('generate-security-report', { version: appInfo.version });
      this.showViewer(container, 'Generated security report', this.renderSecurityReport(data.report));
      this.listReports(container);
    } catch (err) {
      this.showViewer(container, 'Report error', `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`);
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
        return `
          <div class="history-item">
            <div style="min-width:0;">
              <div class="history-title">${escapeHtml(r.scan_type)} scan <span class="log-tag ${statusClass}">${escapeHtml(r.status)}</span></div>
              <div class="history-meta">${escapeHtml(new Date(r.timestamp).toLocaleString())} | ${r.files_scanned} file(s), ${r.threats_found} threat(s)</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm open-scan-report" data-id="${escapeHtml(r.id)}">View</button>
              <button class="btn btn-sm delete-scan-report" data-id="${escapeHtml(r.id)}">Delete</button>
            </div>
          </div>`;
      }).join('');
      el.querySelectorAll('.open-scan-report').forEach((btn) => {
        btn.addEventListener('click', () => {
          const report = reports.find((r) => String(r.id) === String(btn.dataset.id));
          if (report) this.showViewer(container, `${report.scan_type} scan - ${new Date(report.timestamp).toLocaleString()}`, this.renderScanReport(report));
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
        <div class="history-item">
          <div style="min-width:0;">
            <div class="history-title">${escapeHtml(f.name)}</div>
            <div class="history-meta">${escapeHtml(new Date(f.mtime).toLocaleString())}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm open-report" data-path="${escapeHtml(f.path)}">View</button>
            <button class="btn btn-sm delete-report" data-path="${escapeHtml(f.path)}">Delete</button>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('.open-report').forEach(btn => {
        btn.addEventListener('click', async () => {
          const res = await window.api.invoke('reports:read', btn.dataset.path);
          if (!res.success) { alert(res.error || 'Unable to read report.'); return; }
          const title = btn.dataset.path.split('\\').pop();
          if (res.type === 'json') this.showViewer(container, title, this.renderSecurityReport(res.data));
          else this.showViewer(container, title, `<div class="report-section"><pre>${escapeHtml(res.text || 'No readable content.')}</pre></div>`);
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
