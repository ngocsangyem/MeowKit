/**
 * Process manager — handles PID files and server lifecycle.
 * PID files are written to PLUGIN_DATA/markdown-reader/ (stable across upgrades).
 * Falls back to ~/.cache/mewkit/markdown-reader/ when PLUGIN_DATA is unset.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Stable data directory per skill-authoring-rules Rule 2.
// Skill directories can be wiped on plugin upgrade; PLUGIN_DATA persists.
const DATA_DIR = process.env.PLUGIN_DATA
  ? path.join(process.env.PLUGIN_DATA, 'markdown-reader')
  : path.join(os.homedir(), '.cache', 'mewkit', 'markdown-reader');

const PID_PREFIX = 'mk-markdown-reader-';

/**
 * Get PID file path for a given port.
 * @param {number} port - Server port
 * @returns {string}
 */
function getPidFilePath(port) {
  return path.join(DATA_DIR, `${PID_PREFIX}${port}.pid`);
}

/**
 * Write PID file for a running server. Creates DATA_DIR if absent.
 * @param {number} port - Server port
 * @param {number} pid  - Process ID
 */
function writePidFile(port, pid) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const pidPath = getPidFilePath(port);
  fs.writeFileSync(pidPath, String(pid));
}

/**
 * Read PID from file.
 * @param {number} port - Server port
 * @returns {number|null}
 */
function readPidFile(port) {
  const pidPath = getPidFilePath(port);
  if (fs.existsSync(pidPath)) {
    const pid = fs.readFileSync(pidPath, 'utf8').trim();
    return parseInt(pid, 10);
  }
  return null;
}

/**
 * Remove PID file.
 * @param {number} port - Server port
 */
function removePidFile(port) {
  const pidPath = getPidFilePath(port);
  if (fs.existsSync(pidPath)) {
    fs.unlinkSync(pidPath);
  }
}

/**
 * Find all running server instances by scanning DATA_DIR for PID files.
 * @returns {Array<{port: number, pid: number}>}
 */
function findRunningInstances() {
  const instances = [];
  if (!fs.existsSync(DATA_DIR)) return instances;

  const files = fs.readdirSync(DATA_DIR);
  for (const file of files) {
    if (file.startsWith(PID_PREFIX) && file.endsWith('.pid')) {
      const port = parseInt(file.replace(PID_PREFIX, '').replace('.pid', ''), 10);
      const pid = readPidFile(port);
      if (pid) {
        try {
          process.kill(pid, 0); // probe — does not send a signal
          instances.push({ port, pid });
        } catch {
          // Process gone — clean up stale PID file
          removePidFile(port);
        }
      }
    }
  }
  return instances;
}

/**
 * Stop server by port.
 * @param {number} port - Server port
 * @returns {boolean}
 */
function stopServer(port) {
  const pid = readPidFile(port);
  if (!pid) return false;
  try {
    process.kill(pid, 'SIGTERM');
    removePidFile(port);
    return true;
  } catch {
    removePidFile(port);
    return false;
  }
}

/**
 * Stop all running servers.
 * @returns {number} - Count of servers stopped
 */
function stopAllServers() {
  const instances = findRunningInstances();
  let stopped = 0;
  for (const { port, pid } of instances) {
    try {
      process.kill(pid, 'SIGTERM');
      removePidFile(port);
      stopped++;
    } catch {
      removePidFile(port);
    }
  }
  return stopped;
}

/**
 * Register SIGTERM/SIGINT handlers for graceful shutdown.
 * @param {number}   port    - Server port
 * @param {Function} cleanup - Additional cleanup (e.g. server.close())
 */
function setupShutdownHandlers(port, cleanup) {
  const handler = () => {
    if (cleanup) cleanup();
    removePidFile(port);
    process.exit(0);
  };
  process.on('SIGTERM', handler);
  process.on('SIGINT', handler);
}

module.exports = {
  getPidFilePath,
  writePidFile,
  readPidFile,
  removePidFile,
  findRunningInstances,
  stopServer,
  stopAllServers,
  setupShutdownHandlers,
  PID_PREFIX,
  DATA_DIR,
};
