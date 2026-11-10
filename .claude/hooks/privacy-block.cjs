#!/usr/bin/env node
'use strict';
// privacy-block.cjs — refuse reads of sensitive files and obviously unsafe web
// fetches.
//
// Matches Read, Edit, Write and Bash. Exit 2 is the only blocking value: exit 1
// is advisory and the tool call proceeds, which is useless for policy
// enforcement. The same asymmetry makes a crash dangerous, so the handlers
// below are installed before any library is required and are written inline —
// importing them would reintroduce the dependency they exist to survive.
//
// When blocked, the reason goes to stderr, which the host feeds back to the
// model. The agent is expected to ask the user for explicit approval before
// retrying rather than working around the refusal.
//
// Scope limit worth knowing: the sensitive-path patterns are matched against the
// payload's file path. A shell command that reads the same file through Bash
// carries no file path and is not caught here; the permission system is the
// control for that case.

const MARKER = '@@PRIVACY_BLOCK@@';

function failClosed(err) {
  try {
    process.stderr.write(`${MARKER}\nPrivacy guard could not run: ${err && err.message ? err.message : String(err)}\n`);
    process.stderr.write('A read guard that cannot evaluate must not allow the read.\n');
  } catch {
    // Nothing left to report with; the exit code is the decision.
  }
  process.exit(2);
}

process.on('uncaughtException', failClosed);
process.on('unhandledRejection', failClosed);

const { readHookInput } = require('./lib/parse-stdin.cjs');
const { enterGuardRoot } = require('./lib/project-root.cjs');
const { decidePrivacy } = require('./lib/core/privacy.cjs');

const emit = (lines) => { if (lines.length) process.stderr.write(`${lines.join('\n')}\n`); };

async function main() {
  const input = await readHookInput();
  if (!input.ok) {
    emit([
      MARKER,
      `Privacy guard received unreadable hook input (${input.reason}).`,
      'A read guard that cannot read what is being accessed must not allow it.',
    ]);
    process.exit(2);
  }

  // Every rule below is relative to the project root. A root that cannot be found or entered
  // is a block: allowing here would check the wrong tree, or none.
  const root = enterGuardRoot(input.cwd || process.cwd());
  if (!root) {
    emit([MARKER, 'Privacy guard cannot locate the project root it guards.', 'A read guard that cannot tell which project it is in must not allow the access.']);
    process.exit(2);
  }

  // argv is the back-compatible fallback for a registration that still passes
  // the target as a positional argument.
  const filePath = input.filePath || process.argv[2] || '';
  const result = decidePrivacy({ paths: [filePath], command: input.command });
  emit(result.stderr);
  process.exit(result.exit);
}

main();
