const fs = require('fs');
const path = require('path');

let storePath = null;
let cache = null;

const DEFAULT_SETTINGS = {
  scanner: {
    maxDepth: 12,
    maxFileSizeMB: 512,
    includeCleanResults: false,
    excludedDirNames: [
      'node_modules',
      '.git',
      'dist',
      'build',
      'AppData\\Local\\Microsoft\\WindowsApps'
    ],
    defaultPath: ''
  },
  dashboard: {
    refreshSeconds: 30
  }
};

const DEFAULT_STORE = {
  version: 1,
  settings: DEFAULT_SETTINGS,
  history: {
    scans: [],
    actions: [],
    scripts: [],
    health: []
  },
  quarantine: []
};

function init(userDataPath) {
  storePath = path.join(userDataPath, 'soterios-data.json');
  ensureLoaded();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefaults(value, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? value : clone(defaults);
  if (!defaults || typeof defaults !== 'object') return value === undefined ? defaults : value;

  const result = { ...(value && typeof value === 'object' ? value : {}) };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    result[key] = mergeDefaults(result[key], defaultValue);
  }
  return result;
}

function ensureLoaded() {
  if (!storePath) throw new Error('App store has not been initialized');
  if (cache) return cache;

  try {
    if (fs.existsSync(storePath)) {
      cache = mergeDefaults(JSON.parse(fs.readFileSync(storePath, 'utf-8')), DEFAULT_STORE);
    } else {
      cache = clone(DEFAULT_STORE);
      save();
    }
  } catch (err) {
    const backup = `${storePath}.broken-${Date.now()}`;
    try {
      if (fs.existsSync(storePath)) fs.copyFileSync(storePath, backup);
    } catch (_) {
      // Ignore backup failures; a fresh store is safer than blocking startup.
    }
    cache = clone(DEFAULT_STORE);
    save();
  }

  return cache;
}

function save() {
  if (!storePath) throw new Error('App store has not been initialized');
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(cache, null, 2));
}

function getSnapshot() {
  ensureLoaded();
  return clone(cache);
}

function getSettings() {
  ensureLoaded();
  return clone(cache.settings);
}

function updateSettings(patch) {
  ensureLoaded();
  cache.settings = mergeDefaults({ ...cache.settings, ...patch }, DEFAULT_SETTINGS);
  if (patch.scanner) {
    cache.settings.scanner = mergeDefaults({ ...cache.settings.scanner, ...patch.scanner }, DEFAULT_SETTINGS.scanner);
  }
  if (patch.dashboard) {
    cache.settings.dashboard = mergeDefaults({ ...cache.settings.dashboard, ...patch.dashboard }, DEFAULT_SETTINGS.dashboard);
  }
  save();
  return getSettings();
}

function addHistory(kind, entry, limit = 50) {
  ensureLoaded();
  if (!cache.history[kind]) cache.history[kind] = [];
  const record = {
    id: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...entry
  };
  cache.history[kind].unshift(record);
  cache.history[kind] = cache.history[kind].slice(0, limit);
  save();
  return clone(record);
}

function listHistory(kind, limit = 20) {
  ensureLoaded();
  const rows = cache.history[kind] || [];
  return clone(rows.slice(0, limit));
}

function addQuarantineRecord(record) {
  ensureLoaded();
  const entry = {
    id: `quarantine-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    status: 'quarantined',
    ...record
  };
  cache.quarantine.unshift(entry);
  save();
  return clone(entry);
}

function updateQuarantineRecord(id, patch) {
  ensureLoaded();
  const index = cache.quarantine.findIndex((item) => item.id === id);
  if (index === -1) throw new Error('Quarantine record not found');
  cache.quarantine[index] = {
    ...cache.quarantine[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  save();
  return clone(cache.quarantine[index]);
}

function listQuarantine() {
  ensureLoaded();
  return clone(cache.quarantine);
}

module.exports = {
  init,
  getSnapshot,
  getSettings,
  updateSettings,
  addHistory,
  listHistory,
  addQuarantineRecord,
  updateQuarantineRecord,
  listQuarantine
};
