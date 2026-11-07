'use strict';
// tdd-detect.cjs — the single answer to "is strict test-first mode on?".
//
// Enforcement is opt-in. Precedence is load-bearing and must not be reordered:
// an explicit export outranks a per-session sentinel, which outranks the legacy
// profile alias, which loses to the default of OFF. A caller that re-derives
// this order gets a different answer from the one the gate used.

const fs = require('node:fs');
const path = require('node:path');

const TRUTHY = ['1', 'true', 'True', 'TRUE', 'yes', 'Yes', 'YES', 'on', 'On', 'ON', 'enable', 'Enable', 'enabled', 'Enabled'];

const SENTINEL_REL = '.claude/session-state/tdd-mode';
const WARNED_MARKER_REL = '.claude/session-state/tdd-deprecation-warned';

/**
 * Announce the deprecated profile alias once per session. The marker lives
 * beside the sentinel and is cleared on new-session detection, so the notice
 * reappears in the next session rather than only ever once per machine.
 */
function warnLegacyProfileOnce(root, warn) {
  const marker = path.join(root, WARNED_MARKER_REL);
  try {
    if (fs.existsSync(marker)) return;
    warn('[tdd] DEPRECATION: MEOW_PROFILE=fast will be removed in the next major version; use MEOWKIT_TDD=1 or --tdd flag instead (or unset for the new default-OFF behavior)');
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, '');
  } catch {
    // An unwritable marker means the notice repeats, which is harmless.
  }
}

/** `{ enabled, source }` with source one of env, sentinel, profile, default. */
function isTddEnabled({ root = process.cwd(), env = process.env, warn = (m) => process.stderr.write(`${m}\n`) } = {}) {
  const raw = env.MEOWKIT_TDD;
  if (raw !== undefined && raw !== '') {
    if (TRUTHY.includes(raw)) return { enabled: true, source: 'env' };
    warn(`[tdd] WARN: MEOWKIT_TDD='${raw}' not recognized, ignoring (treating as OFF)`);
  }

  try {
    const first = fs.readFileSync(path.join(root, SENTINEL_REL), 'utf8').split('\n')[0].replace(/\s/g, '');
    if (first === 'on') return { enabled: true, source: 'sentinel' };
  } catch {
    // No sentinel: fall through to the profile alias.
  }

  const profile = env.MEOWKIT_HOOK_PROFILE || env.MEOW_HOOK_PROFILE || env.MEOW_PROFILE || 'standard';
  if (profile === 'fast') {
    warnLegacyProfileOnce(root, warn);
    return { enabled: false, source: 'profile' };
  }
  return { enabled: false, source: 'default' };
}

module.exports = { isTddEnabled, SENTINEL_REL, WARNED_MARKER_REL };
