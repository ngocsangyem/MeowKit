'use strict';
// hook-corpus-cases-feedback.cjs — cases for the feedback handler post-write.cjs, which exits 2
// with its finding on stderr. The dispatcher must pass its output through rather than swallow
// it, so the exact streams matter.

const F = require('./hook-corpus-fs.cjs');
const { PROJECT_DIR_ENV: PROJ, postEdit } = require('./hook-corpus-payload.cjs');

const DIRTY_TS = ['export function get(x: any) {', '  return x as any;', '}', ''].join('\n');
const CLEAN_TS = ['export function get(x: string): string {', '  return x.trim();', '}', ''].join('\n');

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

module.exports = postWriteCases;
