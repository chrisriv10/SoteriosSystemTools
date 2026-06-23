window.Pages = window.Pages || {};

window.Pages.settings = {
  async render(container) {
    const settings = await Api.getSettings();
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
        <div class="page-subtitle">Local app preferences, scanner defaults, and privacy posture</div>
      </div>

      <div class="grid grid-2">
        <div class="panel">
          <div class="panel-title">Scanner Defaults</div>
          <div class="field">
            <label class="field-label">Default path</label>
            <input type="text" id="defaultPath" value="${escapeHtml(settings.scanner.defaultPath || '')}" />
          </div>
          <div class="grid grid-2">
            <div class="field">
              <label class="field-label">Max depth</label>
              <input type="number" id="maxDepthSetting" min="1" max="32" value="${escapeHtml(settings.scanner.maxDepth)}" />
            </div>
            <div class="field">
              <label class="field-label">Max file size MB</label>
              <input type="number" id="maxFileSizeSetting" min="1" max="4096" value="${escapeHtml(settings.scanner.maxFileSizeMB)}" />
            </div>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" id="includeCleanSetting" ${settings.scanner.includeCleanResults ? 'checked' : ''} />
            Include clean files in scanner results by default
          </label>
          <div class="field">
            <label class="field-label">Excluded directory names or path fragments</label>
            <input type="text" id="excludedDirs" value="${escapeHtml((settings.scanner.excludedDirNames || []).join(', '))}" />
          </div>
          <button class="btn btn-primary" id="saveSettings">Save Settings</button>
          <div id="settingsStatus" class="muted-line" style="margin-top:10px;"></div>
        </div>

        <div class="panel">
          <div class="panel-title">About</div>
          <div style="font-size:12.5px; color: var(--text-muted); line-height:1.8;">
            <div><strong style="color:var(--text);">Soterios System Tools</strong> v0.1.0</div>
            <div>Local-first system maintenance and basic security checks.</div>
            <div style="margin-top:10px;">No cloud calls are made by the app. Scan history, quarantine records, and settings are stored in Electron app data on this device.</div>
            <div style="margin-top:10px;">Signature database: <span class="mono" style="color:var(--text);">src/av/signatureDB.json</span></div>
            <div>Quarantine folder: <span class="mono" style="color:var(--text);">~/.soterios-quarantine</span></div>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#saveSettings').addEventListener('click', () => this.save(container));
  },

  async save(container) {
    const btn = container.querySelector('#saveSettings');
    const status = container.querySelector('#settingsStatus');
    setButtonLoading(btn, true, 'Saving...');
    try {
      const excludedDirNames = container.querySelector('#excludedDirs').value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      await Api.updateSettings({
        scanner: {
          defaultPath: container.querySelector('#defaultPath').value.trim(),
          maxDepth: Number(container.querySelector('#maxDepthSetting').value || 12),
          maxFileSizeMB: Number(container.querySelector('#maxFileSizeSetting').value || 512),
          includeCleanResults: container.querySelector('#includeCleanSetting').checked,
          excludedDirNames
        }
      });
      status.textContent = 'Settings saved.';
    } catch (err) {
      status.textContent = err.message || String(err);
    } finally {
      setButtonLoading(btn, false);
    }
  }
};
