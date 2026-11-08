'use strict';
// port-corpus-cases-workflow-config.cjs — the recorded behavior of the config
// reader/writer the skill preambles call.
//
// Worth recording rather than reimplementing from the usage text, because the
// interesting answers are all in the seams the usage text does not describe: a
// missing key with no default prints an empty line and still exits 0; `has`
// exits 1 for a falsy value and for an absent file alike; `set` refuses to
// create a config file; the written JSON carries two-space indentation and no
// trailing newline. Every preamble call site relies on at least one of those.
//
// All cases seed the pre-move config location, because that is the only one the
// recorded implementation knows about. The port resolves the canonical location
// first and falls back to this one, so these fixtures exercise the fallback leg
// and a separate unit test covers the canonical leg — a fixture cannot record a
// path its subject never read.

const { writeFile } = require('./port-corpus-env.cjs');

/** The location the recorded implementation reads. */
const LEGACY_REL = '.claude/meowkit.config.json';

const CONFIG = {
  proactive: true,
  telemetry: false,
  retries: 3,
  mode: { default: 'strict', fallback: '' },
  features: { costTracking: true, memory: false },
};

/** Seed the config file. */
function withConfig(ctx) {
  writeFile(ctx.projectDir, LEGACY_REL, `${JSON.stringify(CONFIG, null, 2)}\n`);
}

/** Seed nothing — the "no config file" leg. */
function withoutConfig() {}

function configCase(name, args, setupDescription, setup, sideEffectPaths = [LEGACY_REL]) {
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
  configCase('config-get-no-config-with-default', ['get', 'proactive', 'true'], 'no config file, with a default', withoutConfig),
  configCase('config-get-no-config-without-default', ['get', 'proactive'], 'no config file and no default', withoutConfig),

  // --- has ---
  configCase('config-has-truthy', ['has', 'features.costTracking'], 'a truthy value', withConfig),
  configCase('config-has-falsy', ['has', 'features.memory'], 'a falsy value', withConfig),
  configCase('config-has-missing', ['has', 'features.absent'], 'a missing key', withConfig),
  configCase('config-has-no-config', ['has', 'features.costTracking'], 'no config file', withoutConfig),

  // --- set ---
  configCase('config-set-new-key', ['set', 'newKey', 'hello'], 'a key that did not exist', withConfig),
  configCase('config-set-nested-key', ['set', 'deep.nested.key', 'hello'], 'a key whose parents must be created', withConfig),
  configCase('config-set-overwrites', ['set', 'mode.default', 'lenient'], 'an existing value replaced', withConfig),
  configCase('config-set-boolean-coercion', ['set', 'telemetry', 'true'], 'a boolean written as a boolean, not a string', withConfig),
  configCase('config-set-integer-coercion', ['set', 'retries', '7'], 'an integer written as a number, not a string', withConfig),
  configCase('config-set-no-config', ['set', 'telemetry', 'true'], 'no config file — a write must not create one', withoutConfig),

  // --- usage ---
  configCase('config-no-subcommand', [], 'no subcommand at all', withConfig),
  configCase('config-unknown-subcommand', ['list'], 'a subcommand that does not exist', withConfig),
];

module.exports = CASES;
