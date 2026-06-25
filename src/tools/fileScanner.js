const fs = require('fs');
const path = require('path');
const {
  loadSignatureDB,
  scanFile,
  walkDirectory,
  quarantineFile,
  restoreQuarantinedFile,
  deleteQuarantinedFile
} = require('../av/scanner');

function buildScanOptions(args, ctx) {
  const settings = ctx.appStore ? ctx.appStore.getSettings() : {};
  const scannerSettings = settings.scanner || {};
  const maxFileSizeMB = Number(args.maxFileSizeMB || scannerSettings.maxFileSizeMB || 512);

  return {
    maxDepth: Number(args.maxDepth || scannerSettings.maxDepth || 12),
    maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
    excludedDirNames: args.excludedDirNames || scannerSettings.excludedDirNames || [],
    includeCleanResults: args.includeCleanResults ?? scannerSettings.includeCleanResults ?? false
  };
}

function summarize(results, targetPath, startedAt) {
  const flagged = results.filter((r) => r.status === 'match' || r.status === 'suspicious');
  const highestRisk = flagged.reduce((max, item) => Math.max(max, item.risk ? item.risk.score : 0), 0);
  return {
    targetPath,
    startedAt,
    completedAt: new Date().toISOString(),
    totalScanned: results.filter((r) => r.status !== 'skipped').length,
    clean: results.filter((r) => r.status === 'clean').length,
    suspicious: results.filter((r) => r.status === 'suspicious').length,
    matches: results.filter((r) => r.status === 'match').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    flagged: flagged.length,
    highestRisk
  };
}

function compactResultsForHistory(results) {
  return results
    .filter((r) => r.status === 'match' || r.status === 'suspicious' || r.status === 'error')
    .slice(0, 100)
    .map((r) => ({
      path: r.path,
      status: r.status,
      signatureName: r.signatureName,
      flags: r.flags,
      risk: r.risk,
      explanation: r.explanation,
      recommendedAction: r.recommendedAction,
      signature: r.signature,
      peMetadata: r.peMetadata,
      reputation: r.reputation,
      error: r.error,
      sizeBytes: r.sizeBytes,
      hash: r.hash
    }));
}

module.exports = [
  {
    id: 'file-scanner',
    name: 'File Scanner',
    description: 'Scan a folder with local signatures, risk heuristics, exclusions, and history.',
    category: 'Security',
    icon: 'search',
    run: async (args, ctx) => {
      const targetPath = args && args.path;
      if (!targetPath || !fs.existsSync(targetPath)) {
        throw new Error('A valid folder path is required');
      }

      const startedAt = new Date().toISOString();
      const options = buildScanOptions(args || {}, ctx || {});
      const signatures = loadSignatureDB();
      const filesToScan = [];
      walkDirectory(targetPath, (filePath) => filesToScan.push(filePath), options);

      const results = [];
      let scanned = 0;

      for (const filePath of filesToScan) {
        const result = await scanFile(filePath, signatures, options);
        results.push(result);
        scanned++;
        if (ctx && ctx.sendProgress) {
          ctx.sendProgress({
            scanned,
            total: filesToScan.length,
            currentFile: filePath,
            flagged: results.filter((r) => r.status === 'match' || r.status === 'suspicious').length
          });
        }
      }

      const visibleResults = options.includeCleanResults
        ? results
        : results.filter((r) => r.status !== 'clean');
      const summary = summarize(results, targetPath, startedAt);

      if (ctx.appStore) {
        ctx.appStore.addHistory('scans', {
          summary,
          flaggedResults: compactResultsForHistory(results)
        });
        ctx.appStore.updateSettings({ scanner: { defaultPath: targetPath } });
      }

      return { summary, results: visibleResults, options };
    }
  },
  {
    id: 'quarantine-file',
    name: 'Quarantine File',
    description: 'Move a flagged file to the local quarantine folder.',
    category: 'Security',
    icon: 'archive',
    run: async (args, ctx) => {
      const targetPath = args && args.path;
      if (!targetPath || !fs.existsSync(targetPath)) {
        throw new Error('A valid file path is required');
      }

      const before = fs.statSync(targetPath);
      const dest = quarantineFile(targetPath);
      const record = ctx.appStore
        ? ctx.appStore.addQuarantineRecord({
          originalPath: targetPath,
          quarantinePath: dest,
          fileName: path.basename(targetPath),
          reason: args.reason || 'Flagged by scanner',
          hash: args.hash || null,
          sizeBytes: before.size,
          risk: args.risk || null,
          detectionReason: args.reason || 'Flagged by scanner',
          metadata: args.metadata || null
        })
        : { quarantinePath: dest };

      if (ctx.appStore) {
        ctx.appStore.addHistory('actions', {
          type: 'quarantine',
          title: 'File quarantined',
          detail: targetPath,
          level: 'warn'
        });
      }

      return { quarantinedTo: dest, record };
    }
  },
  {
    id: 'restore-quarantine-file',
    name: 'Restore Quarantined File',
    description: 'Restore a quarantined file to its original path.',
    category: 'Security',
    icon: 'archive',
    run: async (args, ctx) => {
      if (!args.id || !args.quarantinePath || !args.originalPath) {
        throw new Error('A quarantine record is required');
      }
      const restoredTo = restoreQuarantinedFile(args.quarantinePath, args.originalPath);
      if (ctx.appStore) {
        ctx.appStore.updateQuarantineRecord(args.id, { status: 'restored', restoredTo });
        ctx.appStore.addHistory('actions', {
          type: 'restore',
          title: 'File restored from quarantine',
          detail: restoredTo,
          level: 'warn'
        });
      }
      return { restoredTo };
    }
  },
  {
    id: 'delete-quarantine-file',
    name: 'Delete Quarantined File',
    description: 'Permanently delete a quarantined file.',
    category: 'Security',
    icon: 'archive',
    run: async (args, ctx) => {
      if (!args.id || !args.quarantinePath) {
        throw new Error('A quarantine record is required');
      }
      deleteQuarantinedFile(args.quarantinePath);
      if (ctx.appStore) {
        ctx.appStore.updateQuarantineRecord(args.id, { status: 'deleted' });
        ctx.appStore.addHistory('actions', {
          type: 'delete-quarantine',
          title: 'Quarantined file deleted',
          detail: args.quarantinePath,
          level: 'danger'
        });
      }
      return { deleted: true };
    }
  }
];
