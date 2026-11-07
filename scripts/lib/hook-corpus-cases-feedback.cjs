'use strict';
// hook-corpus-cases-feedback.cjs — cases for the two feedback handlers: post-write.cjs, which exits 2 with its finding on stderr, and
// pre-completion-check.cjs, which blocks with a JSON decision on stdout.
//
// These are the two observers whose output the node dispatcher must pass
// through rather than swallow, so their exact streams matter.

const F = require('./hook-corpus-fs.cjs');
const { PLAN, PLAN_DIR, PROJECT_DIR_ENV: PROJ, SLUG, postEdit, stopEvent } = require('./hook-corpus-payload.cjs');

const DIRTY_TS = ['export function get(x: any) {', '  return x as any;', '}', ''].join('\n');
const CLEAN_TS = ['export function get(x: string): string {', '  return x.trim();', '}', ''].join('\n');

/** The state pre-completion-check requires before it will consider blocking. */
function verificationRequired(ctx) {
  F.writeFile(ctx.projectDir, PLAN, F.planBody(SLUG));
  F.writeFile(ctx.projectDir, 'session-state/active-plan.json', F.activePlanPointer(PLAN_DIR));
  F.writeFile(
    ctx.projectDir,
    'session-state/verification-required.json',
    `${JSON.stringify({ required: true, slug: `261101-${SLUG}` })}\n`,
  );
}

const postWriteCases = [
  {
    name: 'postwrite-blocked-pattern',
    stdin: postEdit('{{TMP}}/src/app.ts'),
    setupDescription: 'a written .ts file containing `: any` and `as any`',
    setup: (ctx) => F.writeFile(ctx.projectDir, 'src/app.ts', DIRTY_TS),
  },
  {
    name: 'postwrite-clean-file',
    stdin: postEdit('{{TMP}}/src/app.ts'),
    setupDescription: 'a written .ts file with no blocked pattern',
    setup: (ctx) => F.writeFile(ctx.projectDir, 'src/app.ts', CLEAN_TS),
  },
].map((c) => ({ group: 'post-write', entrypoint: '.claude/hooks/post-write.sh', env: PROJ, ...c }));

const preCompletionCases = [
  {
    name: 'precompletion-security-verdict-block',
    stdin: stopEvent(),
    setupDescription: 'verification-required + active-plan pointer + a FAIL security verdict for the slug',
    setup: (ctx) => {
      verificationRequired(ctx);
      F.writeFile(
        ctx.projectDir,
        `tasks/reviews/261101-${SLUG}-security-verdict.md`,
        F.verdictBody({ slug: SLUG, fail: true, kind: 'security' }),
      );
    },
  },
  {
    name: 'precompletion-clean-signed-contract',
    stdin: stopEvent(),
    setupDescription: 'verification-required + active-plan pointer + a signed sprint contract, no security verdict',
    setup: (ctx) => {
      verificationRequired(ctx);
      F.writeFile(ctx.projectDir, `tasks/contracts/261101-${SLUG}-sprint-1.md`, F.contractBody({ slug: SLUG }));
    },
  },
].map((c) => ({
  group: 'pre-completion-check',
  entrypoint: '.claude/hooks/pre-completion-check.sh',
  env: PROJ,
  sideEffects: ['session-state/precompletion-attempts.json'],
  ...c,
}));

module.exports = [...postWriteCases, ...preCompletionCases];
