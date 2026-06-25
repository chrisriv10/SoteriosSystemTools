window.Pages = window.Pages || {};

window.Pages.scanner = {
  selectedPath: null,
  lastResults: null,
  settings: null,

  async render(container) {
    this.settings = await Api.getSettings();
    this.selectedPath = this.selectedPath || this.settings.scanner.defaultPath || null;

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">File Scanner</h1>
        <div class="page-subtitle">Local signatures, explainable heuristics, exclusions, quarantine, and scan history</div>
      </div>

      <div class="panel" style="margin-bottom:18px;">
        <div class="panel-title">Target Folder</div>
        <div class="path-picker">
          <input type="text" id="scanPath" placeholder="No folder selected" readonly value="${escapeHtml(this.selectedPath || '')}" />
          <button class="btn" id="browseBtn">Browse</button>
          <button class="btn btn-primary" id="scanBtn" ${this.selectedPath ? '' : 'disabled'}>${iconButtonSvg('search')} Run Scan</button>
        </div>
        <div class="scanner-options">
          <label class="checkbox-row"><input type="checkbox" id="includeClean" ${this.settings.scanner.includeCleanResults ? 'checked' : ''} /> Include clean files in results</label>
          <label class="inline-field">Depth <input type="number" id="maxDepth" min="1" max="32" value="${escapeHtml(this.settings.scanner.maxDepth)}" /></label>
          <label class="inline-field">Max MB <input type="number" id="maxFileSizeMB" min="1" max="4096" value="${escapeHtml(this.settings.scanner.maxFileSizeMB)}" /></label>
        </div>
        <div id="scanProgress" class="muted-line"></div>
      </div>

      <div class="grid grid-4" id="scanSummaryTiles" style="display:none; margin-bottom:18px;"></div>

      <div class="panel" style="margin-bottom:18px;">
        <div class="flex-between" style="margin-bottom:14px;">
          <div class="panel-title" style="margin-bottom:0;">Results</div>
          <div id="quarantineHint" class="muted-line"></div>
        </div>
        <div class="log-surface" id="scanResults">
          <div class="empty-state">Select a folder and run a scan to see prioritized results here.</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Recent Scan History</div>
        <div id="scanHistory" class="history-list"><div class="empty-state">Loading history...</div></div>
      </div>
    `;

    container.querySelector('#browseBtn').addEventListener('click', () => this.browse(container));
    container.querySelector('#scanBtn').addEventListener('click', () => this.runScan(container));

    if (this.lastResults) this.renderResults(container, this.lastResults);
    this.renderHistory(container);
  },

  async browse(container) {
    const path = await Api.pickFolder();
    if (!path) return;
    this.selectedPath = path;
    container.querySelector('#scanPath').value = path;
    container.querySelector('#scanBtn').disabled = false;
  },

  readOptions(container) {
    return {
      includeCleanResults: container.querySelector('#includeClean').checked,
      maxDepth: Number(container.querySelector('#maxDepth').value || 12),
      maxFileSizeMB: Number(container.querySelector('#maxFileSizeMB').value || 512)
    };
  },

  async runScan(container) {
    const scanBtn = container.querySelector('#scanBtn');
    const progressEl = container.querySelector('#scanProgress');
    const resultsEl = container.querySelector('#scanResults');
    const options = this.readOptions(container);

    setButtonLoading(scanBtn, true, 'Scanning...');
    resultsEl.innerHTML = '<div class="empty-state">Scanning...</div>';

    const unsubscribe = Api.onToolProgress('file-scanner', (payload) => {
      progressEl.textContent = `Scanned ${payload.scanned}/${payload.total} - ${payload.flagged} flagged - ${payload.currentFile}`;
    });

    try {
      const data = await Api.runTool('file-scanner', { path: this.selectedPath, ...options });
      this.lastResults = data;
      window.AppState.lastScanSummary = data.summary;
      await Api.updateSettings({ scanner: { ...options, defaultPath: this.selectedPath } });
      progressEl.textContent = `Scan complete. ${data.summary.flagged} item(s) flagged.`;
      this.renderResults(container, data);
      this.renderHistory(container);
    } catch (err) {
      showToolError(resultsEl, err);
    } finally {
      unsubscribe();
      setButtonLoading(scanBtn, false);
    }
  },

  renderResults(container, data) {
    const { summary, results } = data;
    const tiles = container.querySelector('#scanSummaryTiles');
    tiles.style.display = 'grid';
    tiles.innerHTML = `
      <div class="stat-tile"><div class="stat-label">Scanned</div><div class="stat-value">${summary.totalScanned}</div></div>
      <div class="stat-tile"><div class="stat-label">Flagged</div><div class="stat-value ${summary.flagged ? 'warn' : 'ok'}">${summary.flagged}</div></div>
      <div class="stat-tile"><div class="stat-label">Matches</div><div class="stat-value danger">${summary.matches}</div></div>
      <div class="stat-tile"><div class="stat-label">Skipped</div><div class="stat-value">${summary.skipped}</div></div>
    `;

    const resultsEl = container.querySelector('#scanResults');
    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="empty-state">No flagged files found with the current scan options.</div>';
      return;
    }

    const priority = { match: 0, suspicious: 1, error: 2, skipped: 3, clean: 4 };
    const rows = [...results]
      .sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9) || ((b.risk && b.risk.score) || 0) - ((a.risk && a.risk.score) || 0))
      .slice(0, 500)
      .map((result) => this.renderRow(result))
      .join('');

    resultsEl.innerHTML = rows;
    resultsEl.querySelectorAll('[data-quarantine-path]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const path = btn.dataset.quarantinePath;
        const hash = btn.dataset.hash || null;
        const risk = btn.dataset.risk ? JSON.parse(btn.dataset.risk) : null;
        btn.disabled = true;
        btn.textContent = 'Quarantining...';
        try {
          await Api.runTool('quarantine-file', { path, hash, risk, reason: btn.dataset.reason || 'Flagged by scanner' });
          btn.textContent = 'Quarantined';
        } catch (err) {
          btn.textContent = 'Failed';
        }
      });
    });
  },

  renderRow(result) {
    const tagClass = result.status;
    const tagLabel = result.status.toUpperCase();
    const risk = result.risk || { score: 0, level: 'none' };
    const flagText = (result.flags || []).map((flag) => `${flag.severity}: ${flag.message}`).join('; ');
    const detail = result.status === 'match'
      ? `Matched signature "${escapeHtml(result.signatureName)}"`
      : result.status === 'suspicious'
        ? escapeHtml(result.explanation || flagText)
        : escapeHtml(result.error || result.reason || '');
    const reason = result.status === 'match' ? `Signature match: ${result.signatureName}` : flagText;
    const signature = result.signature ? `Signature: ${result.signature.status}${result.signature.publisher ? ` / ${result.signature.publisher}` : ''}` : '';
    const recommendation = result.recommendedAction || (risk.score ? 'Review this file before trusting it.' : 'No action needed.');

    const quarantineBtn = (result.status === 'match' || result.status === 'suspicious')
      ? `<button class="btn btn-sm btn-danger" data-quarantine-path="${escapeHtml(result.path)}" data-hash="${escapeHtml(result.hash || '')}" data-risk="${escapeHtml(JSON.stringify(risk))}" data-reason="${escapeHtml(reason)}">Quarantine</button>`
      : '';

    return `
      <div class="log-row result-row">
        <span class="log-tag ${tagClass}">${tagLabel}</span>
        <span class="risk-pill risk-${escapeHtml(risk.level)}">${risk.score}</span>
        <span class="log-path">
          ${escapeHtml(result.path)}
          ${detail ? `<span class="row-detail"> - ${detail}</span>` : ''}
          ${result.sizeBytes !== undefined ? `<span class="row-meta">${formatBytes(result.sizeBytes)}</span>` : ''}
          ${result.hash ? `<span class="row-meta">SHA256 ${escapeHtml(result.hash.slice(0, 16))}...</span>` : ''}
          ${signature ? `<span class="row-meta">${escapeHtml(signature)}</span>` : ''}
          <span class="row-meta">${escapeHtml(recommendation)}</span>
        </span>
        ${quarantineBtn}
      </div>
    `;
  },

  async renderHistory(container) {
    const el = container.querySelector('#scanHistory');
    try {
      const scans = await Api.getHistory('scans', 6);
      if (!scans.length) {
        el.innerHTML = '<div class="empty-state">No scans recorded yet.</div>';
        return;
      }
      el.innerHTML = scans.map((scan) => {
        const summary = scan.summary || {};
        return `
          <div class="history-item">
            <div>
              <div class="history-title">${escapeHtml(summary.targetPath || 'Scan')}</div>
              <div class="history-meta">${escapeHtml(new Date(summary.completedAt || scan.createdAt).toLocaleString())}</div>
            </div>
            <div class="history-counts">
              <span class="ok">${summary.clean || 0} clean</span>
              <span class="warn">${summary.suspicious || 0} suspicious</span>
              <span class="danger">${summary.matches || 0} matches</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      showToolError(el, err);
    }
  }
};

function iconButtonSvg(name) {
  return `<span style="width:14px;height:14px;display:inline-flex;">${iconFor(name)}</span>`;
}
