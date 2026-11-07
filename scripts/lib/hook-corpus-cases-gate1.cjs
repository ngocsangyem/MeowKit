'use strict';
// hook-corpus-cases-gate1.cjs — plan-gate cases, run against the pinned shell
// .claude/hooks/gate-enforcement.sh.
//
// Covers both gates the entrypoint enforces: the plan/approval-receipt gate and
// the sprint-contract gate it delegates to check-contract-signed.cjs.

const F = require('./hook-corpus-fs.cjs');
const { CONTRACT, PLAN, PLAN_DIR, PROJECT_DIR_ENV: PROJ, SLUG, edit } = require('./hook-corpus-payload.cjs');

const GATE = '.claude/hooks/gate-enforcement.sh';

/** A plan plus a signed contract — the state in which Gate 1 allows a source edit. */
function approvedProject(ctx, { stamp = true, contractStatus = 'signed', withContracts = true } = {}) {
  F.writeFile(ctx.projectDir, PLAN, F.planBody(SLUG));
  if (stamp) F.stampApproval(ctx, PLAN);
  if (withContracts) {
    F.writeFile(ctx.projectDir, CONTRACT, F.contractBody({ slug: SLUG, status: contractStatus, signed: contractStatus !== 'draft' }));
  }
}

const cases = [
  {
    name: 'gate1-source-edit-no-plan',
    stdin: edit('src/app.ts'),
    setupDescription: 'BASE hook tree only; no tasks/plans/ at all',
    setup: () => {},
  },
  {
    name: 'gate1-plan-without-receipt',
    stdin: edit('src/app.ts'),
    setupDescription: 'one plan file, never stamped (approval-receipt verify -> 10)',
    setup: (ctx) => F.writeFile(ctx.projectDir, PLAN, F.planBody(SLUG)),
  },
  {
    name: 'gate1-plan-stale-hash',
    stdin: edit('src/app.ts'),
    setupDescription: 'plan stamped, then the body edited (approval-receipt verify -> 11)',
    setup: (ctx) => {
      F.writeFile(ctx.projectDir, PLAN, F.planBody(SLUG));
      F.stampThenEdit(ctx, PLAN);
    },
  },
  {
    name: 'gate1-approved-plan-signed-contract',
    stdin: edit('src/app.ts'),
    setupDescription: 'stamped plan + a signed sprint contract for the same slug',
    setup: (ctx) => approvedProject(ctx),
  },
  {
    name: 'gate1-approved-plan-unsigned-contract',
    stdin: edit('src/app.ts'),
    setupDescription: 'stamped plan + a draft (unsigned) contract',
    setup: (ctx) => approvedProject(ctx, { contractStatus: 'draft' }),
  },
  {
    name: 'gate1-approved-plan-no-contracts-dir',
    stdin: edit('src/app.ts'),
    setupDescription: 'stamped plan, no tasks/contracts/ directory',
    setup: (ctx) => approvedProject(ctx, { withContracts: false }),
  },
  {
    name: 'gate1-plans-write-allowed',
    stdin: edit(`${PLAN_DIR}/phase-01-setup.md`),
    setupDescription: 'no plan at all; the write itself targets tasks/plans/',
    setup: () => {},
  },
  {
    name: 'gate1-test-file-allowed',
    stdin: edit('src/app.test.ts'),
    setupDescription: 'no plan at all; the write targets a *.test.* path',
    setup: () => {},
  },
  {
    name: 'gate1-contract-edit-valid',
    stdin: edit(CONTRACT),
    setupDescription: 'editing a schema-valid contract file',
    setup: (ctx) => F.writeFile(ctx.projectDir, CONTRACT, F.contractBody({ slug: SLUG })),
  },
  {
    name: 'gate1-contract-edit-invalid',
    stdin: edit(`tasks/contracts/261101-${SLUG}-sprint-9.md`),
    setupDescription: 'editing a contract missing frontmatter fields and ACs',
    setup: (ctx) =>
      F.writeFile(ctx.projectDir, `tasks/contracts/261101-${SLUG}-sprint-9.md`, '---\ntask: corpus-demo\n---\n\n# Not a contract\n'),
  },
  {
    name: 'gate1-presence-only-downgrade',
    stdin: edit('src/app.ts'),
    env: { ...PROJ, MEOWKIT_GATE1_PRESENCE_ONLY: '1' },
    setupDescription: 'unstamped plan + signed contract, with the presence-only downgrade set',
    setup: (ctx) => approvedProject(ctx, { stamp: false }),
  },
  {
    name: 'gate1-lean-mode-contract-bypass',
    stdin: edit('src/app.ts'),
    env: { ...PROJ, MEOWKIT_AUTOBUILD_MODE: 'LEAN' },
    setupDescription: 'stamped plan, no contracts dir, MEOWKIT_AUTOBUILD_MODE=LEAN',
    setup: (ctx) => approvedProject(ctx, { withContracts: false }),
    normalizers: ['tmpdir', 'isoTimestamp'],
    sideEffects: ['.meowkit/telemetry/lean-bypass.log'],
  },
  {
    name: 'gate1-backup-directory-blocked',
    stdin: edit('tasks/contracts.bak/app.ts'),
    setupDescription: 'stamped plan + signed contract; the write targets a .bak/ directory',
    setup: (ctx) => approvedProject(ctx),
  },
];

module.exports = cases.map((c) => ({ group: 'gate1', entrypoint: GATE, env: PROJ, ...c }));
