/**
 * OrchViz — Port Finder
 *
 * Probes ports 3600-3650 to find an available one.
 * Same pattern as plans-kanban's port-finder.
 */

import * as net from 'node:net';
import { DEFAULT_PORT, MAX_PORT } from '../../src/constants.js';

/** Find an available port in the 3600-3650 range. */
export async function findAvailablePort(startPort = DEFAULT_PORT): Promise<number> {
  for (let port = startPort; port <= MAX_PORT; port++) {
    const available = await probePort(port);
    if (available) return port;
  }
  throw new Error(`No available port in range ${startPort}-${MAX_PORT}`);
}

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}
