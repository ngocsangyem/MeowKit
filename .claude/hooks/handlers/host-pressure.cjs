'use strict';
// host-pressure.cjs — UserPromptSubmit and PostToolUse(Bash): keep the machine-wide watcher
// alive and tell the agent, in one line, when the host or this worktree is under pressure.
//
// Reads `~/.meowkit/host/status.json` and this worktree's inbox (both written by
// `mewkit host watch`). When the snapshot is missing or stale, starts the installed `mewkit`
// (never a binary inside a git checkout) once, guarded by a spawn marker, and never waits.
// Speaks only at verdict throttle or worse, or while this worktree has queued or running
// jobs; once per session per 5 minutes unless the verdict gets worse. Never blocks.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { configValue } = require('../lib/read-config.cjs');
const { sessionStateDir } = require('../lib/meowkit-paths.cjs');
const core = require('../lib/core/host-pressure.cjs');

const DEDUPE_MS = 5 * 60 * 1000;
const MARKER_TTL_MS = 60000;
const STATE_FILE = 'host-pressure.json';

function markerFresh(file, now) {
  try { const at = Number(fs.readFileSync(file, 'utf8').trim()); return now - at >= 0 && now - at < MARKER_TTL_MS; } catch { return false; }
}

/** The first `mewkit` on PATH that is not inside a git checkout, or null. */
function installedMewkit() {
  const names = process.platform === 'win32' ? ['mewkit.exe', 'mewkit.cmd'] : ['mewkit'];
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        const real = fs.realpathSync(file);
        if (fs.statSync(real).isFile() && !core.worktreeOf(path.dirname(real))) return file;
      } catch { /* not here */ }
    }
  }
  return null;
}

function startWatcher(hostDir, now) {
  if (markerFresh(path.join(hostDir, 'no-autostart'), now)) return;
  const marker = path.join(hostDir, 'watch.spawn');
  if (markerFresh(marker, now)) return;
  const bin = installedMewkit();
  if (!bin) return;
  try {
    fs.mkdirSync(hostDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(marker, String(now), { mode: 0o600 });
    spawn(bin, ['host', 'watch', '--detach'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch { /* fail open */ }
}

/**
 * True when this line should be shown now, recording it if so. One record per session, so
 * two sessions in the same worktree keep separate dedupe windows; old records are dropped.
 */
function dueAndRecord(root, sessionId, level, now) {
  const file = path.join(sessionStateDir(root), STATE_FILE);
  let sessions = {};
  try { sessions = JSON.parse(fs.readFileSync(file, 'utf8')).sessions || {}; } catch { /* first time */ }
  const last = sessions[sessionId];
  if (last && now - last.at < DEDUPE_MS && level <= last.level) return false;
  const kept = Object.fromEntries(Object.entries(sessions).filter(([, r]) => r && now - r.at < 12 * DEDUPE_MS));
  kept[sessionId] = { at: now, level };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ sessions: kept }));
  } catch { /* fail open: show it */ }
  return true;
}

module.exports = function hostPressure(ctx, _state, { home = os.homedir(), now = Date.now() } = {}) {
  try {
    if (configValue('host.enabled', true, { root: ctx.root }).value === false) return null;
    const hostDir = path.join(home, '.meowkit', 'host');
    const status = core.readStatus(hostDir, now);
    if (!status || status.ageMs > core.STALE_MS) {
      startWatcher(hostDir, now);
      return null;
    }
    const toplevel = core.worktreeOf(ctx.cwd || ctx.root);
    const inbox = toplevel ? core.readInbox(hostDir, toplevel) : null;
    const line = core.buildLine(status, inbox);
    if (!line || !dueAndRecord(ctx.root, ctx.session_id || '', core.rank(status.verdict), now)) return null;
    return { context: line };
  } catch {
    return null;
  }
};
