'use strict';
// read-config.cjs — the hook side of the project config.
//
// Deliberately NOT reachable from `gate-enforcement.cjs`, `privacy-block.cjs` or
// `pre-ship.cjs`. A committed file is editable by anyone who can open a pull
// request, so the property worth having is that those three cannot read it at
// all — stronger than validating what they read, and asserted structurally by
// the environment-allowlist test rather than left to review.
//
// Observers are the audience. They are fail-open by contract, and that extends
// to configuration: an unreadable or invalid config means every observer uses
// its own default and still runs. The error is reported by `mewkit doctor`,
// which is where a human can act on it, rather than by breaking a session.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { parseYamlSubset } = require('./yaml-subset.cjs');
const { applyRules } = require('./config-rules.cjs');

const CONFIG_REL = path.join('.meowkit', 'config.yaml');

/**
 * Environment names that keep overriding their config key, at the top of the
 * precedence chain. Exactly one qualifies: losing the ability to turn strict
 * test-first mode on from the environment would disable an enforcement mode
 * without saying so, and a CI job that exports it must keep working.
 * The classification table at the repository root is the source of this set; a
 * drift test asserts the two still agree.
 */
const ENV_OVERRIDES = { tdd: 'MEOWKIT_TDD' };

const TRUTHY = new Set(['1', 'true', 'yes', 'on', 'enable', 'enabled']);
const FALSY = new Set(['0', 'false', 'no', 'off', 'disable', 'disabled']);

/** Interpret an override's raw string, or `undefined` when it says nothing. */
function envBoolean(raw) {
  if (raw === undefined || raw === '') return undefined;
  const text = String(raw).trim().toLowerCase();
  if (TRUTHY.has(text)) return true;
  if (FALSY.has(text)) return false;
  return undefined;
}

/** `{ ok, values }` or `{ ok: false, error }` for one config file; absent is empty. */
function loadScope(file, scope, root) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    return { ok: true, values: {}, present: false };
  }
  const parsed = parseYamlSubset(source);
  if (!parsed.ok) return { ok: false, error: { ...parsed.error, file, scope }, present: true };
  const checked = applyRules(parsed.values, { root, scope });
  if (!checked.ok) return { ok: false, error: { ...checked.error, file, scope }, present: true };
  return { ok: true, values: checked.values, present: true };
}

const projectConfigPath = (root) => path.join(root, CONFIG_REL);
const userConfigPath = (home) => path.join(home, CONFIG_REL);

/**
 * Merge the levels into one answer per key and record which level answered.
 * Order, highest first: supported environment override, project config, user
 * config, default. A CLI flag sits between the override and the project file and
 * is supplied by the CLI, which is the only side that has one.
 */
function resolveConfig({ root = process.env.CLAUDE_PROJECT_DIR || process.cwd(), env = process.env, home = os.homedir(), flags = {} } = {}) {
  const errors = [];
  const values = {};
  const levels = {};

  /** Apply one level's keys over whatever a lower level already answered. */
  const assign = (source, level) => {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      values[key] = value;
      levels[key] = level;
    }
  };

  const user = loadScope(userConfigPath(home), 'user config', root);
  if (!user.ok) errors.push(user.error);
  else assign(user.values, 'user');

  const project = loadScope(projectConfigPath(root), 'project config', root);
  if (!project.ok) errors.push(project.error);
  else assign(project.values, 'project');

  assign(flags, 'flag');

  for (const [key, name] of Object.entries(ENV_OVERRIDES)) {
    const override = envBoolean(env[name]);
    if (override === undefined) continue;
    values[key] = override;
    levels[key] = 'env';
  }

  return { values, levels, errors };
}

/** One key's resolved value and the level that answered, or the given default. */
function configValue(key, fallback, options = {}) {
  const { values, levels } = resolveConfig(options);
  if (!Object.hasOwn(values, key)) return { value: fallback, level: 'default' };
  return { value: values[key], level: levels[key] };
}

/**
 * Whether one observer may run. Enabled is the default in every uncertain case:
 * no config, an invalid config, an unreadable registry. A watcher that switched
 * itself off on a parse error would be the least visible failure available.
 */
function isObserverEnabled(name, options = {}) {
  try {
    return configValue(`hooks.${name}`, true, options).value !== false;
  } catch {
    return true;
  }
}

module.exports = {
  CONFIG_REL,
  ENV_OVERRIDES,
  envBoolean,
  loadScope,
  projectConfigPath,
  userConfigPath,
  resolveConfig,
  configValue,
  isObserverEnabled,
};
