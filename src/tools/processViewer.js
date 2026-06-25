const {
  runJsonPowerShell,
  asArray,
  getSignatureInfo,
  suspiciousPathSignals
} = require('../security/windowsChecks');
const { makeRisk, recommendationForRisk } = require('../security/riskEngine');

async function getProcessPaths() {
  const result = await runJsonPowerShell(`
    Get-CimInstance Win32_Process |
      Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine
  `, [], 30000);

  const map = new Map();
  for (const proc of asArray(result.data)) {
    map.set(Number(proc.ProcessId), {
      parentPid: proc.ParentProcessId,
      path: proc.ExecutablePath,
      commandLine: proc.CommandLine,
      name: proc.Name
    });
  }
  return map;
}

function processSignals(proc, signature) {
  const signals = suspiciousPathSignals(proc.path);
  const cmd = String(proc.commandLine || proc.cmd || '').toLowerCase();

  if (cmd.includes('-encodedcommand') || cmd.includes('frombase64string')) {
    signals.push({ points: 45, message: 'Command line contains encoded script execution.' });
  }
  if ((proc.name || '').toLowerCase() === 'powershell.exe' && cmd.includes('downloadstring')) {
    signals.push({ points: 35, message: 'PowerShell command line contains download execution indicators.' });
  }
  if (proc.path && signature.status !== 'Valid' && /\.(exe|scr|com)$/i.test(proc.path)) {
    signals.push({ points: 20, message: 'Process executable is unsigned or signature could not be verified.' });
  }
  return signals;
}

module.exports = {
  id: 'process-viewer',
  name: 'Process Viewer',
  description: 'Inspect running processes with tree metadata, signatures, paths, and suspicious process scoring.',
  category: 'Security',
  icon: 'list',
  version: '1.1.0',
  permissions: ['process-list', 'file-signature-read'],
  run: async () => {
    // ps-list is an ESM module; dynamic import works from CJS in Node 18+
    const { default: psList } = await import('ps-list');
    const [processes, pathMap] = await Promise.all([psList(), getProcessPaths()]);

    const enriched = [];
    for (const p of processes.slice(0, 400)) {
      const native = pathMap.get(Number(p.pid)) || {};
      const filePath = native.path || null;
      const signature = filePath ? await getSignatureInfo(filePath) : { status: 'Unknown', publisher: null };
      const item = {
        pid: p.pid,
        ppid: native.parentPid || p.ppid || null,
        name: native.name || p.name,
        cmd: native.commandLine || p.cmd || null,
        path: filePath,
        publisher: signature.publisher,
        signatureStatus: signature.status,
        cpu: p.cpu !== undefined ? +p.cpu.toFixed(1) : null,
        memory: p.memory !== undefined ? +p.memory.toFixed(1) : null
      };
      item.risk = makeRisk(processSignals(item, signature));
      item.recommendedAction = recommendationForRisk(item.risk, 'process');
      enriched.push(item);
    }

    return enriched.sort((a, b) => b.risk.score - a.risk.score || (b.cpu || 0) - (a.cpu || 0));
  }
};
