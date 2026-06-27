const { exec } = require('child_process');
const util = require('util');
const si = require('systeminformation');
const execPromise = util.promisify(exec);
const path = require('path');
const fs = require('fs');

class SystemAudit {
  async runPowerShell(script) {
    try {
      const { stdout } = await execPromise(`powershell.exe -NoProfile -NonInteractive -Command "${script}"`, { timeout: 15000 });
      return { ok: true, stdout };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async runAudit() {
    const results = [];

    // 1. Windows Defender
    const def = await this.runPowerShell(`Get-MpComputerStatus | Select-Object AMServiceEnabled, AntivirusEnabled, RealTimeProtectionEnabled, AMEngineVersion, AntivirusSignatureVersion, AntivirusSignatureAge | ConvertTo-Json`);
    if (def.ok) {
      try {
        const s = JSON.parse(def.stdout);
        if (s.AntivirusEnabled) {
          results.push({ name: 'Windows Defender Antivirus', status: 'pass', message: 'Defender antivirus is enabled and running.', detail: `Engine: ${s.AMEngineVersion || 'N/A'} | Signatures: ${s.AntivirusSignatureVersion || 'N/A'} (${s.AntivirusSignatureAge || 0} days old)`, recommendation: 'Keep Windows Update enabled for automatic definition updates.' });
        } else {
          results.push({ name: 'Windows Defender Antivirus', status: 'fail', message: 'Defender antivirus is disabled!', detail: 'Antivirus protection is turned off.', recommendation: 'Open Windows Security > Virus & threat protection and turn on real-time protection.' });
        }
        results.push({ name: 'Real-Time Protection', status: s.RealTimeProtectionEnabled ? 'pass' : 'fail', message: s.RealTimeProtectionEnabled ? 'Real-time protection is active.' : 'Real-time protection is off!', detail: s.RealTimeProtectionEnabled ? 'Threats are blocked as they appear.' : 'Your system is vulnerable to active threats.', recommendation: s.RealTimeProtectionEnabled ? '' : 'Enable real-time protection in Windows Security settings.' });
      } catch (e) {
        results.push({ name: 'Windows Defender', status: 'error', message: 'Could not parse Defender status.', detail: e.message });
      }
    } else {
      results.push({ name: 'Windows Defender', status: 'error', message: 'Failed to query Defender status.', detail: 'The Get-MpComputerStatus cmdlet may not be available on this system.' });
    }

    // 2. UAC
    const uac = await this.runPowerShell(`(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System').EnableLUA`);
    if (uac.ok) {
      const enabled = uac.stdout.trim() === '1';
      results.push({
        name: 'User Account Control (UAC)', status: enabled ? 'pass' : 'fail',
        message: enabled ? 'UAC is enabled.' : 'UAC is disabled! This is a severe security risk.',
        detail: enabled ? 'UAC prompts before making system-level changes.' : 'All programs run with full administrator privileges.',
        recommendation: enabled ? '' : 'Enable UAC via Control Panel > User Accounts > Change User Account Control settings.'
      });
    } else {
      results.push({ name: 'User Account Control', status: 'error', message: 'Could not check UAC status.' });
    }

    // 3. Windows Update status
    const up = await this.runPowerShell(`$session = New-Object -ComObject Microsoft.Update.Session -ErrorAction Stop; $searcher = $session.CreateUpdateSearcher(); $pending = $searcher.Search("IsInstalled=0 and IsHidden=0"); $pending.Updates.Count`);
    if (up.ok) {
      const count = parseInt(up.stdout.trim(), 10);
      if (isNaN(count) || count === 0) {
        results.push({ name: 'Windows Updates', status: 'pass', message: 'No pending updates.', detail: 'All available updates are installed.', recommendation: 'Keep automatic updates enabled.' });
      } else {
        results.push({ name: 'Windows Updates', status: 'warn', message: `${count} update(s) pending.`, detail: `${count} update(s) are waiting to be installed.`, recommendation: 'Open Settings > Windows Update and install pending updates.' });
      }
    } else {
      results.push({ name: 'Windows Updates', status: 'warn', message: 'Could not query update status.', detail: 'Windows Update may be disabled or the COM query timed out.', recommendation: 'Check Windows Update in Settings manually.' });
    }

    // 4. BitLocker
    const bl = await this.runPowerShell(`Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop | Select-Object ProtectionStatus | ConvertTo-Json`);
    if (bl.ok) {
      try {
        const b = JSON.parse(bl.stdout);
        results.push({
          name: 'BitLocker Drive Encryption', status: b.ProtectionStatus === 1 ? 'pass' : 'warn',
          message: b.ProtectionStatus === 1 ? 'System drive is encrypted.' : 'System drive is NOT encrypted.',
          detail: b.ProtectionStatus === 1 ? 'Your data is protected if the device is lost or stolen.' : 'Anyone with physical access can read your data.',
          recommendation: b.ProtectionStatus === 1 ? '' : 'Enable BitLocker via Control Panel > BitLocker Drive Encryption.'
        });
      } catch (e) {
        results.push({ name: 'BitLocker', status: 'info', message: 'BitLocker status unavailable (may not be supported on this edition).', detail: 'BitLocker requires Windows Pro or Enterprise.' });
      }
    } else {
      results.push({ name: 'BitLocker', status: 'info', message: 'BitLocker is not available on this system.', detail: 'Requires Windows Pro/Enterprise and a TPM chip.' });
    }

    // 5. PowerShell Execution Policy
    const ep = await this.runPowerShell(`(Get-ExecutionPolicy -Scope LocalMachine).ToString()`);
    if (ep.ok) {
      const policy = ep.stdout.trim();
      const restricted = policy === 'Restricted' || policy === 'RemoteSigned';
      results.push({
        name: 'PowerShell Execution Policy', status: restricted ? 'pass' : 'warn',
        message: `Policy: ${policy}`,
        detail: restricted ? 'Only signed or locally authored scripts can run.' : 'Less restrictive execution policy may allow untrusted scripts.',
        recommendation: restricted ? '' : 'Consider setting to RemoteSigned: Set-ExecutionPolicy RemoteSigned -Scope LocalMachine'
      });
    }

    // 6. Secure Boot status
    const sb = await this.runPowerShell(`Confirm-SecureBootUEFI`);
    if (sb.ok) {
      const enabled = sb.stdout.trim() === 'True';
      results.push({
        name: 'Secure Boot', status: enabled ? 'pass' : 'fail',
        message: enabled ? 'Secure Boot is enabled.' : 'Secure Boot is disabled!',
        detail: enabled ? 'Only trusted bootloaders can run during system startup.' : 'System is vulnerable to bootkit attacks.',
        recommendation: enabled ? '' : 'Enable Secure Boot in your UEFI/BIOS firmware settings.'
      });
    } else {
      results.push({ name: 'Secure Boot', status: 'info', message: 'Secure Boot status could not be determined.', detail: 'This check may not be supported on virtual machines or older hardware.' });
    }

    return results;
  }
}

module.exports = SystemAudit;
