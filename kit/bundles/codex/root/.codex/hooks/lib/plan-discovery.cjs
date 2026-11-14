'use strict';
// plan-discovery.cjs — find the plan files the write gate asks about.
//
// Two layouts are supported because both exist in the wild: the nested
// `tasks/plans/<date-slug>/plan.md` form and the older flat `tasks/plans/*.md`
// form. The nested form is listed first so it wins a tie, which matches how the
// two candidate sets are read.
//
// Each candidate is proved to be a regular FILE rather than merely present. A
// directory literally named `plan.md` would otherwise satisfy the existence
// check, and an unmatched pattern must not count as a match.

const fs = require('node:fs');
const path = require('node:path');

const PLANS_REL = 'tasks/plans';

function statOf(p) {
  try { return fs.statSync(p); } catch { return null; }
}

function isDir(p) {
  const s = statOf(p);
  return s !== null && s.isDirectory();
}

/** Every plan file present, nested form first, each set sorted by name. */
function planFiles(root) {
  const plansDir = path.join(root, PLANS_REL);
  let entries;
  try { entries = fs.readdirSync(plansDir).sort(); } catch { return []; }

  const nested = entries
    .filter((e) => isDir(path.join(plansDir, e)))
    .map((e) => path.posix.join(PLANS_REL, e, 'plan.md'));
  const flat = entries
    .filter((e) => e.endsWith('.md'))
    .map((e) => path.posix.join(PLANS_REL, e));

  return [...nested, ...flat].filter((rel) => {
    const s = statOf(path.join(root, rel));
    return s !== null && s.isFile();
  });
}

/** True when at least one real plan file exists. */
const hasPlan = (root) => planFiles(root).length > 0;

/**
 * The most recently modified plan, which is the one an approval receipt is
 * checked against. Modification time is the only ordering available: a plan
 * directory's date prefix records when it was created, not when its scope last
 * changed, and it is scope changes that invalidate an approval.
 */
function newestPlan(root) {
  let newest = '';
  let newestMtime = -Infinity;
  for (const rel of planFiles(root)) {
    const s = statOf(path.join(root, rel));
    if (s === null) continue;
    // Strictly newer, so the first candidate wins a tie.
    if (s.mtimeMs > newestMtime) {
      newest = rel;
      newestMtime = s.mtimeMs;
    }
  }
  return newest;
}

module.exports = { hasPlan, newestPlan, planFiles };
