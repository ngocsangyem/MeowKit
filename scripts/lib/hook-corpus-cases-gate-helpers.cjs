'use strict';
// hook-corpus-cases-gate-helpers.cjs — CLI cases for the three gate helper
// scripts that become node modules under .claude/hooks/lib/:
// validate-contract.cjs, check-contract-signed.cjs and validate-gate-2.cjs.
//
// One valid and one invalid input each, plus
// check-contract-signed's two defer paths and its LEAN bypass, since the ported
// module is required directly by gate-enforcement.cjs and a wrong defer would
// turn the contract gate off silently.

const F = require('./hook-corpus-fs.cjs');
const { CONTRACT, PLAN, PROJECT_DIR_ENV: PROJ, SLUG } = require('./hook-corpus-payload.cjs');

const VALIDATE_CONTRACT = '.claude/skills/sprint-contract/scripts/validate-contract.sh';
const CHECK_SIGNED = '.claude/skills/sprint-contract/scripts/check-contract-signed.sh';
const VALIDATE_GATE2 = '.claude/skills/cook/scripts/validate-gate-2.sh';
const VERDICT = `tasks/reviews/261101-${SLUG}-verdict.md`;
const INVALID_CONTRACT = '---\ntask: corpus-demo\n---\n\n# Not a contract\n';

const planWithContract = (status, signed) => (ctx) => {
  F.writeFile(ctx.projectDir, PLAN, F.planBody(SLUG));
  F.writeFile(ctx.projectDir, CONTRACT, F.contractBody({ slug: SLUG, status, signed }));
};

const cases = [
  {
    group: 'gate-helper-validate-contract',
    entrypoint: VALIDATE_CONTRACT,
    name: 'validate-contract-valid',
    args: [CONTRACT],
    setupDescription: 'a schema-valid contract: 8 frontmatter fields, 5 sections, 5 ACs',
    setup: (ctx) => F.writeFile(ctx.projectDir, CONTRACT, F.contractBody({ slug: SLUG })),
  },
  {
    group: 'gate-helper-validate-contract',
    entrypoint: VALIDATE_CONTRACT,
    name: 'validate-contract-invalid',
    args: [`tasks/contracts/261101-${SLUG}-sprint-9.md`],
    setupDescription: 'a contract missing frontmatter fields, sections and ACs',
    setup: (ctx) => F.writeFile(ctx.projectDir, `tasks/contracts/261101-${SLUG}-sprint-9.md`, INVALID_CONTRACT),
  },
  {
    group: 'gate-helper-validate-contract',
    entrypoint: VALIDATE_CONTRACT,
    name: 'validate-contract-usage-error',
    args: [],
    setupDescription: 'no argument at all — the usage-error exit',
    setup: () => {},
    normalizers: ['tmpdir'],
  },
  {
    group: 'gate-helper-check-contract-signed',
    entrypoint: CHECK_SIGNED,
    name: 'check-contract-signed-valid',
    setupDescription: 'a date-prefixed plan dir with a signed contract for its slug',
    setup: planWithContract('signed', true),
  },
  {
    group: 'gate-helper-check-contract-signed',
    entrypoint: CHECK_SIGNED,
    name: 'check-contract-signed-invalid',
    setupDescription: 'a date-prefixed plan dir whose only contract is status: draft',
    setup: planWithContract('draft', false),
  },
  {
    group: 'gate-helper-check-contract-signed',
    entrypoint: CHECK_SIGNED,
    name: 'check-contract-signed-no-plans-dir',
    setupDescription: 'no tasks/plans/ at all — defers to Gate 1',
    setup: () => {},
  },
  {
    group: 'gate-helper-check-contract-signed',
    entrypoint: CHECK_SIGNED,
    name: 'check-contract-signed-lean-bypass',
    env: { ...PROJ, MEOWKIT_AUTOBUILD_MODE: 'LEAN' },
    setupDescription: 'a plan dir with a draft contract, with MEOWKIT_AUTOBUILD_MODE=LEAN set',
    setup: planWithContract('draft', false),
    normalizers: ['tmpdir', 'isoTimestamp'],
    sideEffects: ['.meowkit/telemetry/lean-bypass.log'],
  },
  {
    group: 'gate-helper-validate-gate-2',
    entrypoint: VALIDATE_GATE2,
    name: 'validate-gate-2-valid',
    args: [VERDICT],
    setupDescription: 'a verdict with no FAIL dimension and 0 critical',
    setup: (ctx) => F.writeFile(ctx.projectDir, VERDICT, F.verdictBody({ slug: SLUG, revision: 'abc1234' })),
  },
  {
    group: 'gate-helper-validate-gate-2',
    entrypoint: VALIDATE_GATE2,
    name: 'validate-gate-2-invalid',
    args: [VERDICT],
    setupDescription: 'a verdict carrying a FAIL dimension',
    setup: (ctx) => F.writeFile(ctx.projectDir, VERDICT, F.verdictBody({ slug: SLUG, revision: 'abc1234', fail: true })),
  },
  {
    group: 'gate-helper-validate-gate-2',
    entrypoint: VALIDATE_GATE2,
    name: 'validate-gate-2-file-missing',
    args: ['tasks/reviews/does-not-exist-verdict.md'],
    setupDescription: 'a verdict path that does not exist',
    setup: () => {},
  },
];

module.exports = cases.map((c) => ({ env: PROJ, stdin: null, ...c }));
