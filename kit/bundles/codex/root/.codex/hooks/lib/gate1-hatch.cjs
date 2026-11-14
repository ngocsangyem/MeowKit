'use strict';
// gate1-hatch.cjs — the one way to downgrade Gate 1 to a plan-presence check.
//
// Two forms, and nothing else: the environment variable, and `gate1PresenceOnly`
// in the USER config at `~/.meowkit/config.yaml`. The project config cannot
// express it, and the general config loader is not reachable from the gate —
// this reader can return one boolean and has no vocabulary for any other key, so
// no amount of committed YAML can reach the gate through it.
//
// Three refusals, all failing closed:
//   scope collapse  the user file and the project file are the same file, so the
//                   "outside the repository" premise is false and the hatch
//                   would be pull-request editable after all.
//   unloggable      the downgrade cannot be recorded. An unrecorded gate
//                   downgrade is worse than a refused one, so it does not happen.
//   unreadable      anything unexpected. A hatch that cannot be evaluated is not
//                   a hatch.

const fs = require('node:fs');
const path = require('node:path');

const HATCH_KEY = 'gate1PresenceOnly';
const ENV_NAME = 'MEOWKIT_GATE1_PRESENCE_ONLY';
const CONFIG_REL = path.join('.meowkit', 'config.yaml');
const LOG_REL = path.join('.meowkit', 'telemetry', 'security-log.md');

/**
 * The single key, read without a parser. A line scanner cannot leak a second
 * key the way a general loader could: there is no map to return.
 */
function readHatchKey(file) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
  for (const line of source.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^gate1PresenceOnly:\s*(true|false)\s*(?:#.*)?$/);
    if (match) return match[1] === 'true';
  }
  return undefined;
}

/** True when two paths are the same file on disk, by identity rather than spelling. */
function sameFile(a, b) {
  try {
    const left = fs.statSync(a);
    const right = fs.statSync(b);
    return left.dev === right.dev && left.ino === right.ino;
  } catch {
    try {
      return fs.realpathSync(path.dirname(a)) === fs.realpathSync(path.dirname(b)) && path.basename(a) === path.basename(b);
    } catch {
      return false;
    }
  }
}

/** Append one line. `false` means it did not land, which is a refusal reason. */
function record(root, line) {
  const file = path.join(root, LOG_REL);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${line}\n`);
    return true;
  } catch {
    return false;
  }
}

const stamp = () => new Date().toISOString();

/**
 * `{ downgrade, source, notices }` — `source` is `env` or `user-config` when the
 * downgrade applies, and `notices` are lines the caller writes to stderr so every
 * outcome, applied or refused, is visible in the transcript.
 */
function resolveHatch({ root, env = process.env, home = require('node:os').homedir() } = {}) {
  const notices = [];

  // Spelled out rather than read through the `ENV_NAME` constant: the closed-set
  // proof over the gate's require graph scans for the literal, and a read it
  // cannot see is a read the allowlist stops guarding.
  if (env.MEOWKIT_GATE1_PRESENCE_ONLY === '1') {
    const logged = record(root, `${stamp()} gate1 downgraded to presence-only via ${ENV_NAME} (approval receipt NOT verified)`);
    if (!logged) {
      notices.push(`Gate 1: ${ENV_NAME}=1 ignored — the downgrade could not be recorded in ${LOG_REL}, and an unrecorded gate downgrade is not permitted.`);
      return { downgrade: false, source: null, notices };
    }
    notices.push(`Gate 1: downgraded to presence-only via ${ENV_NAME}=1 (approval receipt NOT verified).`);
    return { downgrade: true, source: 'env', notices };
  }

  const userFile = path.join(home, CONFIG_REL);
  const projectFile = path.join(root, CONFIG_REL);
  const requested = readHatchKey(userFile);
  if (requested !== true) return { downgrade: false, source: null, notices };

  if (sameFile(userFile, projectFile)) {
    record(root, `${stamp()} gate1 presence-only REFUSED: the user config and the project config are the same file (${userFile}); Gate 1 stayed strict`);
    notices.push(`Gate 1: ${HATCH_KEY} ignored — ${userFile} is also this project's committed config, so it is editable by anyone who can open a pull request.`);
    notices.push(`Gate 1 stays strict. Use ${ENV_NAME}=1 if you really mean to downgrade in this layout.`);
    return { downgrade: false, source: null, notices };
  }

  const logged = record(root, `${stamp()} gate1 downgraded to presence-only via ${HATCH_KEY} in ${userFile} (approval receipt NOT verified)`);
  if (!logged) {
    notices.push(`Gate 1: ${HATCH_KEY} ignored — the downgrade could not be recorded in ${LOG_REL}, and an unrecorded gate downgrade is not permitted.`);
    return { downgrade: false, source: null, notices };
  }
  notices.push(`Gate 1: downgraded to presence-only via ${HATCH_KEY} in ${userFile} (approval receipt NOT verified).`);
  return { downgrade: true, source: 'user-config', notices };
}

module.exports = { ENV_NAME, HATCH_KEY, LOG_REL, readHatchKey, resolveHatch, sameFile };
