const si = require('systeminformation');

module.exports = async function networkReport() {
  const [interfaces, gateway, connections] = await Promise.all([
    si.networkInterfaces(),
    si.networkGatewayDefault().catch(() => null),
    si.networkConnections().catch(() => [])
  ]);

  const activeConnections = connections
    .filter((conn) => conn.state === 'ESTABLISHED')
    .slice(0, 80)
    .map((conn) => ({
      protocol: conn.protocol,
      localAddress: conn.localAddress,
      localPort: conn.localPort,
      peerAddress: conn.peerAddress,
      peerPort: conn.peerPort,
      process: conn.process,
      pid: conn.pid
    }));

  return {
    defaultGateway: gateway,
    interfaces: interfaces.map((iface) => ({
      iface: iface.iface,
      ip4: iface.ip4,
      ip6: iface.ip6,
      mac: iface.mac,
      type: iface.type,
      operstate: iface.operstate,
      speed: iface.speed,
      dhcp: iface.dhcp
    })),
    establishedConnectionCount: connections.filter((conn) => conn.state === 'ESTABLISHED').length,
    activeConnections
  };
};
