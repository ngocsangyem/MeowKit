/**
 * OrchViz — Discovery File Management
 *
 * Follows the Agent Flow discovery pattern:
 * Each running instance writes ~/.claude/orchviz/{hash}-{pid}.json
 * Hook scripts read these files to locate active relay servers.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DISCOVERY_DIR = path.join(os.homedir(), '.claude', 'orchviz');

/**
 * SHA-256 first 16 chars of workspace path — stable, short, collision-resistant.
 * @param {string} workspace
 * @returns {string}
 */
function hashWorkspace(workspace) {
  return crypto.createHash('sha256').update(workspace).digest('hex').slice(0, 16);
}

/** Ensure discovery directory exists. */
function ensureDir() {
  fs.mkdirSync(DISCOVERY_DIR, { recursive: true });
}

/**
 * Write discovery file for this process.
 * @param {number} port
 * @param {string} workspace
 */
function writeDiscoveryFile(port, workspace) {
  ensureDir();
  const hash = hashWorkspace(workspace);
  const filename = `${hash}-${process.pid}.json`;
  const filePath = path.join(DISCOVERY_DIR, filename);
  const data = { port, pid: process.pid, workspace, startedAt: new Date().toISOString() };
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
}

/** Remove this process's discovery file on shutdown. */
function removeDiscoveryFile() {
  try {
    const files = fs.readdirSync(DISCOVERY_DIR);
    for (const f of files) {
      if (f.endsWith(`-${process.pid}.json`)) {
        fs.unlinkSync(path.join(DISCOVERY_DIR, f));
      }
    }
  } catch {
    // Directory gone or file already removed — no-op
  }
}

/**
 * Read all discovery files, clean up dead PIDs.
 * @returns {{ port: number, pid: number, workspace: string }[]}
 */
function findDiscoveryFiles() {
  ensureDir();
  const results = [];
  let files;
  try {
    files = fs.readdirSync(DISCOVERY_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return results;
  }

  for (const f of files) {
    const filePath = path.join(DISCOVERY_DIR, f);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!data.port || !data.pid) continue;

      // Check if the process is still alive
      try {
        process.kill(data.pid, 0); // signal 0 = existence check only
        results.push(data);
      } catch {
        // PID dead — clean up stale file
        try { fs.unlinkSync(filePath); } catch { /* noop */ }
      }
    } catch {
      // Corrupt file — skip
    }
  }

  return results;
}

module.exports = { writeDiscoveryFile, removeDiscoveryFile, findDiscoveryFiles, hashWorkspace, DISCOVERY_DIR };
