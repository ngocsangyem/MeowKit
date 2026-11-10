#!/usr/bin/env node
'use strict';
// pre-ship.cjs — the ship-boundary guard. Registered on Bash; only git commit,
// push and merge trigger it, and everything else passes through untouched.
//
// Order is load-bearing. The structural ship proof and the team-memory lint run
// ABOVE the profile check on purpose: the ship gate has no exceptions, "even
// fast mode", and fast is exactly the profile under which someone is most
// tempted to ship unreviewed. The build, lint and test block below stays
// profile-gated, because those are speed trade-offs and these two are not.
//
// Exit 2 is the only blocking value. Exit 1 is advisory — it would print
// "BLOCKED" and let the ship happen anyway — so no blocking path here may use
// it. The same asymmetry makes a crash a silent bypass, so the handlers below
// are installed before any library is required, and are written inline rather
// than imported so a broken library cannot take them down with it.

const MARKER = '@@GATE_BLOCK@@';

function failClosed(err) {
  try {
    process.stderr.write(`${MARKER}\nPre-ship guard could not run: ${err && err.message ? err.message : String(err)}\n`);
    process.stderr.write('A ship with no enforceable gate is blocked, not waved through.\n');
  } catch {
    // Nothing left to report with; the exit code is the decision.
  }
  process.exit(2);
}

process.on('uncaughtException', failClosed);
process.on('unhandledRejection', failClosed);

const path = require('node:path');
const { readHookInput } = require('./lib/parse-stdin.cjs');
const { lintMemoryStore } = require('./lib/memory-store-lint.cjs');
const { runPreShipChecks } = require('./lib/preship-checks.cjs');

const SHIP_COMMAND = /git commit|git push|git merge/;

const write = (stream, lines) => { if (lines.length) stream.write(`${lines.join('\n')}\n`); };
const emitResult = (result) => {
  write(process.stdout, result.stdout);
  write(process.stderr, result.stderr);
};

/**
 * A missing structural checker is NOT a quiet pass. A broken install must not
 * silently downgrade to "no ship gate", because at a ship boundary that is
 * indistinguishable from a passing gate at the one moment it matters.
 */
function blockMissingChecker(reason) {
  write(process.stderr, [
    MARKER,
    `Gate 2 checker ${reason} — Gate 2 cannot be enforced.`,
    'A ship with no enforceable Gate 2 is blocked, not waved through.',
    'Fix: reinstall or restore the hook library, then retry.',
  ]);
  return 2;
}

/** Load the structural checker, or report why the ship cannot be proven. */
function loadGate2Check(root) {
  const modulePath = path.join(root, '.claude/hooks/lib/gate2-check.cjs');
  try {
    return { gate2Check: require('./lib/gate2-check.cjs').gate2Check, modulePath };
  } catch {
    return { gate2Check: null, modulePath };
  }
}

function run(root, command, env) {
  const { gate2Check, modulePath } = loadGate2Check(root);
  if (!gate2Check) return blockMissingChecker(`${modulePath} not found`);

  const gate2 = gate2Check({ root, command });
  emitResult(gate2);
  if (gate2.exit !== 0) return 2;

  // Not a ship command: the checks below are none of this hook's business.
  if (!SHIP_COMMAND.test(command)) return 0;

  const lint = lintMemoryStore({ root, env });
  emitResult(lint);
  if (lint.exit !== 0) return lint.exit;

  const profile = env.MEOWKIT_HOOK_PROFILE || env.MEOW_HOOK_PROFILE || 'standard';
  if (profile === 'fast') return 0;

  const checks = runPreShipChecks(root);
  emitResult(checks);
  return checks.exit;
}

async function main() {
  const input = await readHookInput();
  if (!input.ok) {
    write(process.stderr, [
      MARKER,
      `Pre-ship guard received unreadable hook input (${input.reason}).`,
      'A ship guard that cannot read the command must not allow it.',
    ]);
    process.exit(2);
  }

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    process.chdir(root);
  } catch {
    process.exit(0);
  }

  // argv is the back-compatible fallback for a registration that still passes
  // the command as a positional argument.
  const command = input.command || process.argv[2] || '';
  process.exit(run(root, command, process.env));
}

main();
