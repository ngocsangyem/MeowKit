'use strict';
// memory-store-lint.cjs — lint the team memory store at a ship boundary.
//
// Every entry in the store is read back as DATA by the skills that consult it,
// and the store is committed, so an injection phrase or a secret-shaped token
// in it is a security finding that ships with the change. That is why this runs
// alongside the structural ship proof rather than inside the speed-traded
// checks.
//
// CLI resolution deliberately uses only already-resolvable executables. Fetching
// the CLI from a registry at a commit boundary would be slow and, worse, would
// exit non-zero when the package is simply absent — which this check would then
// read as "poisoned store" and block on. An unavailable CLI is therefore a named
// SKIP: never a silent pass, and never a false block.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { isMissingExecutable } = require('./preship-checks.cjs');

const LOCAL_BIN = './node_modules/.bin/mewkit';

function isExecutable(p) {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * The CLI to lint with. An explicitly configured path and the project-local
 * install are proved to exist before use; a bare name is left to the launch
 * below, which reports "no such executable" distinctly from a lint failure.
 * Nothing here consults the search path, so the guard's environment set stays
 * closed.
 */
function resolveCli(root, env) {
  const configured = env.MEOWKIT_CLI || '';
  if (configured && isExecutable(configured)) return configured;
  const local = path.join(root, LOCAL_BIN);
  if (isExecutable(local)) return LOCAL_BIN;
  return 'mewkit';
}

const SKIP = { exit: 0, stdout: ['SKIP: mewkit CLI not found — team memory store not linted'], stderr: [] };

function blockLines(output) {
  return [
    '@@GATE_BLOCK@@',
    'PRE-SHIP BLOCKED: team memory store lint failed.',
    output,
    'A store entry carrying an injection phrase, a secret-shaped token,',
    'or an unscannable file is read back as DATA by every read-set skill',
    'and ships in this commit. Fix or remove the entry, then retry.',
  ];
}

/**
 * `{ exit, stdout, stderr }`. exit 2 blocks; exit 1 would be advisory and let
 * the commit through after printing "BLOCKED", which is the one outcome a write
 * guard must not produce.
 */
function lintMemoryStore({ root = process.cwd(), env = process.env } = {}) {
  const cli = resolveCli(root, env);
  const r = spawnSync(cli, ['validate', '--memory'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (isMissingExecutable(r)) return SKIP;
  if (!r.error && r.status === 0) return { exit: 0, stdout: [], stderr: [] };
  // Streams are merged because the CLI reports findings on either one.
  const output = `${r.stdout || ''}${r.stderr || ''}`.replace(/\n$/, '');
  return { exit: 2, stdout: [], stderr: blockLines(output) };
}

module.exports = { lintMemoryStore, resolveCli };
