const Api = {
  async listTools() { return window.soterios.tools.list(); },
  async runTool(toolId, args) {
    const result = await window.soterios.tools.run(toolId, args);
    if (!result.ok) throw new Error(result.error || `Tool "${toolId}" failed`);
    return result.data;
  },
  onToolProgress(toolId, callback) { return window.soterios.tools.onProgress(toolId, callback); },
  async pickFolder() { return window.soterios.dialog.pickFolder(); },
  async pickFiles() { return window.soterios.dialog.pickFiles(); },
  async showItemInFolder(filePath) { return window.soterios.shell.showItemInFolder(filePath); },
  async getStoreSnapshot() { return {}; },
  async getSettings() {
    const defaultPath = await window.api.invoke('db:getSetting', 'scanner.defaultPath', '');
    const maxDepth = await window.api.invoke('db:getSetting', 'scanner.maxDepth', 12);
    const maxFileSizeMB = await window.api.invoke('db:getSetting', 'scanner.maxFileSizeMB', 512);
    const includeCleanResults = await window.api.invoke('db:getSetting', 'scanner.includeCleanResults', false);
    const excludedDirNames = await window.api.invoke('db:getSetting', 'scanner.excludedDirNames', []);
    const realtimeProtection = await window.api.invoke('db:getSetting', 'feature.realtimeProtection', true);
    const autoReports = await window.api.invoke('db:getSetting', 'feature.autoReports', true);
    const scanHistory = await window.api.invoke('db:getSetting', 'feature.scanHistory', true);
    const systemMonitoring = await window.api.invoke('db:getSetting', 'feature.systemMonitoring', true);
    return {
      scanner: { defaultPath, maxDepth, maxFileSizeMB, includeCleanResults, excludedDirNames },
      features: { realtimeProtection, autoReports, scanHistory, systemMonitoring }
    };
  },
  async updateSettings(patch) {
    if (patch.scanner) {
      const s = patch.scanner;
      await window.api.invoke('db:setSetting', 'scanner.defaultPath', s.defaultPath || '');
      await window.api.invoke('db:setSetting', 'scanner.maxDepth', s.maxDepth || 12);
      await window.api.invoke('db:setSetting', 'scanner.maxFileSizeMB', s.maxFileSizeMB || 512);
      await window.api.invoke('db:setSetting', 'scanner.includeCleanResults', !!s.includeCleanResults);
      await window.api.invoke('db:setSetting', 'scanner.excludedDirNames', s.excludedDirNames || []);
    }
    if (patch.features) {
      const f = patch.features;
      if (Object.prototype.hasOwnProperty.call(f, 'realtimeProtection')) {
        await window.api.invoke('db:setSetting', 'feature.realtimeProtection', !!f.realtimeProtection);
        await window.api.invoke('rtp:toggle', !!f.realtimeProtection);
      }
      if (Object.prototype.hasOwnProperty.call(f, 'autoReports')) await window.api.invoke('db:setSetting', 'feature.autoReports', !!f.autoReports);
      if (Object.prototype.hasOwnProperty.call(f, 'scanHistory')) await window.api.invoke('db:setSetting', 'feature.scanHistory', !!f.scanHistory);
      if (Object.prototype.hasOwnProperty.call(f, 'systemMonitoring')) await window.api.invoke('db:setSetting', 'feature.systemMonitoring', !!f.systemMonitoring);
    }
  },
  async getHistory(kind, limit) { try { return await window.api.invoke('db:getScanHistory', limit || 10); } catch (e) { return []; } },
  async getQuarantine() { try { return await window.api.invoke('db:getQuarantineList'); } catch (e) { return []; } },
  async getAppInfo() { return window.soterios.app.info(); }
};
