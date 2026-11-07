'use strict';
// post-session.cjs — record cost and trace data when a session ends.
//
// The model identity is resolved from the session-start artifact, not the
// environment: the host does not export a model identifier to this event, so
// reading the environment first would record an empty field every time.
//
// Two writes here are racy by nature, because two sessions can end at once.
// Both are made atomically — write a temporary file, then rename — so a reader
// never observes a half-written value.

const fs = require('node:fs');
const path = require('node:path');

const { scrubSecrets } = require('../lib/secret-scrub.cjs');
const { sessionStateDir, telemetryDir } = require('../lib/meowkit-paths.cjs');
const { resolveModel, UNKNOWN } = require('../lib/resolve-model.cjs');
const { appendTrace } = require('../lib/trace-log.cjs');

const MAX_COST_ENTRIES = 1000;

/** Local-time `YYYY-MM-DD HH:MM`, the form the cost history has always used. */
function costTimestamp(now) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;
}

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

/** Rename over the target so a concurrent reader never sees a partial file. */
function writeAtomic(file, content) {
  const tmp = `${file}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, file);
  } catch {
    fs.rmSync(tmp, { force: true });
  }
}

/** Files touched in recent commits — a cheap proxy for how much work happened. */
function recentFileCount(root) {
  const r = require('node:child_process').spawnSync('git', ['log', '--oneline', '-5', '--name-only'], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) return 0;
  const names = (r.stdout || '').split('\n').filter((l) => l && !/^[a-f0-9]/.test(l));
  return new Set(names).size;
}

/**
 * Append one cost entry. The budget snapshot is scrubbed first: it is written by
 * another handler from tool payloads and can carry a token shaped like a secret
 * into a history that may be committed.
 */
function appendCostEntry({ root, telemetry, timestamp, sessionId, model }) {
  const budgetFile = path.join(root, 'session-state/budget-state.json');
  const costLog = path.join(telemetry, 'cost-log.json');
  if (!fs.existsSync(costLog)) writeAtomic(costLog, '[]');
  if (!fs.existsSync(budgetFile)) return;

  // Scrub the raw text before parsing, the same order the snapshot is read in
  // elsewhere, so a redaction can never be undone by a re-serialisation.
  let snapshot;
  try {
    snapshot = JSON.parse(scrubSecrets(fs.readFileSync(budgetFile, 'utf8')));
  } catch {
    return;
  }
  if (snapshot === null || typeof snapshot !== 'object') return;

  const logs = readJson(costLog, []);
  if (!Array.isArray(logs)) return;
  logs.push({
    date: timestamp,
    session_id: sessionId,
    model,
    cost_usd: snapshot.estimated_cost_usd || 0,
    tokens_in: snapshot.estimated_input_tokens || 0,
    tokens_out: snapshot.estimated_output_tokens || 0,
    cache_write_tokens: snapshot.cache_write_tokens || 0,
    cache_read_tokens: snapshot.cache_read_tokens || 0,
  });
  writeAtomic(costLog, JSON.stringify(logs.slice(-MAX_COST_ENTRIES), null, 2));
}

/**
 * A model change means the prompt set was tuned for a different model, which is
 * worth auditing. The comparison is skipped when either side is unknown, so a
 * detection failure never looks like a model change.
 */
function checkModelChange({ root, stateDir, model }) {
  const file = path.join(stateDir, 'last-model-id.txt');
  const previous = (() => {
    try { return fs.readFileSync(file, 'utf8').replace(/\s/g, ''); } catch { return null; }
  })();

  // A detection failure never overwrites what is already recorded.
  if (previous !== null && model === UNKNOWN) return null;

  // A legacy install recorded `unknown` from when this ran off the environment;
  // it is overwritten below without being mistaken for a prior model.
  let notice = null;
  if (previous !== null && previous !== UNKNOWN && model !== previous) {
    appendTrace({ root, event: 'dead_weight_audit_needed', payload: JSON.stringify({ old_model: previous, new_model: model }) });
    notice = `Dead-weight audit flagged: model changed ${previous} → ${model}\n`;
  }
  writeAtomic(file, `${model}\n`);
  return notice;
}

/** Host session identifiers are UUID-shaped; anything else could break the record. */
const SAFE_SESSION_ID = /^[A-Za-z0-9_.-]+$/;

/**
 * Mark that this session completed its safety and orientation steps, so later
 * turns can skip re-reading them. One append-only log keyed by session id, not a
 * file per session; the session-start handler truncates it on a new session so
 * it never accumulates.
 */
function writeSentinel(root, sessionId, now) {
  if (process.env.MEOWKIT_SKIP_SAFETY_SENTINEL === 'off') return;
  if (!sessionId || !SAFE_SESSION_ID.test(sessionId)) return;
  try {
    const dir = path.join(root, 'session-state');
    fs.mkdirSync(dir, { recursive: true });
    const ts = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    fs.appendFileSync(
      path.join(dir, 'session-sentinels.jsonl'),
      `{"session_id":"${sessionId}","safety":true,"phase_zero":true,"ts":"${ts}"}\n`,
    );
  } catch {
    // A lost marker costs a re-read next turn.
  }
}

module.exports = function postSession(ctx, _state, now = new Date()) {
  const root = ctx.root;
  const profile = process.env.MEOWKIT_HOOK_PROFILE || process.env.MEOW_HOOK_PROFILE || 'standard';
  if (profile === 'fast') return null;

  const telemetry = telemetryDir(root);
  const stateDir = sessionStateDir(root);
  for (const dir of [telemetry, stateDir]) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch { return null; }
  }

  let sessionId = ctx.session_id || '';
  if (!sessionId) {
    try { sessionId = fs.readFileSync(path.join(root, 'session-state/last-session-id'), 'utf8').trim(); } catch { sessionId = ''; }
  }
  const model = resolveModel({ root, warn: () => {} });

  appendCostEntry({ root, telemetry, timestamp: costTimestamp(now), sessionId, model });
  const notice = checkModelChange({ root, stateDir, model });
  appendTrace({ root, event: 'session_end', payload: JSON.stringify({ recent_files: recentFileCount(root) }) });
  writeSentinel(root, sessionId, now);

  return { stdout: `Session cost + trace recorded to ${telemetry}\n`, stderr: notice || '' };
};
