'use strict';
// resolve-model.cjs — which model is this session running?
//
// The host does not export a model identifier to end-of-session hooks, so the
// environment is the LAST place to look, not the first. The canonical source is
// the detection artifact written at session start; the environment chain is only
// a fallback for a session where that write never happened.
//
// The value is sanitised before it is returned. The artifact is writable by any
// process with filesystem access, and the value flows into log records and
// text substitution downstream, so a crafted identifier must not survive.

const fs = require('node:fs');

const { sessionStateFile } = require('./meowkit-paths.cjs');

const ARTIFACT_BASENAME = 'detected-model.json';
const UNKNOWN = 'unknown';

const sanitize = (value) => String(value || '').replace(/[^a-zA-Z0-9._-]/g, '');

function fromArtifact(root) {
  const file = sessionStateFile(ARTIFACT_BASENAME, root);
  let content;
  try { content = fs.readFileSync(file, 'utf8'); } catch { return ''; }
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.model_id === 'string') return parsed.model_id;
  } catch {
    // Fall back to a textual read: a partially written artifact still names a model.
    const m = content.match(/"model_id"\s*:\s*"([^"]*)"/);
    if (m) return m[1];
  }
  return '';
}

/**
 * The active model identifier, or `unknown`. When the artifact itself records
 * `unknown`, the detection step failed — say so on stderr instead of letting
 * that value flow silently into every record written afterwards.
 */
function resolveModel({ root = process.cwd(), env = process.env, warn = (m) => process.stderr.write(`${m}\n`) } = {}) {
  let model = sanitize(fromArtifact(root));

  if (model === UNKNOWN) {
    warn("resolve-model: detected-model.json contains 'unknown' — model detection at session start failed to identify the model.");
    model = '';
  }
  if (!model) {
    model = sanitize(env.MEOWKIT_MODEL_HINT || env.CLAUDE_MODEL || env.ANTHROPIC_MODEL || UNKNOWN);
  }
  return model || UNKNOWN;
}

module.exports = { resolveModel, UNKNOWN };
