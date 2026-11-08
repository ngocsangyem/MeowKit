'use strict';
// tdd-detect.cjs — the single answer to "is strict test-first mode on?".
//
// Enforcement is opt-in. Precedence is load-bearing and must not be reordered:
// an explicit export outranks a per-session sentinel, which outranks the project
// file, which outranks the user file, which loses to the default of OFF. A
// caller that re-derives this order gets a different answer from the one the
// gate used.
//
// The environment variable stays at the top on purpose. It is one of only two
// sources that can turn strict mode ON, so dropping its read in favour of the
// config key would leave an exported `=1` falling through to default OFF and the
// failing-test-first enforcement switching itself off without a word. An
// enforcement mode may break loudly; it may not relax quietly.
//
// The deprecated profile alias is gone. Its own notice announced removal in the
// next major version, and this is it.

const fs = require('node:fs');
const path = require('node:path');

const TRUTHY = ['1', 'true', 'True', 'TRUE', 'yes', 'Yes', 'YES', 'on', 'On', 'ON', 'enable', 'Enable', 'enabled', 'Enabled'];
// An explicit off is also an answer, and it belongs at the same level as the
// explicit on. Treating it as unrecognised would let a lower level decide while
// the user believed the top one had.
const FALSY = ['0', 'false', 'False', 'FALSE', 'no', 'No', 'NO', 'off', 'Off', 'OFF', 'disable', 'Disable', 'disabled', 'Disabled'];

const SENTINEL_REL = '.claude/session-state/tdd-mode';

/** The `tdd` key from the project then the user file, or `undefined`. */
function configTier(root) {
  try {
    // eslint-disable-next-line global-require
    const { resolveConfig } = require('./read-config.cjs');
    const { values, levels } = resolveConfig({ root, env: {} });
    if (typeof values.tdd !== 'boolean') return undefined;
    return { enabled: values.tdd, source: levels.tdd };
  } catch {
    // An unreadable config is reported by `mewkit doctor`, not by changing the
    // mode: guessing either way here would be the silent relax this file exists
    // to prevent.
    return undefined;
  }
}

/** `{ enabled, source }` with source one of env, sentinel, project, user, default. */
function isTddEnabled({ root = process.cwd(), env = process.env, warn = (m) => process.stderr.write(`${m}\n`) } = {}) {
  const raw = env.MEOWKIT_TDD;
  if (raw !== undefined && raw !== '') {
    if (TRUTHY.includes(raw)) return { enabled: true, source: 'env' };
    if (FALSY.includes(raw)) return { enabled: false, source: 'env' };
    warn(`[tdd] WARN: MEOWKIT_TDD='${raw}' not recognized, ignoring (treating as OFF)`);
  }

  try {
    const first = fs.readFileSync(path.join(root, SENTINEL_REL), 'utf8').split('\n')[0].replace(/\s/g, '');
    if (first === 'on') return { enabled: true, source: 'sentinel' };
  } catch {
    // No sentinel: fall through to the config tiers.
  }

  const fromConfig = configTier(root);
  if (fromConfig) return fromConfig;

  return { enabled: false, source: 'default' };
}

module.exports = { isTddEnabled, SENTINEL_REL };
