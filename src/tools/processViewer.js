const si = require('systeminformation');
const { makeRisk } = require('../security/riskEngine');

function processSignals(proc) {
  const signals = [];
  const path = String(proc.path || '').toLowerCase();
  const cmd = String(proc.cmd || '').toLowerCase();
  if (path.includes('\\appdata\\roaming\\') || path.includes('\\appdata\\local\\temp\\'))
    signals.push({ points: 25, message: 'Runs from a user AppData or temporary location.' });
  if (path.includes('\\windows\\temp\\') || path.includes('\\users\\public\\'))
    signals.push({ points: 20, message: 'Runs from a commonly abused writable Windows location.' });
  if (/\.(jpg|png|pdf|docx?|xlsx?)\.(exe|scr|js|vbs|bat|cmd|ps1)$/i.test(path))
    signals.push({ points: 45, message: 'Uses a double extension commonly used to disguise malware.' });
  if (cmd.includes('-encodedcommand') || cmd.includes('frombase64string'))
    signals.push({ points: 45, message: 'Command line contains encoded script execution.' });
  if ((proc.name || '').toLowerCase() === 'powershell.exe' && cmd.includes('downloadstring'))
    signals.push({ points: 35, message: 'PowerShell download/execute indicators.' });
  return signals;
}

function recommendationForRisk(risk) {
  if (risk.score >= 50) return 'Immediate termination recommended.';
  if (risk.score >= 35) return 'Review process path and command line arguments.';
  return 'Safe process';
}

module.exports = {
  id: 'process-viewer', name: 'Process Viewer',
  description: 'List running processes with CPU/memory and suspicious process scoring.',
  category: 'System', icon: 'list',
  run: async () => {
    try {
      const procData = await si.processes();
      const processList = procData.list || [];
      
      return processList.slice(0, 400).map((p) => {
        const item = {
          pid: p.pid,
          ppid: p.parentPid || null,
          name: p.name || 'unknown',
          cmd: p.command || null,
          path: p.path || null,
          cpu: p.cpu !== undefined ? +(p.cpu).toFixed(1) : null,
          memory: p.mem !== undefined ? +(p.mem).toFixed(1) : null
        };
        item.risk = makeRisk(processSignals(item));
        item.recommendedAction = recommendationForRisk(item.risk);
        return item;
      }).sort((a, b) => {
        const riskDelta = b.risk.score - a.risk.score;
        if (riskDelta !== 0) return riskDelta;
        const usageA = (a.cpu || 0) + (a.memory || 0);
        const usageB = (b.cpu || 0) + (b.memory || 0);
        return usageB - usageA;
      });
    } catch (err) {
      console.error('Failed to get processes:', err);
      return [];
    }
  }
};
