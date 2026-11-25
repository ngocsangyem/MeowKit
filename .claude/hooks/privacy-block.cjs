#!/usr/bin/env node
'use strict';
// privacy-block.cjs — refuse reads of sensitive files, obviously unsafe web
// fetches, and reads of archived plans (Edit and Write into the archive pass).
//
// Matches Read, Grep, Glob, Edit, Write and Bash. Exit 2 is the only blocking value: exit 1
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
// payload's file path, a Grep search glob, and the files a Bash command's own
// words show it reading or copying out. That last one is best effort: a path
// built from a variable or a glob, or a command inside `bash -c` or `eval`, is
// not seen; the permission system is the control for that case.

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
const { decidePrivacy, isArchivedPlanPath } = require('./lib/core/privacy.cjs');

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
  // Grep and Glob name a directory to search as `path`; a Glob pattern can name the archive
  // itself (`tasks/plans/archive/**`), and only then is it judged, because a pattern such as
  // `**/*.pem` is a search, not a read of a credential file.
  const toolInput = input.data && typeof input.data.tool_input === 'object' && input.data.tool_input ? input.data.tool_input : {};
  const searchPath = typeof toolInput.path === 'string' ? toolInput.path : '';
  const pattern = input.toolName === 'Glob' && typeof toolInput.pattern === 'string' && isArchivedPlanPath(toolInput.pattern) ? toolInput.pattern : '';
  // A Grep `glob` picks the files whose content is searched, so `.env` there reads `.env`.
  const globs = input.toolName === 'Grep' && typeof toolInput.glob === 'string' ? [toolInput.glob] : [];
  const result = decidePrivacy({ paths: [filePath, searchPath, pattern], command: input.command, toolName: input.toolName, globs });
  emit(result.stderr);
  process.exit(result.exit);
}

main();
