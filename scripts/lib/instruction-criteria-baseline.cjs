'use strict';
// instruction-criteria-baseline.cjs — growth-only checking. A baseline records, per criterion
// and file, how many findings existed when it was written; a later run fails only where a
// file has more. The always-on ceiling and the pinned-text hash are never baselined.

const fs = require('node:fs');

const NEVER_BASELINED = new Set(['A8', 'pinned']);

/** A line that carries `criteria-allow: A14` (or a comma list) waives that criterion there. */
function allowed(text, finding) {
  const line = text.split('\n')[finding.line - 1] || '';
  const m = line.match(/criteria-allow:\s*([A-Z0-9, ]+)/);
  return Boolean(m && m[1].split(/[ ,]+/).includes(finding.criterion));
}

function counts(findings) {
  const out = {};
  for (const f of findings) {
    if (NEVER_BASELINED.has(f.criterion)) continue;
    out[f.criterion] = out[f.criterion] || {};
    out[f.criterion][f.file] = (out[f.criterion][f.file] || 0) + 1;
  }
  return out;
}

/** Findings left after the baseline: every finding of a (criterion, file) pair that grew. */
function overBaseline(findings, baseline) {
  const now = counts(findings);
  return findings.filter((f) => {
    if (NEVER_BASELINED.has(f.criterion)) return true;
    const allowedCount = (baseline[f.criterion] || {})[f.file] || 0;
    return now[f.criterion][f.file] > allowedCount;
  });
}

/**
 * Entries the baseline allows above what the trees now have. A fixed file must lower its
 * count, or the room left over would let a different finding in unnoticed.
 */
function looseEntries(findings, baseline, trees) {
  const now = counts(findings);
  const out = [];
  for (const [criterion, files] of Object.entries(baseline)) {
    for (const [file, recorded] of Object.entries(files)) {
      if (!trees.some((t) => file.startsWith(`${t}/`))) continue;
      const n = (now[criterion] || {})[file] || 0;
      if (n < recorded) out.push({ criterion, file, recorded, now: n });
    }
  }
  return out;
}

function readBaseline(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8')).counts || {};
}

/** Write counts for the checked trees, keeping recorded entries of trees not checked this run. */
function writeBaseline(file, findings, trees) {
  const sorted = {};
  const c = counts(findings);
  const kept = fs.existsSync(file) ? readBaseline(file) : {};
  for (const [criterion, files] of Object.entries(kept)) {
    for (const [f, n] of Object.entries(files)) {
      if (trees.some((t) => f.startsWith(`${t}/`))) continue;
      c[criterion] = c[criterion] || {};
      c[criterion][f] = n;
    }
  }
  for (const k of Object.keys(c).sort()) {
    sorted[k] = Object.fromEntries(Object.entries(c[k]).sort(([a], [b]) => a.localeCompare(b)));
  }
  const about = 'Findings that existed when this file was written. check-instruction-criteria.cjs --baseline fails only where a file has more. Regenerate with --write-baseline after fixing text, never to hide new findings.';
  fs.writeFileSync(file, `${JSON.stringify({ about, counts: sorted }, null, 2)}\n`);
}

module.exports = { allowed, looseEntries, overBaseline, readBaseline, writeBaseline };
