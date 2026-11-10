'use strict';
// config-rules.cjs — the rejections a project config is subject to, hook side.
//
// Every one of them is a REJECTION of the whole file, not of one key. A config
// that applied the keys parsed before the bad one would hand the user a
// half-configured session whose behaviour matches no file they can read.
//
// Each rejection carries a stable identifier so the CLI and the hook reader can
// be asserted to agree on which rule fired, not merely that both said no, and so
// a message can name the key, where it came from, and what to do instead.

const {
  PROTECTED_HOOKS,
  PROTECTED_REASON,
  FORBIDDEN_NAMESPACES,
  STATE_ONLY_KEYS,
  knownKeys,
} = require('./config-keys.cjs');

// Named here rather than required from the gate's hatch reader: this module must
// not be a path by which anything reaches that reader.
const HATCH_KEY = 'gate1PresenceOnly';
const HATCH_ENV = 'MEOWKIT_GATE1_PRESENCE_ONLY';

/** A committed file must not hold a secret, however the user spelled the key. */
const SECRET_WORD = /keys|token|secret|password/i;

/** POSIX `/etc/x` and Windows `C:\x`. A machine-specific path is not shareable. */
const ABSOLUTE_PATH = /^(\/|[A-Za-z]:[\\/])/;

const reject = (code, key, message, fix) => ({ ok: false, error: { code, key, message, fix } });

/**
 * `{ ok: true, values }` or `{ ok: false, error }` for an already-parsed flat
 * map. `scope` names where the file came from, so the message can say it.
 */
function applyRules(values, { root, scope = 'project config' } = {}) {
  const keys = knownKeys(root);

  for (const [key, value] of Object.entries(values)) {
    // The schema pointer is not a setting and has no rule to break.
    if (key === '$schema') continue;
    const namespace = key.split('.')[0];

    if (Object.hasOwn(FORBIDDEN_NAMESPACES, namespace)) {
      return reject(
        'forbidden-namespace',
        key,
        `${key} in the ${scope}: the "${namespace}" namespace does not exist, because ${FORBIDDEN_NAMESPACES[namespace]}`,
        `remove ${key}`,
      );
    }

    if (SECRET_WORD.test(key) || (typeof value === 'string' && SECRET_WORD.test(value))) {
      return reject(
        'secret-in-config',
        key,
        `${key} in the ${scope} looks like a credential, and the config is committed`,
        'move the value to the environment or to .meowkit/.env, which is never committed',
      );
    }

    if (typeof value === 'string' && ABSOLUTE_PATH.test(value)) {
      return reject(
        'absolute-path',
        key,
        `${key} in the ${scope} is an absolute path (${value}), which resolves differently on a teammate's machine`,
        'use a path relative to the project root, or drop the key',
      );
    }

    if (namespace === 'hooks') {
      const name = key.slice('hooks.'.length);
      if (PROTECTED_HOOKS.includes(name)) {
        return reject(
          'protected-hook',
          key,
          `${name} cannot be disabled from the ${scope}: ${PROTECTED_REASON[name]}`,
          'remove the key; a safety check is not a preference',
        );
      }
    }

    if (Object.hasOwn(STATE_ONLY_KEYS, key)) {
      return reject(
        'state-only-key',
        key,
        `${key} is not a config key in the ${scope}: ${STATE_ONLY_KEYS[key]}`,
        `remove the key and run .claude/hooks/lib/workflow-config set ${key} true, which records it in .meowkit/state/`,
      );
    }

    if (key === HATCH_KEY) {
      // The gate reads this key through its own single-key reader, never through
      // here. It is accepted in the user file only so that setting the hatch
      // does not invalidate the rest of a user's file, and rejected in the
      // project file because a committed gate downgrade is the whole thing the
      // config surface is shaped to make impossible.
      if (scope === 'user config') continue;
      return reject(
        'user-scope-only',
        key,
        `${key} is not a project-config key: a committed file must not be able to downgrade Gate 1`,
        `move it to ~/.meowkit/config.yaml, or export ${HATCH_ENV} for one session`,
      );
    }

    if (!Object.hasOwn(keys, key)) {
      return reject(
        'unknown-key',
        key,
        `${key} in the ${scope} is not a config key`,
        'check the spelling against .meowkit/config.yaml, whose commented stubs list every key',
      );
    }

    const spec = keys[key];
    if (spec.type === 'boolean' && typeof value !== 'boolean') {
      return reject('wrong-type', key, `${key} in the ${scope} must be true or false, not ${JSON.stringify(value)}`, `set ${key} to true or false`);
    }
    if (spec.type === 'integer' && !Number.isInteger(value)) {
      return reject('wrong-type', key, `${key} in the ${scope} must be a whole number, not ${JSON.stringify(value)}`, `set ${key} to a whole number`);
    }
    if (spec.type === 'string' && typeof value !== 'string') {
      return reject('wrong-type', key, `${key} in the ${scope} must be a string, not ${JSON.stringify(value)}`, `set ${key} to one of ${spec.enum ? spec.enum.join(', ') : 'the documented values'}`);
    }
    if (spec.enum && !spec.enum.includes(value)) {
      return reject('not-in-enum', key, `${key} in the ${scope} is ${JSON.stringify(value)}, which is not one of ${spec.enum.join(', ')}`, `set ${key} to one of ${spec.enum.join(', ')}`);
    }
  }

  return { ok: true, values };
}

module.exports = { applyRules, SECRET_WORD, ABSOLUTE_PATH };
