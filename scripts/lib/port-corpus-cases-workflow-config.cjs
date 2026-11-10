'use strict';
// port-corpus-cases-workflow-config.cjs — the recorded behavior of the config
// reader/writer the skill preambles call.
//
// Worth recording rather than reimplementing from the usage text, because the
// interesting answers are all in the seams the usage text does not describe: a
// missing key with no default prints an empty line and still exits 0; `has`
// exits 1 for a falsy value and for an absent source alike; the written JSON
// carries two-space indentation and no trailing newline. Every preamble call
// site relies on at least one of those.
//
// WHERE THE SEED MOVED, and why that keeps the recording meaningful. The
// recorded implementation read one runtime-written JSON file. The project
// config is now committed, human-owned and a CLOSED key surface — a file
// carrying `retries` or `features.costTracking` is rejected outright, so those
// values cannot be seeded there at all. They are seeded into session state
// instead, which is the highest level of the new chain and the open-keyed one.
// The cases therefore still ask the same questions of the same data and expect
// the same answers; only the file the data sits in changed, which is the one
// thing the port is supposed to change. The config levels beneath state cannot
// be expressed by these fixtures — a fixture cannot record a path its subject
// never read — so a separate unit test covers them.

const { writeFile } = require('./port-corpus-env.cjs');

/** Where a per-project choice is recorded now. */
const STATE_REL = '.meowkit/state/workflow-state.json';

/** The location the recorded implementation read, which nothing reads now. */
const LEGACY_REL = '.claude/meowkit.config.json';

const CONFIG = {
  proactive: true,
  telemetry: false,
  retries: 3,
  mode: { default: 'strict', fallback: '' },
  features: { costTracking: true, memory: false },
};

/** Seed the state file. */
function withConfig(ctx) {
  writeFile(ctx.projectDir, STATE_REL, `${JSON.stringify(CONFIG, null, 2)}\n`);
}

/** Seed nothing — the "no source at all" leg. */
function withoutConfig() {}

function configCase(name, args, setupDescription, setup, sideEffectPaths = [LEGACY_REL, STATE_REL]) {
  return {
    name,
    group: 'workflow-config',
    invocation: { kind: 'config', args },
    setupDescription,
    normalizers: ['tmpdir'],
    sideEffectPaths,
    setup,
  };
}

const CASES = [
  // --- get ---
  configCase('config-get-present-string', ['get', 'mode.default'], 'a present nested string', withConfig),
  configCase('config-get-present-true', ['get', 'proactive'], 'a present boolean, printed lowercased', withConfig),
  configCase('config-get-present-false', ['get', 'telemetry'], 'a present false, which must not read as absent', withConfig),
  configCase('config-get-present-integer', ['get', 'retries'], 'a present integer', withConfig),
  configCase('config-get-present-empty-string', ['get', 'mode.fallback'], 'a present empty string', withConfig),
  configCase('config-get-missing-with-default', ['get', 'mode.absent', 'fallback-value'], 'a missing key with a default', withConfig),
  configCase('config-get-missing-without-default', ['get', 'mode.absent'], 'a missing key with no default', withConfig),
  configCase('config-get-missing-parent', ['get', 'absent.deeply.nested'], 'a key whose parent is absent', withConfig),
  configCase('config-get-through-scalar', ['get', 'retries.inner'], 'a key that indexes into a scalar', withConfig),
  configCase('config-get-no-config-with-default', ['get', 'proactive', 'true'], 'no source, with a default', withoutConfig),
  configCase('config-get-no-config-without-default', ['get', 'proactive'], 'no source and no default', withoutConfig),

  // --- has ---
  configCase('config-has-truthy', ['has', 'features.costTracking'], 'a truthy value', withConfig),
  configCase('config-has-falsy', ['has', 'features.memory'], 'a falsy value', withConfig),
  configCase('config-has-missing', ['has', 'features.absent'], 'a missing key', withConfig),
  configCase('config-has-no-config', ['has', 'features.costTracking'], 'no source', withoutConfig),

  // --- set ---
  configCase('config-set-new-key', ['set', 'newKey', 'hello'], 'a key that did not exist', withConfig),
  configCase('config-set-nested-key', ['set', 'deep.nested.key', 'hello'], 'a key whose parents must be created', withConfig),
  configCase('config-set-overwrites', ['set', 'mode.default', 'lenient'], 'an existing value replaced', withConfig),
  configCase('config-set-boolean-coercion', ['set', 'telemetry', 'true'], 'a boolean written as a boolean, not a string', withConfig),
  configCase('config-set-integer-coercion', ['set', 'retries', '7'], 'an integer written as a number, not a string', withConfig),
  configCase('config-set-no-config', ['set', 'telemetry', 'true'], 'no state file yet — the write creates it', withoutConfig),

  // --- usage ---
  configCase('config-no-subcommand', [], 'no subcommand at all', withConfig),
  configCase('config-unknown-subcommand', ['list'], 'a subcommand that does not exist', withConfig),
];

module.exports = CASES;
