#!/usr/bin/env node
'use strict';
// docs-manifest.cjs — generate or drift-check the docs reference manifest.
//
// The manifest describes this repository's own docs tree, and only this repository's CI
// reads it. It used to be a verb on the published CLI, where every user had to scroll past
// it in `--help` to find the commands meant for them. The implementation is unchanged and
// still lives with the rest of the engine; this script is the maintainer's way in.
//
//   node scripts/docs-manifest.cjs [--check] [--write] [--json]

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const IMPL = path.join(ROOT, 'packages', 'mewkit', 'dist', 'maintainer', 'docs-manifest.js');

async function main(argv) {
  const has = (flag) => argv.includes(`--${flag}`);
  let impl;
  try {
    impl = await import(`file://${IMPL}`);
  } catch {
    process.stderr.write('packages/mewkit/dist is not built; run `npm run build` first\n');
    return 1;
  }
  // The implementation sets process.exitCode on drift; mirror it rather than re-deciding.
  impl.docsManifest({ check: has('check'), write: has('write'), json: has('json') });
  return process.exitCode ?? 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
