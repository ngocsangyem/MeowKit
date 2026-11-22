'use strict';
// config-keys.cjs — what the project config may contain, for the hook-side reader.
//
// The CLI holds the same surface as a zod schema and publishes it as JSON Schema.
// A hook cannot load either (no npm on a hook path, and the published schema is
// not part of an installed project), so the surface is spelled out once more here
// and a drift test asserts the two agree. Declaring it twice is the cost of the
// zero-dependency guarantee; a test that fails on a one-sided change is what
// makes that cost safe.
//
// Observer names are NOT listed: they are read from the registry, so adding an
// observer gives it a toggle automatically and the key can never name a handler
// that does not exist.

/**
 * Hooks that may never be switched off, each with why, for the rejection
 * message: the credential guard, the ship check, and the hard-blocking guards.
 */
const PROTECTED_REASON = {
  'privacy-block': 'it blocks reads of credential files',
  'pre-ship': 'it runs lint, related tests and type-check before a commit, push or merge',
  'check-careful': 'it is a hard-blocking guard',
  'check-freeze': 'it is a hard-blocking guard',
  'check-report-path': 'it is a hard-blocking guard',
};

/** The same names as a list, derived so the two cannot fall out of step. */
const PROTECTED_HOOKS = Object.keys(PROTECTED_REASON);

/**
 * Settings that live in session state and may never become config keys, with
 * the reason each one stays out. A committed key here would let a pull request
 * suppress a review step for everyone, which is a different thing from a user
 * opting out on their own machine — so the refusal names the state command
 * rather than reporting an unknown key.
 */
const STATE_ONLY_KEYS = {
  skip_eng_review: 'it suppresses the review step before shipping, so it is a per-project choice rather than a committed one',
};

/** Key prefixes that are rejected outright rather than being unknown keys. */
const FORBIDDEN_NAMESPACES = {
  gates: 'There are no configurable gates; the ship check is not a preference',
  paths: 'a configurable workflow path would move writes out of the paths the guards key off',
};

/** Scalar keys with a fixed name. `enum` constrains a string key. */
const SCALAR_KEYS = {
  tdd: { type: 'boolean' },
  'autobuild.mode': { type: 'string', enum: ['MINIMAL', 'FULL', 'LEAN'] },
  'budget.cap': { type: 'integer' },
  'budget.warn': { type: 'integer' },
  'budget.block': { type: 'integer' },
  'buildVerify.timeoutMs': { type: 'integer' },
  'projectContext.maxBytes': { type: 'integer' },
  'workflow.telemetry': { type: 'string', enum: ['off', 'community', 'anonymous'] },
  'workflow.proactive': { type: 'boolean' },
};

/**
 * Observer toggle names, kebab-case, taken from the registry. The registry is
 * required here rather than at module load because the registry reader asks this
 * module for the toggle rules, and a top-level require either way would leave
 * one of the two holding a half-initialised copy of the other.
 */
function observerNames(root) {
  // eslint-disable-next-line global-require
  const { loadRegistry } = require('./handler-registry.cjs');
  const names = new Set();
  try {
    for (const entry of loadRegistry(root)) names.add(entry.toggleKey);
  } catch {
    // No registry means nothing is registered, so no `hooks.<name>` key can be
    // legal. An empty list says exactly that; throwing would turn a project
    // mid-install into a crash in every observer that reads a setting.
    return [];
  }
  return [...names].sort();
}

/** Every legal key for one project, scalar keys plus one toggle per observer. */
function knownKeys(root) {
  const keys = { ...SCALAR_KEYS };
  for (const name of observerNames(root)) keys[`hooks.${name}`] = { type: 'boolean' };
  return keys;
}

module.exports = {
  PROTECTED_HOOKS,
  STATE_ONLY_KEYS,
  PROTECTED_REASON,
  FORBIDDEN_NAMESPACES,
  SCALAR_KEYS,
  observerNames,
  knownKeys,
};
