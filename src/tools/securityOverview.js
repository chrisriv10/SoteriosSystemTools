const si = require('systeminformation');
const {
  getDefenderStatus,
  getFirewallStatus,
  getUpdateStatus
} = require('../security/windowsChecks');

function addIssue(issues, level, title, detail, points, actionPage) {
  issues.push({ level, title, detail, points, actionPage });
}

function levelForScore(score) {
  if (score >= 80) return 'ok';
  if (score >= 60) return 'warn';
  return 'danger';
}

async function buildSecurityOverview(ctx) {
  const store = ctx.appStore ? ctx.appStore.getSnapshot() : { history: {}, quarantine: [] };
  const [defender, firewall, updates, fsSize, load, mem, startup, processes] = await Promise.all([
    getDefenderStatus(),
    getFirewallStatus(),
    getUpdateStatus(),
    si.fsSize(),
    si.currentLoad(),
    si.mem(),
    ctx.toolRegistry ? ctx.toolRegistry.run('startup-persistence-scan', {}, ctx) : Promise.resolve({ ok: true, data: { summary: {}, items: [] } }),
    ctx.toolRegistry ? ctx.toolRegistry.run('process-viewer', {}, ctx) : Promise.resolve({ ok: true, data: [] })
  ]);

  const startupData = startup && startup.ok ? startup.data : { summary: {}, items: [] };
  const processData = processes && processes.ok && Array.isArray(processes.data) ? processes.data : [];
  const suspiciousProcesses = processData.filter((item) => item.risk && item.risk.score >= 35);
  const issues = [];
  let score = 100;

  if (!defender.available) {
    addIssue(issues, 'warn', 'Windows Defender status unavailable', 'Soterios could not read Microsoft Defender status.', 8, 'settings');
    score -= 8;
  } else {
    if (!defender.antivirusEnabled) {
      addIssue(issues, 'danger', 'Microsoft Defender antivirus is disabled', 'Enable antivirus protection in Windows Security.', 24, 'dashboard');
      score -= 24;
    }
    if (!defender.realTimeProtectionEnabled) {
      addIssue(issues, 'danger', 'Real-time protection is disabled', 'Turn on real-time protection to block threats as they appear.', 24, 'dashboard');
      score -= 24;
    }
    if (Number(defender.signaturesAge) > 7) {
      addIssue(issues, 'warn', 'Defender signatures are stale', `Signature age is ${defender.signaturesAge} day(s).`, 10, 'dashboard');
      score -= 10;
    }
  }

  const disabledProfiles = firewall.filter((profile) => !profile.enabled);
  if (disabledProfiles.length) {
    addIssue(issues, 'danger', 'Windows Firewall is disabled', `${disabledProfiles.map((p) => p.name).join(', ')} profile(s) are off.`, 18, 'dashboard');
    score -= 18;
  }

  if (updates.pendingCount === null || updates.pendingCount === undefined) {
    addIssue(issues, 'warn', 'Windows Update status unavailable', 'Soterios could not read pending Windows updates.', 6, 'reports');
    score -= 6;
  } else if (updates.pendingCount > 0) {
    addIssue(issues, 'warn', 'Windows updates are pending', `${updates.pendingCount} update(s) are waiting to install.`, Math.min(15, 5 + updates.pendingCount), 'reports');
    score -= Math.min(15, 5 + updates.pendingCount);
  }

  const highStartup = (startupData.items || []).filter((item) => item.risk && item.risk.score >= 35);
  if (highStartup.length) {
    addIssue(issues, 'warn', 'Startup persistence risk detected', `${highStartup.length} startup item(s) should be reviewed.`, Math.min(18, highStartup.length * 4), 'startup');
    score -= Math.min(18, highStartup.length * 4);
  }

  if (suspiciousProcesses.length) {
    addIssue(issues, 'warn', 'Suspicious process behavior detected', `${suspiciousProcesses.length} running process(es) should be reviewed.`, Math.min(16, suspiciousProcesses.length * 4), 'processes');
    score -= Math.min(16, suspiciousProcesses.length * 4);
  }

  const latestScan = store.history.scans && store.history.scans[0];
  if (!latestScan) {
    addIssue(issues, 'warn', 'No baseline file scan has been run', 'Run a scan to establish local file risk history.', 8, 'scanner');
    score -= 8;
  } else if ((latestScan.summary && latestScan.summary.flagged) > 0) {
    const flagged = latestScan.summary.flagged;
    addIssue(issues, flagged > 3 ? 'danger' : 'warn', 'Recent scan found flagged files', `${flagged} file(s) were flagged in the latest scan.`, Math.min(24, flagged * 6), 'scanner');
    score -= Math.min(24, flagged * 6);
  }

  const activeQuarantine = (store.quarantine || []).filter((item) => item.status === 'quarantined');
  if (activeQuarantine.length) {
    addIssue(issues, 'warn', 'Quarantine needs review', `${activeQuarantine.length} quarantined item(s) are awaiting decision.`, Math.min(8, activeQuarantine.length * 2), 'quarantine');
    score -= Math.min(8, activeQuarantine.length * 2);
  }

  const disk = fsSize[0] || null;
  if (disk && disk.use >= 90) {
    addIssue(issues, 'danger', 'Primary disk space is critically low', `${disk.mount} is ${disk.use.toFixed(1)}% used.`, 14, 'scripts');
    score -= 14;
  } else if (disk && disk.use >= 80) {
    addIssue(issues, 'warn', 'Primary disk space is getting low', `${disk.mount} is ${disk.use.toFixed(1)}% used.`, 6, 'scripts');
    score -= 6;
  }

  const memoryUse = ((mem.total - mem.available) / mem.total) * 100;
  if (load.currentLoad >= 90 || memoryUse >= 92) {
    addIssue(issues, 'warn', 'System pressure is high', `CPU ${load.currentLoad.toFixed(1)}%, memory ${memoryUse.toFixed(1)}%.`, 6, 'processes');
    score -= 6;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const recommendations = issues.length
    ? issues.map((issue) => ({
      level: issue.level,
      title: issue.title,
      detail: issue.detail,
      actionPage: issue.actionPage
    }))
    : [{
      level: 'ok',
      title: 'No urgent security actions',
      detail: 'Core Windows protections and recent Soterios checks look healthy.',
      actionPage: 'dashboard'
    }];

  return {
    generatedAt: new Date().toISOString(),
    score,
    level: levelForScore(score),
    defender,
    firewall,
    updates,
    startup: startupData.summary || {},
    suspiciousProcesses: suspiciousProcesses.length,
    disk: disk ? { mount: disk.mount, usePercent: +disk.use.toFixed(1), size: disk.size, used: disk.used } : null,
    system: {
      cpuLoad: +load.currentLoad.toFixed(1),
      memoryUse: +memoryUse.toFixed(1)
    },
    issues,
    recommendations
  };
}

module.exports = {
  id: 'security-overview',
  name: 'Security Overview',
  description: 'Calculate the Windows security score from Defender, firewall, update, startup, scan, and system health checks.',
  category: 'Security',
  icon: 'shield-check',
  version: '1.0.0',
  permissions: ['windows-security-status', 'system-telemetry', 'app-history'],
  run: async (args, ctx) => buildSecurityOverview(ctx || {})
};
