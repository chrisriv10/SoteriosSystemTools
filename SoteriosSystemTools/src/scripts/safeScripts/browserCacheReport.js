const fs = require('fs');
const path = require('path');
const os = require('os');

function dirSize(dirPath) {
  let total = 0;
  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.isFile()) total += fs.statSync(fullPath).size;
      } catch (err) {
        // Ignore locked cache files.
      }
    }
  }
  if (fs.existsSync(dirPath)) walk(dirPath);
  return total;
}

module.exports = async function browserCacheReport() {
  const home = os.homedir();
  const candidates = [
    { name: 'Chrome', path: path.join(home, 'AppData/Local/Google/Chrome/User Data/Default/Cache') },
    { name: 'Edge', path: path.join(home, 'AppData/Local/Microsoft/Edge/User Data/Default/Cache') },
    { name: 'Brave', path: path.join(home, 'AppData/Local/BraveSoftware/Brave-Browser/User Data/Default/Cache') },
    { name: 'Firefox', path: path.join(home, 'AppData/Local/Mozilla/Firefox/Profiles') }
  ];

  const browsers = candidates.map((candidate) => {
    const bytes = dirSize(candidate.path);
    return {
      name: candidate.name,
      path: candidate.path,
      exists: fs.existsSync(candidate.path),
      sizeMB: +(bytes / 1024 / 1024).toFixed(1)
    };
  });

  return {
    totalMB: +((browsers.reduce((sum, item) => sum + item.sizeMB, 0))).toFixed(1),
    browsers
  };
};
