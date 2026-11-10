#!/usr/bin/env node
'use strict';
// check-report-path.cjs — bundled copy of the kit's skill guard, self-contained.
//
// A provider bundle ships no shared library for these and installs skills one
// at a time, so a require across skill directories would couple trees that
// arrive independently. Generated from the kit guard of the same name; edit
// that one and regenerate.

// check-report-path.cjs — keep a diagnostic-only investigation inside its report
// directory.
//
// The skill that registers this guard produces findings, not fixes. Letting it
// write anywhere would make "diagnose without changing anything" unenforceable,
// so a write outside the report tree is refused.
//
// Refuses when it cannot tell where the write is going. A path checker that
// allows what it could not resolve is not a checker.
//
// A refusal is reported twice on purpose: the decision on stdout in the form
// this host reads, and the reason on stderr with a blocking exit, which is fed
// back whether or not the decision is parsed.
//
// This host reads a decision as `{ permission, user_message }`, which is what
// its sibling hooks emit; the other host's envelope would report no decision.

const fs = require('node:fs');
const path = require('node:path');

const deny = (reason) => {
  process.stdout.write(`${JSON.stringify({ permission: 'deny', user_message: reason })}
`);
  process.stderr.write(`${reason}\n`);
  process.exit(2);
};

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();


/**
 * Read the hook payload from stdin. Inlined because a bundle ships no shared
 * reader, and a guard that cannot read its input must still answer.
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
      // The path is returned exactly as the payload spelled it: the guard echoes
      // it back and matches it against repo-relative rules.
      return resolve({ ok: true, filePath: str(toolInput.file_path), command: str(toolInput.command) });
    });
  });
}

/**
 * Resolve symlinks as far as the path exists, then keep the remainder as
 * written. Neither the report directory nor the file being written has to exist
 * yet — a report path is usually new — so requiring existence would turn every
 * first write into "cannot verify".
 */
function resolveDeepest(target) {
  let probe = target;
  for (;;) {
    try {
      const real = fs.realpathSync(probe);
      const rest = path.relative(probe, target);
      return rest ? path.join(real, rest) : real;
    } catch {
      const parent = path.dirname(probe);
      // Nothing on the path exists: the lexical form is the best answer.
      if (parent === probe) return path.resolve(target);
      probe = parent;
    }
  }
}

/** Both sides are fully resolved so a `..` segment cannot walk out of the tree. */
function isInsideReports(requested) {
  const allowed = resolveDeepest(path.join(root, 'tasks', 'reports'));
  const target = resolveDeepest(path.isAbsolute(requested) ? requested : path.join(root, requested));
  return target === allowed || target.startsWith(allowed + path.sep);
}

readHookInput().then((input) => {
  if (!input.filePath) deny('[investigate] A diagnostic report path is required.');
  let inside = false;
  try {
    inside = isInsideReports(input.filePath);
  } catch {
    deny('[investigate] Cannot verify the report path.');
  }
  if (!inside) deny('[investigate] Only diagnostic reports under tasks/reports/** may be written.');
  process.stdout.write(`${JSON.stringify({ permission: 'allow' })}\n`);
  process.exit(0);
});
