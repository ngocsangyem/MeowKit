#!/usr/bin/env node
'use strict';
// sync-hook-core.cjs — copy the shared safety-hook core and the workflow-* skill helpers into
// each non-Claude bundle.
//
// The Codex and Cursor bundles are installed on their own, without `.claude/`, so their
// shells cannot require the canonical library in place. They carry a byte-for-byte copy of the
// files `.claude/hooks/core-closure.json` lists under `bundled` (and `helpers`, into `helperBinDirs`), so one
// edit to the canonical file is one edit everywhere once this has run.
//
//   node scripts/sync-hook-core.cjs           write the copies
//   node scripts/sync-hook-core.cjs --check   exit 1 when any copy is missing or differs

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, '.claude/hooks/lib');
const CLOSURE = path.join(ROOT, '.claude/hooks/core-closure.json');

/** `{ dir, file, state }` per bundle copy, where state is `same`, `missing` or `differs`. */
function bundleCopies(root = ROOT) {
  const closure = JSON.parse(fs.readFileSync(path.join(root, '.claude/hooks/core-closure.json'), 'utf8'));
  const out = [];
  // The hook core lands in each bundle's hooks/lib; the workflow-* helpers its skills run
  // land in scripts/bin, flat, so their `./x.cjs` requires resolve beside them.
  const sets = [
    [closure.bundleLibDirs, closure.bundled],
    [closure.helperBinDirs || [], closure.helpers || []],
  ];
  for (const [dirs, files] of sets) {
    for (const dir of dirs) {
      for (const file of files) {
        const source = fs.readFileSync(path.join(root, '.claude/hooks/lib', file));
        const target = path.join(root, dir, file);
        let state = 'same';
        if (!fs.existsSync(target)) state = 'missing';
        else if (!fs.readFileSync(target).equals(source)) state = 'differs';
        out.push({ dir, file, state, source, target });
      }
    }
  }
  return out;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const stale = bundleCopies().filter((c) => c.state !== 'same');
  if (check) {
    for (const c of stale) process.stderr.write(`${c.state}: ${c.dir}/${c.file}\n`);
    if (stale.length) process.stderr.write(`Run: node scripts/sync-hook-core.cjs (source: ${path.relative(ROOT, LIB)}, list: ${path.relative(ROOT, CLOSURE)})\n`);
    process.exit(stale.length ? 1 : 0);
  }
  for (const c of stale) {
    fs.mkdirSync(path.dirname(c.target), { recursive: true });
    fs.writeFileSync(c.target, c.source);
    fs.chmodSync(c.target, 0o755);
    process.stdout.write(`wrote ${c.dir}/${c.file}\n`);
  }
}

module.exports = { bundleCopies };
