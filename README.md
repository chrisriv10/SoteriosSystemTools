# Soterios

Soterios is a local-first Windows security and system health assistant. It helps everyday Windows users understand their device posture, review startup persistence, inspect suspicious processes, scan files with explainable local heuristics, quarantine risky files, and export security reports.

Soterios is built with Electron and runs its checks on the local machine. It does not upload files, telemetry, scan history, or reports.

## Screenshots

Add product screenshots here before publishing:

- Dashboard: `docs/screenshots/dashboard.png`
- Scanner: `docs/screenshots/scanner.png`
- Startup Apps: `docs/screenshots/startup.png`
- Reports: `docs/screenshots/reports.png`

## Features

- Security Dashboard with an overall 0-100 score calculated from real checks
- Microsoft Defender status, real-time protection, signature age, and engine information
- Windows Firewall profile status
- Windows Update pending update summary
- Startup and persistence scanner for Registry Run keys, Startup folders, Scheduled Tasks, and Windows services
- Process monitor with parent PID, command line, executable path, Authenticode publisher, and suspicious process scoring
- Local file scanner with SHA-256 hashing, signature matches, entropy analysis, suspicious location detection, unsigned executable checks, PE metadata analysis, and explainable risk scoring
- Quarantine records with original path, hash, detection reason, timestamp, restore, delete, and history
- Security report export to HTML and JSON
- Plugin-style tool registry with metadata, versions, permissions, and isolated error handling
- Local settings, app data, and crash/error logging
- Windows installer with app icon, shortcuts, and uninstall support

## Installation

Download the Windows installer from the release artifacts and run:

```text
Soterios-Setup-1.0.1.exe
```

The installer supports Start Menu shortcuts, optional desktop shortcut creation, and uninstall through Windows Apps & Features.

## Build From Source

Install dependencies:

```bash
npm ci
```

Run locally:

```bash
npm start
```

Build an unpacked Windows app:

```bash
npm run pack
```

Build the production Windows installer:

```bash
npm run dist:win
```

Installer output is written to `dist/`.

## Architecture

```text
src/main/             Electron main process, IPC, app menu, logging
src/preload/          Secure contextBridge API exposed to the renderer
src/ui/               HTML, CSS, and page modules
src/core/             Tool registry, plugin loader, app store
src/tools/            Built-in security, system, scanner, report, and maintenance tools
src/security/         Windows check helpers and shared risk scoring
src/av/               Local file scanner and signature database
src/scripts/          Safe maintenance script registry and implementations
assets/               Product icons
```

The renderer never gets direct Node access. Pages call the preload API, which invokes registered tools through IPC.

## Plugin System

Tools are loaded from `src/tools/*.js`. A plugin exports either one tool object or an array of tool objects:

```js
module.exports = {
  id: 'example-tool',
  name: 'Example Tool',
  description: 'Runs a local check.',
  category: 'Security',
  icon: 'shield',
  version: '1.0.0',
  permissions: ['system-read'],
  run: async (args, ctx) => {
    return { ok: true };
  }
};
```

The loader registers valid tools, logs loading failures, and keeps the app running if a single plugin fails.

## Security Disclaimer

Soterios is an assistant, not a replacement for Microsoft Defender, enterprise EDR, or a dedicated antivirus product. Its scanner uses local signatures and transparent heuristics. A suspicious result means "review this" rather than proof of malware. A clean result does not guarantee a file is safe.

Some Windows checks require permissions available to the current user. Missing permissions may produce "unavailable" status instead of a failure.

## Roadmap

- Optional hash reputation providers with explicit user opt-in
- Safer enable/disable workflows for startup entries
- PDF report export
- Signed production releases
- Plugin marketplace folder with user-installed tools
- More detailed PE version resource extraction
- Automated UI smoke tests
