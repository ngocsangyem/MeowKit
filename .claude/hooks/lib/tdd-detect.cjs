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

const { LEGACY_STATE_RELS, sessionStateDir, sessionStateFile } = require('./meowkit-paths.cjs');

const SENTINEL_BASENAME = 'tdd-mode';

/** Where the sentinel is written. One location, so two writers cannot disagree. */
const sentinelWritePath = (root) => path.join(sessionStateDir(root), SENTINEL_BASENAME);

/**
 * Every location a sentinel may be found, canonical first. Turning the mode OFF
 * has to reach all of them: a pre-move file left behind would keep enforcement
 * on after the user switched it off, which is the silent-relax failure this
 * detector exists to prevent.
 */
const sentinelPaths = (root) => [
  sentinelWritePath(root),
  ...LEGACY_STATE_RELS.map((rel) => path.join(root, rel, SENTINEL_BASENAME)),
];

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
    const first = fs.readFileSync(sessionStateFile(SENTINEL_BASENAME, root), 'utf8').split('\n')[0].replace(/\s/g, '');
    if (first === 'on') return { enabled: true, source: 'sentinel' };
  } catch {
    // No sentinel: fall through to the config tiers.
  }

  const fromConfig = configTier(root);
  if (fromConfig) return fromConfig;

  return { enabled: false, source: 'default' };
}

module.exports = { isTddEnabled, sentinelPaths, sentinelWritePath };
