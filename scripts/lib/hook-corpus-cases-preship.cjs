'use strict';
// hook-corpus-cases-preship.cjs — ship-gate cases, run against the pinned shell
// .claude/hooks/pre-ship.sh.
//
// All four of the ship guard's block paths are covered: :38 (gate2-check returns
// non-zero), :54 (the checker is absent), :99 (team-memory lint) and :220 (a
// failing build/lint/test step), plus lib/gate2-check.sh:206 (security verdict).
// The :99 and :220 cases stage a docs-only change on purpose, so Gate 2 reports
// N/A and the hook proceeds to the path under test.

const F = require('./hook-corpus-fs.cjs');
const { PLAN_DIR, PROJECT_DIR_ENV: PROJ, SLUG, bash } = require('./hook-corpus-payload.cjs');

const PRESHIP = '.claude/hooks/pre-ship.sh';
const SOURCE_CHANGE = [['src/app.ts', 'export const a = 1;\n']];
const DOCS_CHANGE = [['docs/guide.md', '# guide\n']];
const COMMIT = bash('git commit -m "feat: add thing"');
const DOCS_COMMIT = bash('git commit -m "docs: update"');

/** A git repo whose staged change set is `staged`, plus an optional active-plan pointer. */
function shipProject(ctx, { staged, pointer = true }) {
  const head = F.initGit(ctx.projectDir, ctx.home, { commit: [['README.md', '# corpus\n']], stage: staged });
  if (pointer) F.writeFile(ctx.projectDir, 'session-state/active-plan.json', F.activePlanPointer(PLAN_DIR));
  return head;
}

const verdict = (ctx, opts) =>
  F.writeFile(ctx.projectDir, `tasks/reviews/261101-${SLUG}-verdict.md`, F.verdictBody({ slug: SLUG, ...opts }));

const cases = [
  {
    name: 'preship-non-ship-command',
    stdin: bash('ls -la'),
    setupDescription: 'git repo with a staged source file; the command is not a ship command',
    setup: (ctx) => shipProject(ctx, { staged: SOURCE_CHANGE }),
  },
  {
    name: 'preship-commit-no-active-plan-pointer',
    stdin: COMMIT,
    setupDescription: 'staged source file, no session-state/active-plan.json',
    setup: (ctx) => shipProject(ctx, { staged: SOURCE_CHANGE, pointer: false }),
  },
  {
    name: 'preship-commit-no-verdict',
    stdin: COMMIT,
    setupDescription: 'staged source file + active-plan pointer, no verdict for the slug',
    setup: (ctx) => shipProject(ctx, { staged: SOURCE_CHANGE }),
  },
  {
    name: 'preship-commit-fail-verdict',
    stdin: COMMIT,
    setupDescription: 'verdict naming HEAD but carrying a FAIL dimension',
    setup: (ctx) => {
      const head = shipProject(ctx, { staged: SOURCE_CHANGE });
      verdict(ctx, { revision: head, fail: true });
    },
  },
  {
    name: 'preship-commit-docs-only-na',
    stdin: DOCS_COMMIT,
    setupDescription: 'only docs/*.md staged, so Gate 2 is not applicable',
    setup: (ctx) => shipProject(ctx, { staged: DOCS_CHANGE }),
  },
  {
    name: 'preship-commit-two-verdicts',
    stdin: COMMIT,
    setupDescription: 'two verdict files match the same plan slug',
    setup: (ctx) => {
      const head = shipProject(ctx, { staged: SOURCE_CHANGE });
      for (const date of ['261101', '261102']) {
        F.writeFile(ctx.projectDir, `tasks/reviews/${date}-${SLUG}-verdict.md`, F.verdictBody({ slug: SLUG, revision: head }));
      }
    },
  },
  {
    name: 'preship-commit-verdict-not-naming-head',
    stdin: COMMIT,
    setupDescription: 'one passing verdict that records no revision',
    setup: (ctx) => {
      shipProject(ctx, { staged: SOURCE_CHANGE });
      verdict(ctx, {});
    },
  },
  {
    name: 'preship-commit-passing-verdict',
    stdin: COMMIT,
    setupDescription: 'one passing verdict naming HEAD; no package.json so no build/lint/test runs',
    setup: (ctx) => {
      const head = shipProject(ctx, { staged: SOURCE_CHANGE });
      verdict(ctx, { revision: head });
    },
  },
  {
    name: 'preship-commit-security-verdict-block',
    stdin: COMMIT,
    setupDescription: 'a security verdict with a FAIL dimension (lib/gate2-check.sh:206 path)',
    setup: (ctx) => {
      const head = shipProject(ctx, { staged: SOURCE_CHANGE });
      F.writeFile(
        ctx.projectDir,
        `tasks/reviews/261101-${SLUG}-security-verdict.md`,
        F.verdictBody({ slug: SLUG, revision: head, fail: true, kind: 'security' }),
      );
      verdict(ctx, { revision: head });
    },
  },
  {
    name: 'preship-gate2-checker-absent',
    stdin: COMMIT,
    setupDescription: 'lib/gate2-check.sh deleted from the tree (pre-ship.sh:54 path)',
    setup: (ctx) => {
      shipProject(ctx, { staged: SOURCE_CHANGE });
      F.removeLib(ctx, '.claude/hooks/lib/gate2-check');
    },
  },
  {
    name: 'preship-memory-lint-failure',
    stdin: DOCS_COMMIT,
    env: { ...PROJ, MEOWKIT_CLI: '{{TMP}}/bin/fake-mewkit' },
    setupDescription: 'docs-only staged (Gate 2 N/A) + MEOWKIT_CLI resolving to a failing stub (pre-ship.sh:99 path)',
    setup: (ctx) => {
      shipProject(ctx, { staged: DOCS_CHANGE });
      F.writeFakeCli(ctx.projectDir, 'bin/fake-mewkit', {
        exitCode: 1,
        output: 'FAIL: .meowkit/memory/gotchas.md:3 entry carries an instruction-like phrase\n',
      });
    },
  },
  {
    name: 'preship-build-step-failure',
    stdin: DOCS_COMMIT,
    setupDescription: 'docs-only staged (Gate 2 N/A) + package.json whose test script exits 1 (pre-ship.sh:220 path)',
    setup: (ctx) => {
      shipProject(ctx, { staged: DOCS_CHANGE });
      F.writeFile(ctx.projectDir, 'package.json', `${JSON.stringify({ name: 'corpus', scripts: { test: 'exit 1' } }, null, 2)}\n`);
    },
  },
];

module.exports = cases.map((c) => ({ group: 'gate2-preship', entrypoint: PRESHIP, env: PROJ, ...c }));
