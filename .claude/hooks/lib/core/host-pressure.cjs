'use strict';
// host-pressure.cjs (core) — read the machine-wide host snapshot and this worktree's inbox,
// written by `mewkit host watch`, and build at most one short line for the agent.
//
// Everything read here is DATA from files another process wrote. The line is built only from
// enum values (verdict, reason codes, action), integers, and executable basenames that pass a
// strict pattern; anything else is dropped, and a file that fails its schema yields no line.
// No command line of any process ever reaches the output.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const VERDICTS = ['go', 'throttle', 'unknown', 'clean', 'hold'];
const ACTIONS = {
  wait_queue: 'A heavy job from this worktree is queued: do other work meanwhile and check it with `mewkit host jobs list`; do not re-run it.',
  narrow_check: 'Prefer a narrower related check to a full build or suite for now.',
  defer_heavy: 'Defer heavy builds and tests, or run them through `mewkit host run -- <cmd>`.',
  free_space: 'Free space is low: `mewkit host status --caches` lists target/ dirs to propose cleaning to the user.',
};
const DEFAULT_ACTION = { hold: 'defer_heavy', throttle: 'narrow_check', clean: 'free_space' };
const BASENAME = /^[A-Za-z0-9._-]{1,32}$/;
const CODE = /^[a-z_]{1,32}$/;
/** A snapshot older than this is stale: the watcher is not running. */
const STALE_MS = 30000;

const rank = (verdict) => VERDICTS.indexOf(verdict);
const isInt = (n) => Number.isInteger(n) && n >= 0;

/** Same spelling as the Rust side (`host::worktree::normalize`); shared fixture keeps them equal. */
function normalize(p) {
  const unified = String(p).replace(/\\/g, '/');
  let prefix = '';
  let rest = unified;
  if (/^[A-Za-z]:/.test(unified)) {
    prefix = `${unified[0].toLowerCase()}:`;
    rest = unified.slice(2);
  }
  const absolute = rest.startsWith('/');
  const parts = [];
  for (const seg of rest.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  const joined = parts.join('/');
  if (absolute) return joined ? `${prefix}/${joined}` : `${prefix}/`;
  return `${prefix}${joined}`;
}

const inboxKey = (toplevel) => crypto.createHash('sha256').update(normalize(toplevel)).digest('hex').slice(0, 16);

/** The worktree root above `dir` (a `.git` dir or file), real path, or null. */
function worktreeOf(dir) {
  let cur = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(cur, '.git'))) {
      try { return fs.realpathSync(cur); } catch { return cur; }
    }
    const up = path.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** The snapshot's report when valid, with its age; null otherwise. */
function readStatus(hostDir, now) {
  const env = readJson(path.join(hostDir, 'status.json'));
  if (!env || env.schema_version !== 1 || env.kind !== 'host.status' || !env.data) return null;
  const { verdict, reasons } = env.data;
  if (rank(verdict) < 0) return null;
  const takenMs = env.counters && Number.isFinite(env.counters.taken_ms) ? env.counters.taken_ms : null;
  const codes = Array.isArray(reasons) ? reasons.map((r) => r && r.code).filter((c) => typeof c === 'string' && CODE.test(c)) : [];
  return { verdict, codes: [...new Set(codes)].slice(0, 6), ageMs: takenMs === null ? Infinity : now - takenMs };
}

/** This worktree's inbox entry when valid; null otherwise. */
function readInbox(hostDir, toplevel, now = Date.now()) {
  const e = readJson(path.join(hostDir, 'inbox', `${inboxKey(toplevel)}.json`));
  if (!e || e.schema_version !== 1 || rank(e.verdict) < 0) return null;
  // The watcher rewrites a loaded worktree's entry every tick and stops once the worktree
  // is quiet, so an old entry describes jobs that have since ended.
  if (!isInt(e.written_at_ms) || now - e.written_at_ms > STALE_MS) return null;
  if (!Array.isArray(e.heavy) || !Array.isArray(e.queued) || !isInt(e.held_slots)) return null;
  if (e.action !== null && !Object.hasOwn(ACTIONS, e.action)) return null;
  const heavy = e.heavy
    .filter((h) => h && isInt(h.pid) && Number.isFinite(h.io_mb_s))
    .slice(0, 4)
    .map((h) => ({ pid: h.pid, exe: typeof h.exe === 'string' && BASENAME.test(h.exe) ? h.exe : '?', mbs: Math.round(h.io_mb_s) }));
  return { heavy, queued: e.queued.filter(isInt).slice(0, 8), held: e.held_slots, action: e.action };
}

/** The one line for the agent, or '' when nothing is worth saying. */
function buildLine(status, inbox) {
  const busy = rank(status.verdict) >= rank('throttle');
  const jobs = inbox && (inbox.queued.length > 0 || inbox.held > 0);
  if (!busy && !jobs) return '';
  const parts = [`mewkit host (beta): ${status.verdict.toUpperCase()}${status.codes.length ? ` (${status.codes.join(', ')})` : ''}`];
  if (inbox && inbox.heavy.length) parts.push(`this worktree: ${inbox.heavy.map((h) => `${h.exe} pid ${h.pid} ${h.mbs} MB/s`).join(', ')}`);
  if (inbox && inbox.queued.length) parts.push(`queued at ${inbox.queued.join(', ')}`);
  if (inbox && inbox.held) parts.push(`${inbox.held} running`);
  const action = (inbox && inbox.action) || DEFAULT_ACTION[status.verdict];
  if (action) parts.push(ACTIONS[action]);
  return parts.join(' · ');
}

module.exports = { VERDICTS, ACTIONS, STALE_MS, rank, normalize, inboxKey, worktreeOf, readStatus, readInbox, buildLine };
