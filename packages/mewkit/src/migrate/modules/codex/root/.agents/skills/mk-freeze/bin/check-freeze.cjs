#!/usr/bin/env node
'use strict';
// check-freeze.cjs — bundled copy of the kit's skill guard, self-contained.
//
// A provider bundle ships no shared library for these and installs skills one
// at a time, so a require across skill directories would couple trees that
// arrive independently. Generated from the kit guard of the same name; edit
// that one and regenerate.

// check-freeze.cjs — restrict edits to one directory for the session.
//
// Answers with a permission decision rather than an exit code, because the host
// renders a decision as a prompt the user can act on while an exit code is just
// a failure.//
// The decision is returned inside `hookSpecificOutput`, which is the form this
// event reads. A top-level `permissionDecision` — the shape the shell guard
// printed — is not a recognised field for it, so that output was read as "no
// decision" and the guard enforced nothing even once it was registered.
//
// Allows whenever it cannot tell: no boundary configured, or no file path in the
// payload. This guard exists to stop an accidental edit outside the directory
// someone is working in, not to be a security control, so a parse failure must
// not block legitimate work.

const fs = require('node:fs');
const path = require('node:path');

const allow = () => {
  process.stdout.write('{}\n');
  process.exit(0);
};

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = process.env.CLAUDE_PLUGIN_DATA || path.join(root, '.meowkit/state');
const boundaryFile = path.join(stateDir, 'freeze-dir.txt');

let boundary;
try {
  boundary = fs.readFileSync(boundaryFile, 'utf8').replace(/\s/g, '');
} catch {
  allow();
}
if (!boundary) allow();

/**
 * Read the hook payload from stdin. Inlined because a bundle ships no shared
 * reader. The path is returned exactly as the payload spelled it: the guard
 * echoes it back and matches it against repo-relative rules.
 */
function readHookInput() {
  return new Promise((resolve) => {
    let raw = '';
    const empty = { ok: false, filePath: '', command: '' };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { raw += chunk; });
    process.stdin.on('error', () => resolve(empty));
    process.stdin.on('end', () => {
      if (raw.trim() === '') return resolve(empty);
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return resolve(empty);
      }
      if (data === null || typeof data !== 'object' || Array.isArray(data)) return resolve(empty);
      const toolInput = (data.tool_input && typeof data.tool_input === 'object') ? data.tool_input : {};
      const str = (v) => (v === null || v === undefined ? '' : String(v));
      return resolve({ ok: true, filePath: str(toolInput.file_path), command: str(toolInput.command) });
    });
  });
}

readHookInput().then((input) => {
  if (!input.filePath) allow();

  const absolute = path.isAbsolute(input.filePath) ? input.filePath : path.join(process.cwd(), input.filePath);
  // Collapse repeated separators and a trailing one so the directory node itself
  // compares equal to its own boundary.
  const target = absolute.replace(/\/+/g, '/').replace(/\/$/, '');
  const limit = boundary.replace(/\/$/, '');

  if (target === limit || target.startsWith(`${limit}/`)) allow();

  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `[freeze] Blocked: ${target} is outside the freeze boundary (${limit}). Only edits within the frozen directory are allowed.`,
    },
  })}\n`);
  process.exit(0);
});
