'use strict';
// trace-log.cjs — append one record to the shared trace history.
//
// This stream is shared with a writer in another language and may be committed,
// so two things matter beyond "write a line": every append and every rotation
// happens under the same sidecar lock both writers use, and the payload is
// scrubbed before it is written. A trace record that carries a secret into a
// committed file is worse than a missing record.
//
// The model and run identity are resolved from session artifacts rather than the
// environment, because the host does not export either to an end-of-session
// hook — reading the environment first would record empty fields on every run.

const fs = require('node:fs');
const path = require('node:path');

const { scrubSecrets } = require('./secret-scrub.cjs');
const { sessionStateFile, telemetryDir } = require('./meowkit-paths.cjs');
const { resolveModel, UNKNOWN } = require('./resolve-model.cjs');
const { withLock } = require('./sidecar-lock.cjs');

const MAX_BYTES = 50 * 1024 * 1024;
const SCHEMA_VERSION = '1.0';
const DEFAULT_HARNESS_VERSION = '3.0.0';

const sanitizeId = (value) => String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');

/** The harness sets the run identity; otherwise it comes from the session-start marker. */
function resolveRunId(root, env) {
  if (env.MEOWKIT_RUN_ID) return env.MEOWKIT_RUN_ID;
  try {
    return sanitizeId(fs.readFileSync(sessionStateFile('last-session-id', root), 'utf8').replace(/\s/g, ''));
  } catch {
    return '';
  }
}

/**
 * A payload that is valid JSON is embedded as-is; a non-object becomes a
 * `value` field and unparseable text becomes a `raw` field. Dropping the record
 * instead would lose the event entirely over a quoting mistake upstream.
 */
function parsePayload(payload) {
  if (!payload) return {};
  try {
    const parsed = JSON.parse(payload);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return { value: parsed };
  } catch {
    return { raw: payload };
  }
}

function rotationStamp(now) {
  const p = (n) => String(n).padStart(2, '0');
  const date = String(now.getFullYear()).slice(2) + p(now.getMonth() + 1) + p(now.getDate());
  return `${date}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

/**
 * Rotate under the lock the caller already holds, so a rename cannot interleave
 * with another writer's append. Rotated files are gzipped because this history
 * is kept, unlike the internal fire log which stays greppable.
 */
function rotate(logFile, dir, now) {
  try {
    if (fs.statSync(logFile).size <= MAX_BYTES) return;
    const rotated = path.join(dir, `trace-log.${rotationStamp(now)}.jsonl`);
    fs.renameSync(logFile, rotated);
    const gzipped = require('node:zlib').gzipSync(fs.readFileSync(rotated));
    fs.writeFileSync(`${rotated}.gz`, gzipped);
    fs.rmSync(rotated, { force: true });
    fs.writeFileSync(logFile, '');
  } catch {
    // A failed rotation must not lose the record that triggered it.
  }
}

function buildRecord({ event, payload, model, runId, env, now }) {
  return {
    schema_version: SCHEMA_VERSION,
    ts: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    event: event || 'unknown',
    run_id: runId,
    harness_version: env.MEOWKIT_HARNESS_VERSION || DEFAULT_HARNESS_VERSION,
    model,
    density: env.MEOWKIT_AUTOBUILD_MODE || '',
    data: parsePayload(payload),
  };
}

/**
 * Append one record. Returns false when the lock was unavailable, which the
 * caller treats as "dropped": blocking a hook chain on telemetry is never the
 * right trade.
 */
function appendTrace({ root = process.cwd(), event = 'unknown', payload = '', env = process.env, now = new Date() } = {}) {
  const dir = telemetryDir(root);
  const logFile = path.join(dir, 'trace-log.jsonl');
  const lockFile = path.join(dir, '.trace-log.lock');

  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    return false;
  }

  const resolved = resolveModel({ root, env, warn: () => {} });
  const record = buildRecord({
    event,
    payload: scrubSecrets(payload),
    // An unresolved model is recorded as empty rather than as the word unknown,
    // so a reader can tell "not detected" from a model actually named that.
    model: resolved === UNKNOWN ? '' : resolved,
    runId: resolveRunId(root, env),
    env,
    now,
  });

  return withLock(lockFile, () => {
    fs.appendFileSync(logFile, `${JSON.stringify(record)}\n`);
    rotate(logFile, dir, now);
  });
}

module.exports = { appendTrace, buildRecord, parsePayload, MAX_BYTES };
