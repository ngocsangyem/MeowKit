#!/usr/bin/env node
'use strict';
// gate-enforcement.cjs — block source writes before the plan is approved and
// before the sprint contract is signed.
//
// Matches Edit and Write. Allows plan files, review files, contract files,
// docs, kit files and test files; blocks a source write when no approved plan
// exists or the active sprint has no signed contract.
//
// Only exit 2 blocks the tool call. Exit 1 is advisory — the write proceeds —
// so a blocking path here must never use it. That cuts both ways: a crash, a
// syntax error in a library, or a missing library also exits non-2 by default,
// which fails OPEN at the exact moment the guard is needed. The handlers below
// are installed BEFORE anything is required so that any such failure still
// lands on exit 2 with the marker. They are written inline, not imported,
// because importing them would reintroduce the very dependency they exist to
// survive.

const MARKER = '@@GATE_BLOCK@@';

function failClosed(err) {
  try {
    process.stderr.write(`${MARKER}\nGate 1 could not run: ${err && err.message ? err.message : String(err)}\n`);
    process.stderr.write('A write guard that cannot evaluate must not allow the write.\n');
  } catch {
    // Nothing left to report with; the exit code is the decision.
  }
  process.exit(2);
}

process.on('uncaughtException', failClosed);
process.on('unhandledRejection', failClosed);

const { readHookInput } = require('./lib/parse-stdin.cjs');
const { enterGuardRoot } = require('./lib/project-root.cjs');
const { decidePlanGate } = require('./lib/core/plan-gate.cjs');

const emit = (lines) => { if (lines.length) process.stderr.write(`${lines.join('\n')}\n`); };

async function main() {
  const input = await readHookInput();
  if (!input.ok) {
    emit([
      MARKER,
      `Gate 1 received unreadable hook input (${input.reason}).`,
      'A write guard that cannot read what is being written must not allow it.',
    ]);
    process.exit(2);
  }

  // Every rule below is relative to the project root. A root that cannot be found or entered
  // is a block: allowing here would check the wrong tree, or none.
  const root = enterGuardRoot(input.cwd || process.cwd());
  if (!root) {
    emit([MARKER, 'Gate 1 cannot locate the project root it guards.', 'A write guard that cannot tell which project it is in must not allow the write.']);
    process.exit(2);
  }

  // argv is the back-compatible fallback for a registration that still passes
  // the target as a positional argument.
  const filePath = input.filePath || process.argv[2] || '';
  const result = decidePlanGate({ root, paths: [filePath], env: process.env });
  emit(result.stderr);
  process.exit(result.exit);
}

main();
