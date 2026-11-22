'use strict';
// always-on-rules.cjs — the check behind the per-session "verified" marker.
//
// The marker lets later turns skip re-reading the safety baseline and the
// phase-zero routing files. It is only worth trusting when something checked
// that the files it vouches for are there and are the text that was loaded, so
// the writer and the reader both call `digestFiles` and compare.
//
// A digest is the SHA-256 of one line per file, `<relative path>\0<sha256 of
// its bytes>\n`, in list order. `mewkit doctor` recomputes the rule digest the
// same way from disk, so the format is a contract: change it on both sides.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/** The rules a session auto-loads, in load order. Same list as the CLI's. */
const ALWAYS_ON_RULES = [
  '.claude/rules/meowkit-core.md',
  '.claude/rules/security-rules.md',
  '.claude/rules/injection-rules.md',
  '.claude/rules/core-behaviors.md',
  '.claude/rules/development-rules.md',
  '.claude/rules/agent-conduct.md',
];

/**
 * The files the router reads once per session before routing. The intent
 * dispatch table is advisory and its absence never aborts a route, so it is
 * not part of what the marker vouches for.
 */
const PHASE_ZERO_FILES = [
  '.claude/skills/cook/references/phase-contracts.md',
  '.claude/skills/agent-detector/references/agent-routing.md',
  '.claude/skills/agent-detector/references/model-selection-rules.md',
  '.claude/skills/agent-detector/references/scale-adaptive-rules.md',
  '.claude/skills/agent-detector/references/risk-checklist.md',
  '.claude/skills/agent-detector/references/context-budget-rules.md',
];

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

/**
 * `{ ok: true, digest }` when every file is a non-empty regular file, else
 * `{ ok: false, missing, empty }`. A file that cannot be read counts as missing:
 * either way its text cannot be what the session has in context.
 */
function digestFiles(root, rels) {
  const missing = [];
  const empty = [];
  let lines = '';
  for (const rel of rels) {
    let bytes;
    try {
      bytes = fs.readFileSync(path.join(root, rel));
    } catch {
      missing.push(rel);
      continue;
    }
    if (bytes.length === 0 || bytes.toString('utf8').trim() === '') {
      empty.push(rel);
      continue;
    }
    lines += `${rel}\0${sha256(bytes)}\n`;
  }
  if (missing.length || empty.length) return { ok: false, missing, empty };
  return { ok: true, digest: sha256(lines) };
}

/** Both digests the marker records; a failed check yields `null` for that one. */
function markerDigests(root) {
  const rules = digestFiles(root, ALWAYS_ON_RULES);
  const phaseZero = digestFiles(root, PHASE_ZERO_FILES);
  return {
    rules: rules.ok ? rules.digest : null,
    phaseZero: phaseZero.ok ? phaseZero.digest : null,
  };
}

module.exports = { ALWAYS_ON_RULES, PHASE_ZERO_FILES, digestFiles, markerDigests };
