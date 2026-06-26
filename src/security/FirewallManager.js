const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class FirewallManager {
  async getStatus() {
    try {
      const { stdout } = await execPromise(`powershell.exe -NoProfile -NonInteractive -Command "Get-NetFirewallProfile | Select-Object Name, Enabled | ConvertTo-Json"`);
      return JSON.parse(stdout);
    } catch (e) {
      console.error('Failed to get firewall status', e);
      return [];
    }
  }

  async getRules() {
    try {
      const { stdout } = await execPromise(`powershell.exe -NoProfile -NonInteractive -Command "$rules = Get-NetFirewallRule -PolicyStore ActiveStore | Select-Object DisplayName, Direction, Action, Enabled, Profile; $total = $rules.Count; $in = ($rules | Where-Object Direction -eq 'Inbound').Count; $out = ($rules | Where-Object Direction -eq 'Outbound').Count; $enabled = ($rules | Where-Object Enabled -eq 'True').Count; $disabled = $total - $enabled; $allow = ($rules | Where-Object Action -eq 'Allow').Count; $block = ($rules | Where-Object Action -eq 'Block').Count; $profDomain = ($rules | Where-Object Profile -eq 'Domain').Count; $profPrivate = ($rules | Where-Object Profile -eq 'Private').Count; $profPublic = ($rules | Where-Object Profile -eq 'Public').Count; Write-Output "$total|$in|$out|$enabled|$disabled|$allow|$block|$profDomain|$profPrivate|$profPublic"`, { timeout: 15000 });
      const parts = stdout.trim().split('|');
      return {
        total: parseInt(parts[0]) || 0,
        inbound: parseInt(parts[1]) || 0,
        outbound: parseInt(parts[2]) || 0,
        enabled: parseInt(parts[3]) || 0,
        disabled: parseInt(parts[4]) || 0,
        allow: parseInt(parts[5]) || 0,
        block: parseInt(parts[6]) || 0,
        profiles: {
          domain: parseInt(parts[7]) || 0,
          private: parseInt(parts[8]) || 0,
          public: parseInt(parts[9]) || 0
        }
      };
    } catch (e) {
      console.error('Failed to get firewall rules', e);
      return null;
    }
  }
}

module.exports = FirewallManager;
