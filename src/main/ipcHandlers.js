const { ipcMain, dialog, shell, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

function requestText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Soterios-System-Tools',
        ...options.headers
      }
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Request timed out')));
    req.end();
  });
}

function deleteFileIfSafe(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

function registerIpcHandlers(mainWindow, services) {
  const { db, eventBus, clamEngine, scanEngine, quarantineManager, realtimeWatcher, processInspector } = services;

  // -- System --
  ipcMain.handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    userData: app.getPath('userData'),
    isAdmin: true // We requested admin rights
  }));

  // -- Database / Settings --
  ipcMain.handle('db:getScanHistory', (_event, limit) => db.getScanHistory(limit));
  ipcMain.handle('db:getQuarantineList', () => db.getQuarantineList());
  ipcMain.handle('db:getUnreadAlerts', () => db.getUnreadAlerts());
  ipcMain.handle('db:markAlertRead', (_event, id) => db.markAlertRead(id));
  ipcMain.handle('db:getSetting', (_event, key, def) => db.getSetting(key, def));
  ipcMain.handle('db:setSetting', (_event, key, value) => db.setSetting(key, value));
  ipcMain.handle('warnings:ignore', (_event, warning) => db.ignoreWarning(warning));
  ipcMain.handle('warnings:unignore', (_event, id) => db.unignoreWarning(id));
  ipcMain.handle('warnings:listIgnored', () => db.getIgnoredWarnings());

  // -- Scanning Engine --
  ipcMain.handle('scan:status', () => {
    return {
      engine: clamEngine.getStatus(),
      scan: scanEngine.getStatus()
    };
  });

  ipcMain.handle('scan:updateDefinitions', async () => {
    return clamEngine.updateDefinitions((progress) => {
      eventBus.emit('scan:progress', { pct: 10, message: 'Updating ClamAV definitions...' });
      if (progress && progress.text) {
        const match = progress.text.match(/(\d+)%/);
        if (match) {
          eventBus.emit('scan:progress', { pct: Math.min(95, Number(match[1])), message: 'Updating ClamAV definitions...' });
        }
      }
    });
  });

  ipcMain.handle('scan:quick', async () => {
    return scanEngine.runQuickScan();
  });
  
  ipcMain.handle('scan:full', async () => {
    return scanEngine.runFullScan();
  });
  
  ipcMain.handle('scan:custom', async (_event, targetPaths) => {
    return scanEngine.runCustomScan(targetPaths);
  });
  
  ipcMain.handle('scan:abort', () => {
    return scanEngine.abortScan();
  });

  // -- Quarantine --
  ipcMain.handle('quarantine:restore', async (_event, id) => {
    return quarantineManager.restore(id);
  });
  
  ipcMain.handle('quarantine:delete', async (_event, id) => {
    return quarantineManager.delete(id);
  });

  // -- Real-Time Protection --
  ipcMain.handle('rtp:status', () => realtimeWatcher.getStatus());
  ipcMain.handle('rtp:toggle', (_event, enable) => {
    if (enable) realtimeWatcher.start();
    else realtimeWatcher.stop();
    return realtimeWatcher.getStatus();
  });

  // -- Process Inspector --
  ipcMain.handle('process:list', async () => {
    return processInspector.getProcesses();
  });

  // -- Audit & Firewall & Network --
  ipcMain.handle('audit:run', async () => {
    return services.systemAudit.runAudit();
  });
  
  ipcMain.handle('firewall:status', async () => {
    return services.firewallManager.getStatus();
  });

  ipcMain.handle('firewall:rules', async () => {
    return services.firewallManager.getRules();
  });

  ipcMain.handle('network:connections', async () => {
    return services.networkMonitor.getConnections();
  });

  ipcMain.handle('network:stats', async () => {
    return services.networkMonitor.getStats();
  });

  // -- Reports --
  const os = require('os');
  ipcMain.handle('reports:list', async () => {
    const dir = path.join(os.homedir(), '.soterios', 'reports');
    try {
      const fs = require('fs');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') || f.endsWith('.json'));
      return files.sort().reverse().slice(0, 50).map(f => ({
        name: f, path: path.join(dir, f),
        mtime: fs.statSync(path.join(dir, f)).mtime.toISOString()
      }));
    } catch { return []; }
  });

  ipcMain.handle('scanReports:list', async (_event, limit) => {
    return db.getScanReports(limit || 25);
  });

  ipcMain.handle('scanReports:latest', async () => {
    return db.getLatestScanReport();
  });

  ipcMain.handle('scanReports:delete', async (_event, id) => {
    const row = db.deleteScanReport(id);
    if (!row) return { success: false, error: 'Report not found.' };
    deleteFileIfSafe(row.html_path);
    deleteFileIfSafe(row.json_path);
    return { success: true };
  });

  ipcMain.handle('reports:delete', async (_event, filePath) => {
    const reportsDir = path.join(os.homedir(), '.soterios', 'reports');
    const resolved = path.resolve(filePath || '');
    if (!resolved.startsWith(path.resolve(reportsDir))) return { success: false, error: 'Invalid report path.' };
    deleteFileIfSafe(resolved);
    return { success: true };
  });

  ipcMain.handle('hibp:password', async (_event, password) => {
    if (!password) return { found: false, count: 0 };
    const sha = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha.slice(0, 5);
    const suffix = sha.slice(5);
    const res = await requestText(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' }
    });
    if (res.statusCode !== 200) throw new Error(`HIBP password check failed (${res.statusCode}).`);
    const line = res.body.split(/\r?\n/).find(row => row.split(':')[0] === suffix);
    const count = line ? Number(line.split(':')[1] || 0) : 0;
    return { found: count > 0, count };
  });

  ipcMain.handle('hibp:email', async (_event, email, apiKey) => {
    if (!email) return { found: false, breaches: [] };
    if (!apiKey) return { requiresApiKey: true, found: false, breaches: [] };
    const encoded = encodeURIComponent(email);
    const res = await requestText(`https://haveibeenpwned.com/api/v3/breachedaccount/${encoded}?truncateResponse=true`, {
      headers: { 'hibp-api-key': apiKey }
    });
    if (res.statusCode === 404) return { found: false, breaches: [] };
    if (res.statusCode === 401 || res.statusCode === 403) throw new Error('HIBP email check requires a valid API key.');
    if (res.statusCode === 429) throw new Error('HIBP rate limit reached. Try again in a moment.');
    if (res.statusCode !== 200) throw new Error(`HIBP email check failed (${res.statusCode}).`);
    const breaches = JSON.parse(res.body || '[]');
    return { found: breaches.length > 0, breaches };
  });

  ipcMain.handle('health:score', async () => {
    const latest = db.getLatestScanReport();
    const result = await services.toolRegistry.run('health-score', {
      lastScanMatches: latest ? latest.threats_found : null
    }, { db });
    if (!result.ok) throw new Error(result.error || 'Unable to calculate health score');
    return result.data;
  });

  // -- Dialogs & Shell --
  ipcMain.handle('dialog:pickFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:pickFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow || BrowserWindow.getFocusedWindow(), {
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  ipcMain.handle('shell:showItemInFolder', (_event, filePath) => {
    shell.showItemInFolder(filePath);
  });
}

module.exports = { registerIpcHandlers };
