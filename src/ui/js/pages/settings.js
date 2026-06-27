window.Pages = window.Pages || {};
window.Pages.settings = {
  async render(container) {
    const settings = await Api.getSettings();
    const appInfo = await Api.getAppInfo();
    container.innerHTML = `
      <div class="page-header"><h1 class="page-title">Settings</h1>
        <div class="page-subtitle">Local app preferences and feature toggles</div></div>
      <div class="dashboard-grid">
        <div class="card">
          <div class="panel-title" style="margin-bottom:16px;">Feature Toggles</div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Real-Time Protection</div>
              <div class="toggle-desc">Monitor file system changes and alert on suspicious activity</div>
            </div>
            <label class="toggle" id="rtpToggleWrap"><input type="checkbox" id="rtpToggle" ${settings.features.realtimeProtection ? 'checked' : ''} /><span class="toggle-slider"></span></label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Auto-Generate Reports</div>
              <div class="toggle-desc">Automatically create a security report after each scan completes</div>
            </div>
            <label class="toggle"><input type="checkbox" id="autoReportToggle" ${settings.features.autoReports ? 'checked' : ''} /><span class="toggle-slider"></span></label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Scan History</div>
              <div class="toggle-desc">Keep a record of all past scan results</div>
            </div>
            <label class="toggle"><input type="checkbox" id="scanHistoryToggle" ${settings.features.scanHistory ? 'checked' : ''} /><span class="toggle-slider"></span></label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">System Monitoring</div>
              <div class="toggle-desc">Continuously collect CPU, memory, and disk metrics</div>
            </div>
            <label class="toggle"><input type="checkbox" id="sysmonToggle" ${settings.features.systemMonitoring ? 'checked' : ''} /><span class="toggle-slider"></span></label>
          </div>
        </div>

        <div class="card">
          <div class="panel-title" style="margin-bottom:16px;">Scanner Defaults</div>

          <div class="field"><label class="field-label">Default scan path</label><input type="text" id="defaultPath" value="${escapeHtml(settings.scanner.defaultPath || '')}" placeholder="e.g. C:\\Users\\..." /></div>
          <div class="grid grid-2">
            <div class="field"><label class="field-label">Max directory depth</label><input type="number" id="maxDepthSetting" min="1" max="32" value="${escapeHtml(settings.scanner.maxDepth)}" /></div>
            <div class="field"><label class="field-label">Max file size (MB)</label><input type="number" id="maxFileSizeSetting" min="1" max="4096" value="${escapeHtml(settings.scanner.maxFileSizeMB)}" /></div>
          </div>
          <label class="checkbox-row"><input type="checkbox" id="includeCleanSetting" ${settings.scanner.includeCleanResults ? 'checked' : ''} />Include clean files in results</label>
          <div class="field"><label class="field-label">Excluded directories (comma-separated)</label><input type="text" id="excludedDirs" value="${escapeHtml((settings.scanner.excludedDirNames || []).join(', '))}" /></div>
          <button class="btn btn-primary" id="saveSettings" style="margin-top:12px;">Save Scanner Settings</button>
          <div id="settingsStatus" style="margin-top:8px; font-size:0.85rem; color:var(--text-muted);"></div>
        </div>

        <div class="card">
          <div class="panel-title" style="margin-bottom:16px;">About</div>
          <div style="font-size:0.9rem; line-height:1.8;">
            <div><strong>Soterios</strong> v${escapeHtml(appInfo.version || '1.0.2')}</div>
            <div style="color:var(--text-muted); margin-top:8px;">Local-first Windows security and maintenance platform.</div>
            <div style="margin-top:12px; font-size:0.8rem;">
              <div>ClamAV engine at <code style="color:var(--accent-primary);">assets/clamav/</code></div>
              <div>Quarantine path: <code style="color:var(--accent-primary);">~/.soterios-quarantine</code></div>
            </div>
          </div>
        </div>
      </div>`;

    container.querySelector('#saveSettings').addEventListener('click', async () => {
      const btn = container.querySelector('#saveSettings');
      const status = container.querySelector('#settingsStatus');
      setButtonLoading(btn, true, 'Saving\u2026');
      try {
        await Api.updateSettings({
          scanner: {
            defaultPath: container.querySelector('#defaultPath').value.trim(),
            maxDepth: Number(container.querySelector('#maxDepthSetting').value || 12),
            maxFileSizeMB: Number(container.querySelector('#maxFileSizeSetting').value || 512),
            includeCleanResults: container.querySelector('#includeCleanSetting').checked,
            excludedDirNames: container.querySelector('#excludedDirs').value.split(',').map(i => i.trim()).filter(Boolean)
          }
        });
        status.textContent = 'Settings saved.';
      } catch (err) { status.textContent = err.message || String(err); }
      finally { setButtonLoading(btn, false); }
    });

    async function saveFeature(key, value) {
      const status = container.querySelector('#settingsStatus');
      try {
        await Api.updateSettings({ features: { [key]: value } });
        status.textContent = 'Feature toggle saved.';
      } catch (err) {
        status.textContent = err.message || String(err);
      }
    }

    container.querySelector('#rtpToggle').addEventListener('change', (event) => saveFeature('realtimeProtection', event.target.checked));
    container.querySelector('#autoReportToggle').addEventListener('change', (event) => saveFeature('autoReports', event.target.checked));
    container.querySelector('#scanHistoryToggle').addEventListener('change', (event) => saveFeature('scanHistory', event.target.checked));
    container.querySelector('#sysmonToggle').addEventListener('change', (event) => saveFeature('systemMonitoring', event.target.checked));
  }
};
