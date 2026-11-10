#!/usr/bin/env node
'use strict';
// harness-inventory.cjs — artifact governance metadata for maintainers of this repository.
//
// Lists harness artifacts with their governance metadata, fails when README or index counts
// drift from reality, and renders the responsibility-by-coverage substrate view. The
// installed kit never invokes it: the audit it serves is a maintainer activity, so it is a
// repo script rather than a verb on every user's CLI.
//
//   node scripts/harness-inventory.cjs [--check] [--json] [--stale] [--critical]
//                                      [--portable-missing] [--emit-counts]
//                                      [--substrate] [--emit]

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const IMPL = path.join(ROOT, 'packages', 'mewkit', 'dist', 'maintainer', 'inventory.js');

async function main(argv) {
  const has = (flag) => argv.includes(`--${flag}`);
  let impl;
  try {
    impl = await import(`file://${IMPL}`);
  } catch {
    process.stderr.write('packages/mewkit/dist is not built; run `npm run build` first\n');
    return 1;
  }
  await impl.inventory({
    json: has('json'),
    stale: has('stale'),
    critical: has('critical'),
    portableMissing: has('portable-missing'),
    check: has('check'),
    emitCounts: has('emit-counts'),
    substrate: has('substrate'),
    emit: has('emit'),
  });
  return process.exitCode ?? 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
