/**
 * OrchViz — Stop Script
 *
 * Reads discovery files and sends SIGTERM to all matching OrchViz processes.
 * Usage: node scripts/stop.js
 */

'use strict';

const { findDiscoveryFiles } = require('./discovery.cjs');

const instances = findDiscoveryFiles();

if (instances.length === 0) {
  console.log(JSON.stringify({ success: true, stopped: 0, message: 'No running instances found' }));
  process.exit(0);
}

let stopped = 0;
for (const { pid, port } of instances) {
  try {
    process.kill(pid, 'SIGTERM');
    console.error(`Stopped OrchViz (pid=${pid}, port=${port})`);
    stopped++;
  } catch {
    // Already dead
  }
}

console.log(JSON.stringify({ success: true, stopped }));
