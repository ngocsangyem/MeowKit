#!/usr/bin/env node
'use strict';
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
// A refusal is reported twice on purpose: the decision goes to stdout in the
// form this event reads, and the reason goes to stderr with a blocking exit,
// which the host feeds back regardless of whether it parses the decision. The
// shell guard printed a top-level `permissionDecision`, which is not a
// recognised field for this event, so only its exit code was ever load-bearing.

const fs = require('node:fs');
const path = require('node:path');

const deny = (reason) => {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  })}\n`);
  process.stderr.write(`${reason}\n`);
  process.exit(2);
};

const { resolveProjectRoot } = require(path.join(__dirname, '../../../hooks/lib/project-root.cjs'));
const root = resolveProjectRoot();

const HELPER = path.join(__dirname, '../../../hooks/lib/parse-stdin.cjs');
let readHookInput;
try {
  readHookInput = require(HELPER).readHookInput;
} catch {
  deny('[investigate] Cannot verify the report path.');
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
  process.stdout.write('{}\n');
  process.exit(0);
});
