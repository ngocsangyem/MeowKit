'use strict';
// workflow-config-core.cjs — read a workflow setting by dotted key, and record a
// per-project choice without touching the committed file.
//
// WHAT CHANGED, and why it is a port rather than an edit: the reader used to
// both read and WRITE the v2 install descriptor at runtime, from eleven skill
// preambles. The project config is now committed, human-owned and
// schema-validated, and a file an agent rewrites mid-run shows up in the user's
// diff — which is also how a weakening lands in a pull request nobody reads.
// So the two halves are split:
//
//   get | has   session state -> project config -> user config -> default
//   set         `.meowkit/state/workflow-state.json`, and nothing else
//
// The answers callers actually depend on are unchanged, because every preamble
// call site relies on at least one of them:
//
//   * `get` on a missing key prints an EMPTY LINE and exits 0. Every preamble
//     calls this as `$(... || echo "true")`, so an exit code would change which
//     default they take.
//   * `has` exits 1 for a falsy value and for an absent source alike — it
//     answers "is this switched on", not "is this present".
//   * The written JSON carries two-space indentation and no trailing newline.
//
// `set` no longer refuses when there is no file to write: creating session state
// IS the write, and state is kit-owned rather than user-owned. That divergence
// is named in the parity test rather than normalized away.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { resolveConfig } = require('./read-config.cjs');

/** Where a per-project choice is recorded. Never committed. */
const STATE_REL = path.join('.meowkit', 'state', 'workflow-state.json');

/** The committed project config, and the same name in the user's home. */
const CONFIG_REL = path.join('.meowkit', 'config.yaml');

/**
 * The two keys the preambles ask for by their historical bare name, and the
 * config keys they became when the committed file gained a `workflow` section.
 * Spelled out here so the eleven call sites keep working unchanged; the test
 * asserts each target is a real config key, so an alias cannot outlive its key.
 */
const CONFIG_ALIASES = { telemetry: 'workflow.telemetry', proactive: 'workflow.proactive' };

/** The config key a caller's dotted key resolves to. */
function configKeyFor(key) {
  return Object.hasOwn(CONFIG_ALIASES, key) ? CONFIG_ALIASES[key] : key;
}

const statePath = (root = process.cwd()) => path.join(root, STATE_REL);

/** Relative to the root when it is under it, so messages stay readable. */
function displayPath(abs, root = process.cwd()) {
  const rel = path.relative(root, abs);
  return rel && !rel.startsWith('..') ? rel : abs;
}

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Walk a dotted key. Returns `undefined` for a key that is absent, for a key
 * whose parent is absent, and for a key that tries to index into a scalar — all
 * three are "no value here", and the caller's default covers all three.
 */
function lookup(config, key) {
  let node = config;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(node, part)) return undefined;
    node = node[part];
  }
  return node;
}

/** Print a value the way a shell caller can compare it: booleans lowercased. */
function render(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** A bare word from the command line, typed: `true`/`false` and digits. */
function coerce(raw) {
  const lowered = raw.toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

/** Set a dotted key, creating the intermediate objects it needs. */
function assign(config, key, value) {
  const parts = key.split('.');
  let node = config;
  for (const part of parts.slice(0, -1)) {
    if (node[part] === null || typeof node[part] !== 'object' || Array.isArray(node[part])) node[part] = {};
    node = node[part];
  }
  node[parts[parts.length - 1]] = value;
}

/**
 * Resolve one key across the levels, highest first, and say which answered.
 * A config file that fails to load contributes no value and does not throw:
 * a preamble asking whether telemetry is on must still get an answer.
 */
function resolveKey(key, { root = process.cwd(), home = os.homedir(), env = process.env } = {}) {
  // Whether ANY source exists is reported separately from the value, because
  // `get` answers the two cases differently and every preamble depends on it:
  // a configured project with an unset key prints an empty line, while a
  // project with nothing configured at all prints nothing.
  const state = readJson(statePath(root));
  const sourcePresent =
    state !== null || fs.existsSync(path.join(root, CONFIG_REL)) || fs.existsSync(path.join(home, CONFIG_REL));

  if (state !== null) {
    const fromState = lookup(state, key);
    if (fromState !== undefined) return { value: fromState, level: 'state', sourcePresent };
  }

  let resolved;
  try {
    resolved = resolveConfig({ root, home, env });
  } catch {
    return { value: undefined, level: 'default', sourcePresent };
  }
  const configKey = configKeyFor(key);
  if (Object.hasOwn(resolved.values, configKey)) {
    return { value: resolved.values[configKey], level: resolved.levels[configKey], sourcePresent };
  }
  return { value: undefined, level: 'default', sourcePresent };
}

/** Two-space indentation, no trailing newline — the shape readers already see. */
function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
}

module.exports = {
  CONFIG_ALIASES,
  STATE_REL,
  assign,
  coerce,
  configKeyFor,
  displayPath,
  lookup,
  readJson,
  render,
  resolveKey,
  statePath,
  writeState,
};
