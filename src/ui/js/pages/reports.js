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
          <button class="btn btn-primary" id="generateReport">${iconButtonSvg('list-checks')} Generate Security Report</button>
        </div>
      </div>

      <div class="panel" style="margin-bottom:18px;">
        <div class="panel-title">Latest Export</div>
        <div id="reportResult" class="empty-state">No report generated in this session.</div>
      </div>

      <div class="panel">
        <div class="panel-title">Report History</div>
        <div id="reportHistory" class="history-list"><div class="empty-state">Loading report history...</div></div>
      </div>
    `;

    container.querySelector('#generateReport').addEventListener('click', () => this.generate(container));
    this.history(container);
  },

  async generate(container) {
    const btn = container.querySelector('#generateReport');
    const result = container.querySelector('#reportResult');
    setButtonLoading(btn, true, 'Generating...');
    result.innerHTML = '<div class="empty-state">Collecting security checks and writing report...</div>';
    try {
      const appInfo = await Api.getAppInfo();
      const data = await Api.runTool('generate-security-report', { version: appInfo.version });
      result.classList.remove('empty-state');
      result.innerHTML = `
        <div class="history-title">Security report generated</div>
        <div class="history-meta">Score: <span class="${data.report.overview.level}">${data.report.overview.score}</span></div>
        <div class="history-meta mono">HTML: ${escapeHtml(data.files.html)}</div>
        <div class="history-meta mono">JSON: ${escapeHtml(data.files.json)}</div>
        <div class="history-meta">PDF export is not bundled yet; HTML is printer-friendly.</div>
      `;
      this.history(container);
    } catch (err) {
      showToolError(result, err);
    } finally {
      setButtonLoading(btn, false);
    }
  },

  async history(container) {
    const el = container.querySelector('#reportHistory');
    try {
      const reports = await Api.getHistory('reports', 10);
      if (!reports.length) {
        el.innerHTML = '<div class="empty-state">No reports generated yet.</div>';
        return;
      }
      el.innerHTML = reports.map((report) => `
        <div class="history-item">
          <div>
            <div class="history-title">${escapeHtml(report.title || 'Security report')}</div>
            <div class="history-meta mono">${escapeHtml(report.htmlPath || '')}</div>
            <div class="history-meta">${escapeHtml(new Date(report.createdAt).toLocaleString())}</div>
          </div>
          <div class="stat-value ${report.score >= 80 ? 'ok' : report.score >= 60 ? 'warn' : 'danger'}">${escapeHtml(report.score)}</div>
        </div>
      `).join('');
    } catch (err) {
      showToolError(el, err);
    }
  }
};
