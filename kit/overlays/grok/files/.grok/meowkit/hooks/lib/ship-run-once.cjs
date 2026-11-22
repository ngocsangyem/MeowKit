'use strict';
// ship-run-once.cjs — run the ship check once per ship command and tree state.
//
// Cursor loads Claude Code hooks by default and runs every matching hook from every source, so a
// project that carries both kits reaches two ship-check hooks with one shell command. The first
// hook to arrive claims a marker keyed by the command, HEAD and the staged tree; a second hook
// with the same key waits for that result and reports it instead of running the checks again.
//
// A result is reused for REUSE_MS only, so a retry after a change, or a later retry of the same
// command, runs the checks afresh. Markers live under the git directory: never tracked, never in
// the kit's shipped directories.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REUSE_MS = 30_000;
const POLL_MS = 200;

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return r.status === 0 ? r.stdout.trim() : '';
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function readMarker(file) {
  try {
    return { ...JSON.parse(fs.readFileSync(file, 'utf8')), age: Date.now() - fs.statSync(file).mtimeMs };
  } catch {
    return null;
  }
}

/** Marker path for this command and tree state, or null outside a git repository. */
function markerPath(root, command) {
  const gitDir = git(root, ['rev-parse', '--absolute-git-dir']);
  if (!gitDir) return null;
  const state = [command.trim(), git(root, ['rev-parse', 'HEAD']), git(root, ['write-tree'])].join('\0');
  const key = crypto.createHash('sha256').update(state).digest('hex').slice(0, 32);
  return path.join(gitDir, 'meowkit', 'ship-check', `${key}.json`);
}

function reused(marker) {
  return {
    exit: marker.exit,
    stdout: ['Ship check already ran for this command and tree state; reporting that result.'],
    stderr: marker.exit === 0 ? [] : marker.stderr || [],
    // A marker written before outcomes were recorded can only say pass or block.
    outcome: marker.outcome || (marker.exit === 0 ? 'passed' : 'failed'),
    cause: marker.cause || '',
  };
}

/**
 * Run `check()` unless another hook already ran it for the same command and tree state.
 * @param {string} root
 * @param {string} command
 * @param {number} waitMs  how long to wait for a hook that is still running the check
 * @param {() => { exit: number, stdout: string[], stderr: string[] }} check
 */
function runOnce(root, command, waitMs, check) {
  const file = markerPath(root, command);
  if (!file) return check();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const until = Date.now() + waitMs;
  for (;;) {
    try {
      fs.writeFileSync(file, JSON.stringify({ status: 'running' }), { flag: 'wx' });
      break; // claimed: this hook runs the check
    } catch {
      const marker = readMarker(file);
      if (marker && marker.status === 'done' && marker.age < REUSE_MS) return reused(marker);
      const stale = !marker || marker.status === 'done' || marker.age > waitMs || Date.now() > until;
      if (stale) {
        fs.rmSync(file, { force: true });
        continue;
      }
      sleep(POLL_MS);
    }
  }

  let result;
  try {
    result = check();
  } catch (err) {
    fs.rmSync(file, { force: true });
    throw err;
  }
  fs.writeFileSync(file, JSON.stringify({ status: 'done', exit: result.exit, stderr: result.stderr, outcome: result.outcome, cause: result.cause }));
  return result;
}

module.exports = { runOnce, REUSE_MS };
