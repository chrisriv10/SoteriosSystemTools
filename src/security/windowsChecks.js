const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.dll', '.sys', '.scr', '.com', '.msi']);

function runPowerShell(script, timeout = 20000) {
  if (process.platform !== 'win32') {
    return Promise.resolve({ ok: false, error: 'Windows checks are only available on Windows.' });
  }

  return new Promise((resolve) => {
    try {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { windowsHide: true, timeout, maxBuffer: 1024 * 1024 * 8 },
        (error, stdout, stderr) => {
          if (error) {
            resolve({ ok: false, error: stderr || error.message });
            return;
          }
          resolve({ ok: true, stdout });
        }
      );
    } catch (err) {
      resolve({ ok: false, error: err.message || String(err) });
    }
  });
}

async function runJsonPowerShell(script, fallback = null, timeout) {
  const wrapped = `${script} | ConvertTo-Json -Depth 6`;
  const result = await runPowerShell(wrapped, timeout);
  if (!result.ok) return { ok: false, error: result.error, data: fallback };
  try {
    const trimmed = result.stdout.trim();
    if (!trimmed) return { ok: true, data: fallback };
    return { ok: true, data: JSON.parse(trimmed) };
  } catch (err) {
    return { ok: false, error: err.message, data: fallback };
  }
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function getDefenderStatus() {
  const result = await runJsonPowerShell(`
    $status = Get-MpComputerStatus -ErrorAction Stop
    [PSCustomObject]@{
      available = $true
      antivirusEnabled = [bool]$status.AntivirusEnabled
      realTimeProtectionEnabled = [bool]$status.RealTimeProtectionEnabled
      antispywareEnabled = [bool]$status.AntispywareEnabled
      quickScanAge = $status.QuickScanAge
      fullScanAge = $status.FullScanAge
      signaturesAge = $status.AntivirusSignatureAge
      engineVersion = $status.AMEngineVersion
      signatureVersion = $status.AntivirusSignatureVersion
    }
  `, { available: false });

  return result.data || { available: false, error: result.error };
}

async function getFirewallStatus() {
  const result = await runJsonPowerShell(`
    Get-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction
  `, []);
  return asArray(result.data).map((profile) => ({
    name: profile.Name,
    enabled: !!profile.Enabled,
    defaultInboundAction: profile.DefaultInboundAction,
    defaultOutboundAction: profile.DefaultOutboundAction
  }));
}

async function getUpdateStatus() {
  const result = await runJsonPowerShell(`
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $pending = $searcher.Search("IsInstalled=0 and IsHidden=0")
    $historyCount = $searcher.GetTotalHistoryCount()
    $last = $null
    if ($historyCount -gt 0) { $last = $searcher.QueryHistory(0, 1)[0] }
    [PSCustomObject]@{
      pendingCount = $pending.Updates.Count
      lastUpdateDate = if ($last) { $last.Date } else { $null }
      lastUpdateTitle = if ($last) { $last.Title } else { $null }
    }
  `, { pendingCount: null });
  return result.data || { pendingCount: null, error: result.error };
}

async function getSignatureInfo(filePath) {
  if (!filePath || !fs.existsSync(filePath) || process.platform !== 'win32') {
    return { status: 'Unknown', publisher: null };
  }

  const escaped = filePath.replace(/'/g, "''");
  const result = await runJsonPowerShell(`
    $sig = Get-AuthenticodeSignature -LiteralPath '${escaped}' -ErrorAction SilentlyContinue
    [PSCustomObject]@{
      status = if ($sig) { [string]$sig.Status } else { 'Unknown' }
      publisher = if ($sig -and $sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }
    }
  `, { status: 'Unknown', publisher: null }, 10000);
  return result.data || { status: 'Unknown', publisher: null };
}

function isExecutablePath(filePath) {
  return EXECUTABLE_EXTENSIONS.has(path.extname(filePath || '').toLowerCase());
}

function suspiciousPathSignals(filePath) {
  const signals = [];
  const normalized = String(filePath || '').toLowerCase();

  if (!normalized) {
    signals.push({ points: 12, message: 'Executable path is unavailable.' });
    return signals;
  }
  if (normalized.includes('\\appdata\\roaming\\') || normalized.includes('\\appdata\\local\\temp\\')) {
    signals.push({ points: 25, message: 'Runs from a user AppData or temporary location.' });
  }
  if (normalized.includes('\\windows\\temp\\') || normalized.includes('\\users\\public\\')) {
    signals.push({ points: 20, message: 'Runs from a commonly abused writable Windows location.' });
  }
  if (/\.(jpg|png|pdf|docx?|xlsx?)\.(exe|scr|js|vbs|bat|cmd|ps1)$/i.test(normalized)) {
    signals.push({ points: 45, message: 'Uses a double extension commonly used to disguise malware.' });
  }
  return signals;
}

async function getStartupFolders() {
  const folders = [
    path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup'),
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs\\Startup')
  ];
  const items = [];

  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    for (const name of fs.readdirSync(folder)) {
      const filePath = path.join(folder, name);
      items.push({
        source: 'Startup Folder',
        name,
        command: filePath,
        location: folder,
        path: filePath
      });
    }
  }
  return items;
}

async function getRegistryRunItems() {
  const result = await runJsonPowerShell(`
    $keys = @(
      'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
      'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
      'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
    )
    foreach ($key in $keys) {
      if (Test-Path $key) {
        $props = Get-ItemProperty -Path $key
        foreach ($p in $props.PSObject.Properties) {
          if ($p.Name -notmatch '^PS') {
            [PSCustomObject]@{ source='Registry Run'; name=$p.Name; command=[string]$p.Value; location=$key; path=$null }
          }
        }
      }
    }
  `, []);
  return asArray(result.data);
}

async function getScheduledTasks() {
  const result = await runJsonPowerShell(`
    Get-ScheduledTask |
      Where-Object { $_.State -ne 'Disabled' } |
      ForEach-Object {
        $action = $_.Actions | Select-Object -First 1
        [PSCustomObject]@{
          source='Scheduled Task'
          name=$_.TaskName
          command=($action.Execute + ' ' + $action.Arguments).Trim()
          location=$_.TaskPath
          path=$action.Execute
          state=[string]$_.State
        }
      }
  `, [], 30000);
  return asArray(result.data);
}

async function getServices() {
  const result = await runJsonPowerShell(`
    Get-CimInstance Win32_Service |
      Where-Object { $_.StartMode -eq 'Auto' -or $_.State -eq 'Running' } |
      Select-Object Name, DisplayName, PathName, StartMode, State
  `, [], 30000);
  return asArray(result.data).map((svc) => ({
    source: 'Windows Service',
    name: svc.DisplayName || svc.Name,
    serviceName: svc.Name,
    command: svc.PathName,
    location: svc.StartMode,
    path: extractExecutablePath(svc.PathName),
    state: svc.State
  }));
}

function extractExecutablePath(command) {
  if (!command) return null;
  const trimmed = String(command).trim();
  const quoted = trimmed.match(/^"([^"]+)"/);
  if (quoted) return quoted[1];
  const exe = trimmed.match(/^(.+?\.exe)\b/i);
  return exe ? exe[1] : trimmed.split(/\s+/)[0];
}

module.exports = {
  asArray,
  runPowerShell,
  runJsonPowerShell,
  getDefenderStatus,
  getFirewallStatus,
  getUpdateStatus,
  getSignatureInfo,
  getRegistryRunItems,
  getStartupFolders,
  getScheduledTasks,
  getServices,
  extractExecutablePath,
  isExecutablePath,
  suspiciousPathSignals
};
