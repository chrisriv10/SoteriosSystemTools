const fs = require('fs');
const path = require('path');
const os = require('os');

const SKIP_DIRS = new Set(['node_modules', '.git', 'AppData\\Local\\Packages']);

function shouldSkip(fullPath, name) {
  if (SKIP_DIRS.has(name)) return true;
  const lower = fullPath.toLowerCase();
  return lower.includes('\\appdata\\local\\packages\\') || lower.includes('\\appdata\\local\\microsoft\\windowsapps\\');
}

module.exports = async function largeFilesReport(args = {}) {
  const root = args.path || os.homedir();
  const minSizeMB = Number(args.minSizeMB || 100);
  const minBytes = minSizeMB * 1024 * 1024;
  const maxResults = Number(args.maxResults || 40);
  const files = [];

  function walk(current, depth) {
    if (depth > 8) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkip(fullPath, entry.name)) walk(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size >= minBytes) {
          files.push({
            path: fullPath,
            sizeMB: +(stat.size / 1024 / 1024).toFixed(1),
            modifiedAt: stat.mtime.toISOString()
          });
        }
      } catch (err) {
        // Ignore unreadable files.
      }
    }
  }

  walk(root, 0);
  files.sort((a, b) => b.sizeMB - a.sizeMB);

  return {
    root,
    minSizeMB,
    count: files.length,
    files: files.slice(0, maxResults)
  };
};
