/**
 * Port finder utility — finds an available port in range for the markdown-reader server.
 * Probes bind to 127.0.0.1 so they do not transiently expose a port on all interfaces.
 */

const net = require('net');

const DEFAULT_PORT = 3456;
const PORT_RANGE_END = 3500;

/**
 * Check if a port is available
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} - True if available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find first available port in range
 * @param {number} startPort - Starting port (default: 3456)
 * @returns {Promise<number>} - Available port
 * @throws {Error} - If no port available in range
 */
async function findAvailablePort(startPort = DEFAULT_PORT) {
  for (let port = startPort; port <= PORT_RANGE_END; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port in range ${startPort}-${PORT_RANGE_END}`);
}

module.exports = {
  isPortAvailable,
  findAvailablePort,
  DEFAULT_PORT,
  PORT_RANGE_END
};
