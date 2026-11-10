'use strict';
// hook-corpus-cases-guards.cjs — cases for the three live skill
// guards: careful (destructive commands), freeze (edit boundary) and
// investigate (diagnostic report path).
//
// These record each guard SCRIPT's own behavior, invoked directly with the
// payload the hook would receive. That stays the parity target for the .cjs
// ports even though the BASE SKILL.md registrations never fire — see the the contract
// evidence: `${CLAUDE_SKILL_DIR}` does not resolve in a `hooks:` block.

const F = require('./hook-corpus-fs.cjs');
const { PROJECT_DIR_ENV: PROJ, bash, edit, write } = require('./hook-corpus-payload.cjs');

const freezeBoundary = (ctx) => F.writeFile(ctx.projectDir, '.meowkit/state/freeze-dir.txt', `${ctx.projectDir}/src\n`);

const cases = [
  {
    group: 'guard-careful',
    entrypoint: '.claude/skills/careful/bin/check-careful.sh',
    name: 'careful-destructive-command',
    stdin: bash('rm -rf /var/data/customers'),
    setupDescription: 'BASE guard tree only',
    setup: () => {},
    normalizers: ['tmpdir', 'isoTimestamp'],
    sideEffects: ['.meowkit/telemetry/security-log.md'],
  },
  {
    group: 'guard-careful',
    entrypoint: '.claude/skills/careful/bin/check-careful.sh',
    name: 'careful-safe-command',
    stdin: bash('ls -la src'),
    setupDescription: 'BASE guard tree only',
    setup: () => {},
  },
  {
    group: 'guard-freeze',
    entrypoint: '.claude/skills/freeze/bin/check-freeze.sh',
    name: 'freeze-edit-outside-boundary',
    stdin: edit('{{TMP}}/lib/other.ts'),
    setupDescription: 'freeze boundary set to {{TMP}}/src; the edit targets {{TMP}}/lib',
    setup: freezeBoundary,
  },
  {
    group: 'guard-freeze',
    entrypoint: '.claude/skills/freeze/bin/check-freeze.sh',
    name: 'freeze-edit-inside-boundary',
    stdin: edit('{{TMP}}/src/app.ts'),
    setupDescription: 'freeze boundary set to {{TMP}}/src; the edit targets {{TMP}}/src',
    setup: freezeBoundary,
  },
  {
    group: 'guard-freeze',
    entrypoint: '.claude/skills/freeze/bin/check-freeze.sh',
    name: 'freeze-no-boundary-configured',
    stdin: edit('{{TMP}}/lib/other.ts'),
    setupDescription: 'no freeze-dir.txt at all — the not-yet-configured allow path',
    setup: () => {},
  },
  {
    group: 'guard-investigate',
    entrypoint: '.claude/skills/investigate/bin/check-report-path.sh',
    name: 'investigate-report-path-wrong',
    stdin: write('src/findings.md'),
    setupDescription: 'a Write outside tasks/reports/',
    setup: () => {},
  },
  {
    group: 'guard-investigate',
    entrypoint: '.claude/skills/investigate/bin/check-report-path.sh',
    name: 'investigate-report-path-right',
    stdin: write('tasks/reports/investigate-261101-corpus.md'),
    setupDescription: 'a Write under tasks/reports/',
    setup: (ctx) => F.writeFile(ctx.projectDir, 'tasks/reports/.keep', ''),
  },
  {
    group: 'guard-investigate',
    entrypoint: '.claude/skills/investigate/bin/check-report-path.sh',
    name: 'investigate-report-path-missing',
    stdin: bash('ls'),
    setupDescription: 'a payload that names no file path at all',
    setup: () => {},
  },
];

module.exports = cases.map((c) => ({ env: PROJ, ...c }));
