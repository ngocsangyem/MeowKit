'use strict';
// hook-logger.cjs — append-only record of hook fires.
//
// Two separate streams exist on purpose and must not be merged: this one is
// internal fire telemetry (gitignored, read often, kept uncompressed so it stays
// greppable), while the trace log is shared history that may be committed and is
// gzipped when it rotates.
//
// Every failure here is swallowed. Telemetry that can break a hook chain is
// worse than no telemetry.

const fs = require('node:fs');
const path = require('node:path');

const MAX_BYTES = 50 * 1024 * 1024;

const logDir = (root) => path.join(root, '.claude/hooks/.logs');

/** `YYMMDD-HHMMSS` in local time, matching how rotated files have always been named. */
function rotationStamp(now) {
  const p = (n) => String(n).padStart(2, '0');
  return [
    String(now.getFullYear()).slice(2) + p(now.getMonth() + 1) + p(now.getDate()),
    p(now.getHours()) + p(now.getMinutes()) + p(now.getSeconds()),
  ].join('-');
}

function rotate(file, dir, now) {
  try {
    if (fs.statSync(file).size <= MAX_BYTES) return;
    fs.renameSync(file, path.join(dir, `hook-log.${rotationStamp(now)}.jsonl`));
    fs.writeFileSync(file, '');
  } catch {
    // A failed rotation must not stop the next append.
  }
}

/** Record one fire. `detail` is embedded as raw JSON, or null when absent. */
function logHookEvent({ root = process.cwd(), hook = 'unknown', event = 'fired', detail = null, sessionId = 'unknown', now = new Date() } = {}) {
  const dir = logDir(root);
  const file = path.join(dir, 'hook-log.jsonl');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const ts = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const line = `{"ts":"${ts}","hook":"${hook}","event":"${event}","session":"${sessionId || 'unknown'}","detail":${detail === null ? 'null' : detail}}\n`;
    fs.appendFileSync(file, line);
  } catch {
    return;
  }
  rotate(file, dir, now);
}

module.exports = { logHookEvent, MAX_BYTES };
