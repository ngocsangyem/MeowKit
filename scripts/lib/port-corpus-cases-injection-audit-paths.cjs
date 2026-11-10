'use strict';
// port-corpus-cases-injection-audit-paths.cjs — the recorded behavior of the
// audit scanner on ONE explicit path.
//
// At BASE this is reachable only by importing the scanner as a Python module,
// which is exactly how the fetch-persisting skill script uses it, so the
// recorder drives it through a generated importer and pins the field values the
// scanner returns. Read the split that way:
//
//   recorded   the findings themselves — severity, class, description, file and
//              line, and their order. These must not drift, because the
//              importing consumer makes a quarantine decision from them.
//   new        the JSON envelope the single-path command line prints, because
//              BASE has no single-path command line to record one from.
//
// The boundary case is the one place the two compose: a path that resolves
// outside the project root yields the boundary finding first, then whatever its
// content matches. The recorder's importer defines that order and the port
// follows it, so the check stays reachable once the interpreter is gone.

const { PAYLOADS, SECURITY_LOG, scaffold, writeFile } = require('./port-corpus-payloads.cjs');

/** Shared shape: a scan of one explicit path. */
function pathCase(name, target, setupDescription, setup, normalizers = ['tmpdir']) {
  return {
    name,
    group: 'injection-audit',
    invocation: { kind: 'scan-one', target },
    setupDescription,
    normalizers,
    sideEffectPaths: SECURITY_LOG,
    setup,
  };
}

const CASES = [
  pathCase('audit-single-file-critical', 'notes/fetched-page.md', 'one explicit path holding a critical payload', (ctx) => {
    scaffold(ctx);
    writeFile(ctx.projectDir, 'notes/fetched-page.md', PAYLOADS.identityOverride);
  }),
  pathCase(
    'audit-single-file-mixed-severities',
    'notes/both.md',
    'one path matching two classes at two severities, pinning finding order',
    (ctx) => {
      scaffold(ctx);
      writeFile(ctx.projectDir, 'notes/both.md', PAYLOADS.mixed);
    },
  ),
  pathCase(
    'audit-single-file-inside-kit-directory',
    '.claude/notes/fetched-page.md',
    'an explicit path the directory walk would have pruned',
    (ctx) => {
      scaffold(ctx);
      writeFile(ctx.projectDir, '.claude/notes/fetched-page.md', PAYLOADS.identityOverride);
    },
  ),
  pathCase('audit-single-file-clean', 'CHANGELOG.md', 'an explicit path with nothing to report', (ctx) => {
    scaffold(ctx);
    writeFile(ctx.projectDir, 'CHANGELOG.md', PAYLOADS.clean);
  }),
  pathCase('audit-single-file-missing', 'notes/absent.md', 'an explicit path that does not exist — unreadable is not a finding', (ctx) =>
    scaffold(ctx),
  ),
  pathCase(
    'audit-single-file-unscanned-suffix',
    'notes/fetched-page.rst',
    'a suffix the directory walk skips, named explicitly — the filter is the walk’s, not the scanner’s',
    (ctx) => {
      scaffold(ctx);
      writeFile(ctx.projectDir, 'notes/fetched-page.rst', PAYLOADS.identityOverride);
    },
  ),
  // The printed paths are the argument as given, so no path outside the project
  // reaches the streams and `tmpdir` alone covers this case.
  pathCase('audit-single-file-outside-project', '../outside/notes.md', 'an explicit path that resolves outside the project root', (ctx) => {
    scaffold(ctx);
    writeFile(ctx.caseRoot, 'outside/notes.md', PAYLOADS.clean);
  }),
];

module.exports = CASES;
