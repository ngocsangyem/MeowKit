'use strict';
// port-corpus-cases-injection-audit.cjs — the recorded behavior of the audit
// scanner's DIRECTORY scan, case by case. The single-path cases live beside this
// file; the split is by invocation shape, because only one of the two is a
// command line at BASE.
//
// A case stores a tree builder and an abstract invocation, never a command
// line. The recorder maps the invocation onto the pinned Python implementation
// and the replay maps it onto the node one; neither side re-derives an
// expectation. Keeping that mapping out of the case is what makes the two runs
// comparable at all.
//
// Every case here plants its payload in exactly ONE scanned file. Both
// implementations walk a directory in filesystem order, which is not a
// guarantee either language makes, so a second offending file would record an
// ordering rather than a decision. Multi-finding order is pinned by the
// single-path cases instead, where the order is the scanner's own: line by line,
// then pattern class by pattern class.

const { PAYLOADS, SECURITY_LOG, scaffold, writeFile } = require('./port-corpus-payloads.cjs');

/** Shared shape: a directory scan of the project root. */
function dirCase(name, setupDescription, setup, normalizers = ['tmpdir']) {
  return {
    name,
    group: 'injection-audit',
    invocation: { kind: 'scan-dir', args: ['.'] },
    setupDescription,
    normalizers,
    sideEffectPaths: SECURITY_LOG,
    setup,
  };
}

const CASES = [
  dirCase(
    'audit-critical-identity-override',
    'one scanned file claims its instructions were replaced',
    (ctx) => {
      scaffold(ctx);
      writeFile(ctx.projectDir, 'notes/fetched-page.md', PAYLOADS.identityOverride);
    },
    ['tmpdir', 'logStamp'],
  ),
  dirCase(
    'audit-critical-exfiltration',
    'one scanned file pipes a local file to a remote collector',
    (ctx) => {
      scaffold(ctx);
      writeFile(ctx.projectDir, 'tools/upload.sh', PAYLOADS.exfiltration);
    },
    ['tmpdir', 'logStamp'],
  ),
  dirCase('audit-suspicious-sensitive-data', 'a committed credential — reported, but not a halt', (ctx) => {
    scaffold(ctx);
    writeFile(ctx.projectDir, 'src/config.ts', PAYLOADS.sensitiveData);
  }),
  dirCase('audit-suspicious-unexpected-command', 'a shell-out through the system call interface', (ctx) => {
    scaffold(ctx);
    writeFile(ctx.projectDir, 'scripts/run.py', PAYLOADS.unexpectedCommand);
  }),
  dirCase('audit-clean-tree', 'nothing matches any pattern class', (ctx) => {
    scaffold(ctx);
    writeFile(ctx.projectDir, 'CHANGELOG.md', PAYLOADS.clean);
  }),
  dirCase('audit-kit-directory-skipped', 'the same critical payload inside the kit directory, which the walk prunes', (ctx) => {
    scaffold(ctx);
    writeFile(ctx.projectDir, '.claude/notes/fetched-page.md', PAYLOADS.identityOverride);
  }),
  dirCase('audit-unscanned-suffix-ignored', 'a critical payload in a suffix the walk does not scan', (ctx) => {
    scaffold(ctx);
    writeFile(ctx.projectDir, 'notes/fetched-page.rst', PAYLOADS.identityOverride);
  }),
  dirCase(
    'audit-nested-directory-walk',
    'the payload sits several levels down, beside pruned directories',
    (ctx) => {
      scaffold(ctx);
      writeFile(ctx.projectDir, 'node_modules/pkg/index.js', PAYLOADS.exfiltration);
      writeFile(ctx.projectDir, 'dist/bundle.js', PAYLOADS.exfiltration);
      writeFile(ctx.projectDir, 'a/b/c/deep.md', PAYLOADS.identityOverride);
    },
    ['tmpdir', 'logStamp'],
  ),
  {
    name: 'audit-target-is-a-file',
    group: 'injection-audit',
    invocation: { kind: 'scan-dir', args: ['README.md'] },
    setupDescription: 'the directory argument names a file',
    normalizers: ['tmpdir'],
    sideEffectPaths: SECURITY_LOG,
    setup: (ctx) => scaffold(ctx),
  },
  {
    name: 'audit-target-absent',
    group: 'injection-audit',
    invocation: { kind: 'scan-dir', args: ['no-such-dir'] },
    setupDescription: 'the directory argument names nothing at all',
    normalizers: ['tmpdir'],
    sideEffectPaths: SECURITY_LOG,
    setup: (ctx) => scaffold(ctx),
  },
];

module.exports = CASES;
