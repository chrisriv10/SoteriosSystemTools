// Lightweight local signature scanner.
//
// This is not a replacement for a dedicated antivirus engine. It provides
// transparent local checks: SHA-256 signature matching, risk heuristics, and
// reversible quarantine.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const SIGNATURE_DB_PATH = path.join(__dirname, 'signatureDB.json');
const QUARANTINE_DIR = path.join(os.homedir(), '.soterios-quarantine');

const SUSPICIOUS_EXTENSIONS = new Set([
  '.scr', '.pif', '.vbs', '.js', '.jse', '.wsf', '.hta', '.cpl',
  '.ps1', '.bat', '.cmd', '.reg', '.lnk', '.jar', '.msi'
]);

const EXECUTABLE_EXTENSIONS = new Set([
  '.exe', '.dll', '.sys', '.com', '.msi', '.jar', '.ps1', '.bat', '.cmd',
  '.vbs', '.js', '.jse', '.wsf', '.hta', '.scr', '.cpl'
]);

const DOCUMENT_MACRO_EXTENSIONS = new Set([
  '.docm', '.xlsm', '.pptm', '.dotm', '.xltm', '.potm'
]);

const DOUBLE_EXTENSION_PATTERN = /\.(pdf|docx?|xlsx?|pptx?|jpg|jpeg|png|gif|txt|csv)\.(exe|scr|js|vbs|bat|cmd|ps1|hta|jar)$/i;

