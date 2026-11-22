#!/usr/bin/env node
'use strict';
// pre-ship.cjs — the ship check. Registered on Bash; a git commit, push or merge
// and `gh pr create|merge` trigger it (lib/ship-command.cjs), and everything else
// passes through untouched. The decision lives in lib/core/pre-ship.cjs.
//
// Two blocking answers, one per outcome:
//   failed         a check ran and reported a problem: exit 2, the reason on stderr.
//   could_not_run  no verdict (a crash, a missing tool, the deadline): the PreToolUse
//                  `ask` decision, so the call waits for the person at the permission
//                  prompt. That prompt is the only override; nothing in the command or
//                  the environment is read as one.
// The registration sets `onFailure: "block"`, so a hook the host cannot start or has
// to stop at its timeout blocks the call as well.
//
// Exit 1 is advisory — it would print "BLOCKED" and let the ship happen anyway — so
// no blocking path here may use it. The crash handlers are installed before any
// library is required, and written inline rather than imported, so a broken library
// cannot take them down with it.

const MARKER = '@@GATE_BLOCK@@';

/** Answer `ask` with the reason, so a person decides whether an unverified ship goes ahead. */
function askHuman(lines) {
  const reason = ['MeowKit ship check could not run, so this ship is unverified.', ...lines].join('\n');
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason },
  })}\n`);
  process.stderr.write(`${MARKER}\n${reason}\n`);
  process.exit(0);
}

function failClosed(err) {
  const detail = `PRE-SHIP COULD NOT RUN: the ship check crashed (${err && err.message ? err.message : String(err)}).`;
  try {
    // Best effort: the library that failed may be the one that writes the record.
    require('./lib/core/pre-ship.cjs').recordShipCheck(process.env.CLAUDE_PROJECT_DIR || process.cwd(), { outcome: 'could_not_run', cause: 'crash' });
  } catch {
    // No record; the answer below still blocks.
  }
  try {
    askHuman([detail]);
  } catch {
    process.exit(2);
  }
}

process.on('uncaughtException', failClosed);
process.on('unhandledRejection', failClosed);

const { readHookInput } = require('./lib/parse-stdin.cjs');
const { enterGuardRoot, resolveShipRoot } = require('./lib/project-root.cjs');
const { decidePreShip, recordShipCheck } = require('./lib/core/pre-ship.cjs');

const write = (stream, lines) => { if (lines.length) stream.write(`${lines.join('\n')}\n`); };

async function main() {
  const input = await readHookInput();
  if (!input.ok) {
    // Without the command there is nothing to put in front of a person, so this blocks outright.
    recordShipCheck(process.env.CLAUDE_PROJECT_DIR || process.cwd(), { outcome: 'could_not_run', cause: 'unreadable_input' });
    write(process.stderr, [
      MARKER,
      `Pre-ship guard received unreadable hook input (${input.reason}).`,
      'A ship guard that cannot read the command must not allow it.',
    ]);
    process.exit(2);
  }

  // Every rule below is relative to the project root. A root that cannot be found or entered
  // is a block: allowing here would check the wrong tree, or none.
  // argv is the back-compatible fallback for a registration that still passes
  // the command as a positional argument.
  const command = input.command || process.argv[2] || '';
  // The ship root, not the plain guard root: in a worktree session the commit acts on the
  // worktree, so that is the tree whose changes, HEAD and verdict decide it.
  const root = enterGuardRoot(input.cwd || process.cwd(), process.env, resolveShipRoot, command);
  if (!root) {
    write(process.stderr, [MARKER, 'Pre-ship guard cannot locate the project root it guards.', 'A ship guard that cannot tell which project it is in must not allow the command.']);
    process.exit(2);
  }

  const result = decidePreShip({ root, command, env: process.env });
  if (result.outcome === 'could_not_run') {
    write(process.stderr, result.stdout);
    askHuman(result.stderr);
  }
  write(process.stdout, result.stdout);
  write(process.stderr, result.stderr);
  process.exit(result.exit);
}

main();
