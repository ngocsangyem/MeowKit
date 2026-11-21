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

/**
 * Environment variables that may name the model, in precedence order. The hint
 * comes first because the user sets it on purpose; the host and vendor variables
 * can be stale shell exports. Session-start detection and end-of-session
 * resolution both read this one list, so they cannot disagree.
 */
const ENV_MODEL_VARS = ['MEOWKIT_MODEL_HINT', 'CLAUDE_MODEL', 'CLAUDE_MODEL_ID', 'ANTHROPIC_MODEL'];

/** Non-empty `[name, value]` pairs from ENV_MODEL_VARS, in precedence order. */
function envModelCandidates(env = process.env) {
  // Each name is read literally so the env-read scan can bind it to this file.
  const values = {
    MEOWKIT_MODEL_HINT: env.MEOWKIT_MODEL_HINT,
    CLAUDE_MODEL: env.CLAUDE_MODEL,
    CLAUDE_MODEL_ID: env.CLAUDE_MODEL_ID,
    ANTHROPIC_MODEL: env.ANTHROPIC_MODEL,
  };
  return ENV_MODEL_VARS.filter((k) => values[k]).map((k) => [k, String(values[k])]);
}

/**
 * The host of `ANTHROPIC_BASE_URL` when it points somewhere other than Anthropic,
 * else ''. Such an endpoint may serve its own model under a Claude model name, so
 * the name says nothing about the model's tier.
 */
function thirdPartyEndpoint(env = process.env) {
  const raw = env.ANTHROPIC_BASE_URL;
  if (!raw) return '';
  let host;
  try { host = new URL(raw).hostname.toLowerCase(); } catch { return 'unparseable-base-url'; }
  return host === 'anthropic.com' || host.endsWith('.anthropic.com') ? '' : host;
}

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
    const first = envModelCandidates(env)[0];
    model = sanitize(first ? first[1] : UNKNOWN);
  }
  return model || UNKNOWN;
}

module.exports = { resolveModel, envModelCandidates, thirdPartyEndpoint, ENV_MODEL_VARS, UNKNOWN };