function loadSignatureDB() {
  try {
    const raw = fs.readFileSync(SIGNATURE_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.signatures || [];
  } catch (err) {
    console.error('[scanner] Failed to load signature DB:', err);
    return [];
  }
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function calculateEntropy(buffer) {
  if (buffer.length === 0) return 0;
  const freq = new Array(256).fill(0);
  for (const byte of buffer) freq[byte]++;
  let entropy = 0;
  for (const count of freq) {
    if (count === 0) continue;
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function addFlag(flags, severity, message) {
  flags.push({ severity, message });
}

function scoreFlags(flags) {
  return flags.reduce((total, flag) => {
    if (flag.severity === 'critical') return total + 55;
    if (flag.severity === 'high') return total + 35;
    if (flag.severity === 'medium') return total + 18;
    return total + 8;
  }, 0);
}

function riskFromStatus(status, flags = []) {
  if (status === 'match') return { score: 100, level: 'critical' };
  const score = Math.min(95, scoreFlags(flags));
  if (score >= 70) return { score, level: 'high' };
  if (score >= 35) return { score, level: 'medium' };
  if (score > 0) return { score, level: 'low' };
  return { score: 0, level: 'none' };
}

function runHeuristics(filePath, sampleBuffer, stat) {
  const flags = [];
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath);
  const normalizedPath = filePath.toLowerCase();

  if (SUSPICIOUS_EXTENSIONS.has(ext)) {
    addFlag(flags, 'medium', `Script or control-panel capable extension (${ext})`);
  }

  if (DOCUMENT_MACRO_EXTENSIONS.has(ext)) {
    addFlag(flags, 'medium', `Office macro-enabled document (${ext})`);
  }

  if (DOUBLE_EXTENSION_PATTERN.test(baseName)) {
    addFlag(flags, 'high', 'Double extension disguises an executable file type');
  }

  const tempIndicators = ['\\temp\\', '/tmp/', '\\appdata\\local\\temp', '/var/tmp/'];
  if (tempIndicators.some((indicator) => normalizedPath.includes(indicator))) {
    addFlag(flags, EXECUTABLE_EXTENSIONS.has(ext) ? 'high' : 'low', 'Located in a temporary directory');
  }

  const startupIndicators = [
    '\\microsoft\\windows\\start menu\\programs\\startup\\',
    '\\appdata\\roaming\\microsoft\\windows\\start menu\\programs\\startup\\'
  ];
  if (startupIndicators.some((indicator) => normalizedPath.includes(indicator))) {
    addFlag(flags, 'medium', 'Located in a Windows startup folder');
  }

  if (normalizedPath.includes('\\appdata\\roaming\\') && EXECUTABLE_EXTENSIONS.has(ext)) {
    addFlag(flags, 'medium', 'Executable or script located under AppData Roaming');
  }

  if (stat && stat.size > 0 && stat.size < 1024 && EXECUTABLE_EXTENSIONS.has(ext)) {
    addFlag(flags, 'low', 'Very small executable or script file');
  }

  if (sampleBuffer && sampleBuffer.length > 0) {
    const entropy = calculateEntropy(sampleBuffer);
    if (entropy > 7.65 && EXECUTABLE_EXTENSIONS.has(ext)) {
      addFlag(flags, 'high', `High entropy (${entropy.toFixed(2)}/8.0), possibly packed or encrypted`);
    } else if (entropy > 7.75) {
      addFlag(flags, 'low', `High entropy (${entropy.toFixed(2)}/8.0)`);
    }

    const sampleText = sampleBuffer.toString('utf8').toLowerCase();
    const scriptSignals = [
      'powershell',
      'invoke-expression',
      'frombase64string',
      'wscript.shell',
      'downloadstring',
      'encodedcommand'
    ];
    const hits = scriptSignals.filter((signal) => sampleText.includes(signal));
    if (hits.length > 0) {
      addFlag(flags, hits.length >= 2 ? 'high' : 'medium', `Suspicious script keywords: ${hits.join(', ')}`);
    }
  }

  return flags;
}

async function scanFile(filePath, signatures, options = {}) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    return { path: filePath, status: 'error', error: 'Could not stat file' };
  }

  if (!stat.isFile()) {
    return { path: filePath, status: 'skipped', reason: 'Not a regular file' };
  }

  const maxFileSizeBytes = options.maxFileSizeBytes || Infinity;
  if (stat.size > maxFileSizeBytes) {
    return {
      path: filePath,
      status: 'skipped',
      reason: `Larger than configured limit (${Math.round(maxFileSizeBytes / 1024 / 1024)} MB)`,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString()
    };
  }

  const maxSampleBytes = 2 * 1024 * 1024;
  let sampleBuffer = Buffer.alloc(0);
  try {
    const fd = fs.openSync(filePath, 'r');
    const size = Math.min(stat.size, maxSampleBytes);
    sampleBuffer = Buffer.alloc(size);
    fs.readSync(fd, sampleBuffer, 0, size, 0);
    fs.closeSync(fd);
  } catch (err) {
    // Non-fatal; entropy and content heuristics will be skipped.
  }

  let hash;
  try {
    hash = await hashFile(filePath);
  } catch (err) {
    return { path: filePath, status: 'error', error: 'Could not read/hash file' };
  }

  const match = signatures.find((sig) => sig.hash.toLowerCase() === hash.toLowerCase());
  if (match) {
    return {
      path: filePath,
      status: 'match',
      hash,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      signatureName: match.name,
      risk: riskFromStatus('match')
    };
  }

  const flags = runHeuristics(filePath, sampleBuffer, stat);
  if (flags.length > 0) {
    return {
      path: filePath,
      status: 'suspicious',
      hash,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      flags,
      risk: riskFromStatus('suspicious', flags)
    };
  }

  return {
    path: filePath,
    status: 'clean',
    hash,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    risk: riskFromStatus('clean')
  };
}

function walkDirectory(dirPath, onFile, options = {}) {
  const maxDepth = options.maxDepth ?? 12;
  const excludedDirNames = (options.excludedDirNames || []).map((name) => name.toLowerCase());

  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const normalizedName = entry.name.toLowerCase();
        const normalizedFullPath = fullPath.toLowerCase();
        if (excludedDirNames.some((excluded) => normalizedName === excluded || normalizedFullPath.includes(excluded))) {
          continue;
        }
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        onFile(fullPath);
      }
    }
  }

  walk(dirPath, 0);
}

function quarantineFile(filePath) {
  if (!fs.existsSync(QUARANTINE_DIR)) {
    fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
  }
  const safeBase = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
  const destName = `${Date.now()}_${safeBase}`;
  const dest = path.join(QUARANTINE_DIR, destName);
  fs.renameSync(filePath, dest);
  return dest;
}

function restoreQuarantinedFile(quarantinePath, originalPath) {
  if (!fs.existsSync(quarantinePath)) throw new Error('Quarantined file does not exist');
  const targetDir = path.dirname(originalPath);
  fs.mkdirSync(targetDir, { recursive: true });
  if (fs.existsSync(originalPath)) {
    throw new Error('A file already exists at the original path');
  }
  fs.renameSync(quarantinePath, originalPath);
  return originalPath;
}

function deleteQuarantinedFile(quarantinePath) {
  if (!fs.existsSync(quarantinePath)) throw new Error('Quarantined file does not exist');
  fs.unlinkSync(quarantinePath);
  return true;
}

module.exports = {
  loadSignatureDB,
  hashFile,
  scanFile,
  walkDirectory,
  quarantineFile,
  restoreQuarantinedFile,
  deleteQuarantinedFile,
  QUARANTINE_DIR
};
