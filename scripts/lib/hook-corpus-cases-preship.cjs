'use strict';
// hook-corpus-cases-preship.cjs — ship-check cases, run against the pinned shell
// .claude/hooks/pre-ship.sh.
//
// Only the pass-through case is recorded. The BASE shell ran a review-verdict check before
// anything else and then the whole test suite; the ship check no longer does either, so those
// recordings no longer describe it. Its block paths are covered by tests/guards on all three
// runtimes and by .claude/hooks/__tests__/ship-command.test.cjs.

const F = require('./hook-corpus-fs.cjs');
const { PROJECT_DIR_ENV: PROJ, bash } = require('./hook-corpus-payload.cjs');

const PRESHIP = '.claude/hooks/pre-ship.sh';

const cases = [
  {
    name: 'preship-non-ship-command',
    stdin: bash('ls -la'),
    setupDescription: 'git repo with a staged source file; the command is not a ship command',
    setup: (ctx) => F.initGit(ctx.projectDir, ctx.home, { commit: [['README.md', '# corpus\n']], stage: [['src/app.ts', 'export const a = 1;\n']] }),
  },
];

module.exports = cases.map((c) => ({ group: 'gate2-preship', entrypoint: PRESHIP, env: PROJ, ...c }));
