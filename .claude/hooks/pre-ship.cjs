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

const { readHookInput } = require('./lib/parse-stdin.cjs');
const { enterGuardRoot } = require('./lib/project-root.cjs');
const { decidePreShip } = require('./lib/core/pre-ship.cjs');

const write = (stream, lines) => { if (lines.length) stream.write(`${lines.join('\n')}\n`); };

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

  // Every rule below is relative to the project root. A root that cannot be found or entered
  // is a block: allowing here would check the wrong tree, or none.
  const root = enterGuardRoot(input.cwd || process.cwd());
  if (!root) {
    write(process.stderr, [MARKER, 'Pre-ship guard cannot locate the project root it guards.', 'A ship guard that cannot tell which project it is in must not allow the command.']);
    process.exit(2);
  }

  // argv is the back-compatible fallback for a registration that still passes
  // the command as a positional argument.
  const command = input.command || process.argv[2] || '';
  const result = decidePreShip({ root, command, env: process.env });
  write(process.stdout, result.stdout);
  write(process.stderr, result.stderr);
  process.exit(result.exit);
}

main();
