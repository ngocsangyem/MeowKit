/**
 * OrchViz — Process Manager
 *
 * PID file management for background server mode.
 * Enables --stop to kill running instances.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { log } from '../../src/logger.js';

const PID_DIR = path.join(os.tmpdir());
const PID_PREFIX = 'orchviz-';

function pidFilePath(port: number): string {
  return path.join(PID_DIR, `${PID_PREFIX}${port}.pid`);
}

/** Write PID file for the current process. */
export function writePidFile(port: number): void {
  const filePath = pidFilePath(port);
  fs.writeFileSync(filePath, String(process.pid), 'utf-8');
  log.info(`PID file: ${filePath} (pid=${process.pid})`);
}

/** Remove PID file on shutdown. */
export function removePidFile(port: number): void {
  const filePath = pidFilePath(port);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Already removed
  }
}

/** Stop all running OrchViz servers by reading PID files. Returns count stopped. */
export function stopAllServers(): number {
  let stopped = 0;
  try {
    const files = fs.readdirSync(PID_DIR).filter((f) => f.startsWith(PID_PREFIX) && f.endsWith('.pid'));
    for (const file of files) {
      const filePath = path.join(PID_DIR, file);
      try {
        const pid = parseInt(fs.readFileSync(filePath, 'utf-8').trim(), 10);
        if (pid && isProcessAlive(pid)) {
          process.kill(pid, 'SIGTERM');
          log.info(`Stopped OrchViz server (pid=${pid})`);
          stopped++;
        }
        fs.unlinkSync(filePath);
      } catch {
        // PID file stale or process already dead
        try { fs.unlinkSync(filePath); } catch { /* noop */ }
      }
    }
  } catch {
    // tmpdir read failed
  }
  return stopped;
}

/** Check if a process is alive. */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = check existence
    return true;
  } catch {
    return false;
  }
}

/** Register shutdown handlers to clean up PID file. */
export function setupShutdownHandlers(port: number, onShutdown?: () => void): void {
  const cleanup = () => {
    removePidFile(port);
    onShutdown?.();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => removePidFile(port));
}
