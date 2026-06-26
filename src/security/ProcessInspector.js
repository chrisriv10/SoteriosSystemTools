// ps-list is ESM-only so we must use dynamic import()
class ProcessInspector {
  constructor() {}

  async getProcesses() {
    try {
      const { default: psList } = await import('ps-list');
      const processes = await psList();
      return processes.map(p => ({
        pid: p.pid,
        name: p.name,
        cmd: p.cmd || '',
        ppid: p.ppid,
        cpu: p.cpu,
        memory: p.memory,
        suspicious: !!(
          p.name && p.name.toLowerCase() === 'powershell.exe' &&
          p.cmd && p.cmd.includes('-enc')
        )
      }));
    } catch (err) {
      console.error('Failed to get processes', err);
      return [];
    }
  }
}

module.exports = ProcessInspector;
