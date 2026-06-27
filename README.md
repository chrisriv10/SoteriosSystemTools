# Soterios

Soterios is a local-first Windows desktop security and maintenance app built with Electron. It combines ClamAV-backed scanning, Windows security visibility, process inspection, real-time protection, reports, quarantine, password tools, and safe maintenance utilities in one desktop UI.

Version: 1.0.2

## Features

- Security Dashboard with health score, scan status, warnings, ignored warnings, quarantine count, and real-time protection controls
- Virus Scan with quick, full, and custom scans, ClamAV definition updates, progress, cancellation, quarantine, and saved scan reports
- In-app Reports page for browsing, viewing, generating, and deleting scan/security reports
- Process Inspector with risk-first sorting, then highest CPU/RAM impact inside the same risk level
- Windows Security Audit for Defender, UAC, Windows Update, BitLocker, PowerShell policy, and Secure Boot
- Firewall Management for Windows Firewall profile status and rule summaries
- Network Monitor for active connections and interface activity
- Password tools with generator, local strength checks, HIBP k-anonymity password leak checks, and XposedOrNot email breach checks
- Real-Time Protection through a local file system watcher
- Quarantine Management for restoring or permanently deleting isolated files
- Tools & Maintenance scripts for temp cleanup, disk reports, large files, browser cache reports, startup items, network reports, and Windows services reports

Soterios does not collect telemetry or analytics. Local scanning and system analysis happen on your machine. Network calls occur only when you trigger features that need them, such as ClamAV definition updates, HIBP password checks, or XposedOrNot email breach checks.

## Requirements

- Windows 10 or Windows 11
- Node.js 22 or newer for development/builds
- Administrator rights are requested by the packaged Windows app for system-level checks
- Internet access is optional, but needed for ClamAV definition updates and breach lookups

## Setup

```bash
npm install
npm start
```

## Build

```bash
npm run pack
npm run dist:win
```

The Windows installer is written to:

```text
dist/Soterios-Setup-1.0.2.exe
```

## Usage

1. Open Soterios.
2. Review the Dashboard for current health, warnings, and real-time protection status.
3. Run a quick, full, or custom scan from Virus Scan.
4. View scan details from Reports without leaving the app.
5. Use Windows Audit for non-firewall Windows security posture checks.
6. Use Firewall Management for firewall profile and rule visibility.
7. Use Process Inspector to review high-risk or high-impact processes.
8. Use Passwords for local generation/strength checks and optional breach lookups.

## API Notes

- Password leak checks use Have I Been Pwned Pwned Passwords k-anonymity. Only the first 5 SHA-1 hash characters are sent.
- Email breach checks use the free XposedOrNot email API.

## Project Structure

```text
main.js              Electron root entry point
src/preload/         contextBridge API exposed to the renderer
src/main/            IPC handlers and app/service orchestration
src/core/            database, event bus, tool registry, plugin loader
src/security/        scanning, quarantine, audit, firewall, network, process, and realtime services
src/tools/           built-in tool modules
src/scripts/         maintenance scripts and registry
src/ui/              shell, CSS, shared JS, and page modules
assets/              Soterios icons and bundled ClamAV files
build/               installer resources
```