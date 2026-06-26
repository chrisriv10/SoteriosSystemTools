# Soterios System Tools

A local-first Windows desktop app for system maintenance, monitoring, and security checks. Built with Electron 31.

## Features

- **Security Dashboard** — Overall score from Defender status, firewall profiles, Windows Update, scan history, and system health
- **Action Center** — Prioritized recommendations with direct navigation to the relevant page
- **ClamAV File Scanner** — Quick, full, and custom folder scans with real-time progress bar, threat detection, and quarantine
- **Process Inspector** — Running processes with live CPU/RAM and heuristic risk scoring
- **Windows Security Audit** — Checks Defender, UAC, firewall, BitLocker, Secure Boot, Windows Update, PowerShell policy
- **Firewall Management** — Profile status and rule summary (inbound/outbound, allow/block counts)
- **Network Monitor** — Active TCP connections grouped by state with per-interface bandwidth
- **Maintenance Scripts** — On-demand temp cleanup, disk space report, large files, browser cache, startup items, network report, Windows services report
- **Password Generator** — Cryptographically random password generation and offline strength checker
- **Quarantine Management** — Restore or permanently delete isolated files
- **Security Reports** — Auto-generated HTML/JSON reports after each scan, accessible from the Reports page
- **Real-Time Protection** — File system watcher with instant alerting
- **Tools** — Extensible plugin system (12 built-in tools)

**No telemetry. No network calls. All data stays on your machine.**

## Quick start

```bash
npm install
npm start
```

## Build from source

### Prerequisites
- Node.js 22+
- Windows (electron-builder NSIS target)

### Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run locally in development mode |
| `npm run pack` | Build unpacked Windows app (fast, no installer) |
| `npm run dist:win` | Build production Windows installer (.exe) |

The installer is written to `dist/Soterios System Tools-Setup-1.0.1.exe`.

### GitHub Actions

Push a tag starting with `v` to trigger an automated build and GitHub Release:

```bash
git tag v1.0.1
git push origin v1.0.1
```

## Project structure

```
main.js              Electron main process, window creation, service wiring
src/
  preload/           contextBridge API exposed to the renderer
  main/              IPC handlers (ipcHandlers.js), service orchestration
  core/              Tool registry, plugin loader, database
  tools/             12 plugins: process viewer, security overview, system monitor, report generator, etc.
  security/          Windows check helpers (Defender, firewall, updates, signatures), audit, network monitor
  av/                ClamAV integration (spawner, engine), scan logic
  scripts/           Maintenance script registry + 7 safe script implementations
  ui/
    pages/           shell.html — the app's single HTML entry point
    css/             style.css — dark glassmorphism theme
    js/              api.js, components.js, router.js, state.js
    js/pages/        One JS module per page (dashboard, scanner, quarantine, processes, audit, firewall, network, etc.)
assets/              App icons, ClamAV binaries
```

## Adding signatures

Edit `src/av/signatureDB.json` and add entries:

```json
{ "name": "My Signature", "hash": "<sha256-lowercase-hex>" }
```

The EICAR test hash is included by default so you can verify the scanner works end-to-end.

## Architecture notes

- **Sandbox**: `contextIsolation: true`, `sandbox: true`, preload script for bridge API
- **IPC communication**: Renderer invokes `window.api.invoke()`/`window.api.on()` → main process handlers → services
- **No `appStore`**: The legacy Vuex-style central store was removed; settings use `db:getSetting`/`db:setSetting` IPC, components manage their own state
- **systeminformation** for process data (`si.processes()`) and system stats
- **ClamAV** bundled at `assets/clamav/` — spawns `clamscan.exe` for actual scanning; virus definitions need `freshclam` or a bundled `main.cvd`
- **Safe scripts** in `src/safeScripts/` are standalone Node.js scripts registered in `registry.json`
- **CSS**: Dark theme with glassmorphism cards, CSS custom properties, utility grid classes

## Security notes

- Defender/firewall/update checks use PowerShell with three fallback strategies, so they work even without elevation
- The file scanner is a local heuristic tool, not a replacement for Microsoft Defender
- Quarantined files are moved (not copied) to `~/.soterios-quarantine`
