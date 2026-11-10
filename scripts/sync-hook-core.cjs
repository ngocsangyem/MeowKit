#!/usr/bin/env node
'use strict';
// sync-hook-core.cjs — copy the shared safety-hook core into each non-Claude hook bundle.
//
// The Codex and Cursor bundles are installed on their own, without `.claude/`, so their
// shells cannot require the canonical library in place. They carry a byte-for-byte copy of the
// files `.claude/hooks/core-closure.json` lists under `bundled`, in the same layout, so one
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
  for (const dir of closure.bundleLibDirs) {
    for (const file of closure.bundled) {
      const source = fs.readFileSync(path.join(root, '.claude/hooks/lib', file));
      const target = path.join(root, dir, file);
      let state = 'same';
      if (!fs.existsSync(target)) state = 'missing';
      else if (!fs.readFileSync(target).equals(source)) state = 'differs';
      out.push({ dir, file, state, source, target });
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
