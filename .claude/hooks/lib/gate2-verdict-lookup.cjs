'use strict';
// gate2-verdict-lookup.cjs — which verdict is supposed to authorize this ship?
//
// "Most recent verdict wins" is the one answer this must never give: a stale
// verdict from unrelated work would silently authorize the change in front of
// it. The explicit active-plan pointer is the only honest source, and an absent
// pointer fails closed.
//
// Security verdicts are looked up separately and deliberately excluded from the
// authorizing count: a security BLOCK is independently ship-blocking, and a
// security PASS does not by itself authorize anything.

const fs = require('node:fs');
const path = require('node:path');

const { sessionStateFile } = require('./meowkit-paths.cjs');

const DATE_PREFIX = /^[0-9]{6}(?:-[0-9]{4})?-(.+)$/;

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

/**
 * The pointer, as written. Both the JSON form and the bare-path file are read so
 * the completion check and the ship guard resolve the same plan from the same
 * place, and both are resolved through the state resolver, which also accepts a
 * pre-move location — a project that wrote its pointer before session markers
 * moved must not have this fail closed on it mid-session.
 */
function activePlan(root) {
  const jsonPath = sessionStateFile('active-plan.json', root);
  if (isFile(jsonPath)) {
    const d = readJson(jsonPath);
    if (d) {
      const value = String(d.path || d.slug || '').trim();
      if (value) return value;
    }
  }
  const flat = sessionStateFile('active-plan', root);
  if (isFile(flat)) {
    try { return fs.readFileSync(flat, 'utf8').replace(/[\n\r]/g, ''); } catch { return ''; }
  }
  return '';
}

/** Strip the date prefix so every caller derives the same slug from one pointer. */
function slugFromPointer(pointer) {
  const raw = String(pointer || '').trim().replace(/\/+$/, '');
  const last = raw.split('/').pop() || '';
  const m = last.match(DATE_PREFIX);
  return m ? m[1] : last;
}

/** Date-prefixed files in `tasks/reviews/` matching `<date>-<slug><suffix>`. */
function reviewsMatching(root, slug, suffix) {
  const dir = path.join(root, 'tasks/reviews');
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return []; }
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^[0-9].*-${escaped}${suffix.replace(/\./g, '\\.')}$`);
  return entries.filter((e) => re.test(e)).sort()
    .map((e) => path.posix.join('tasks/reviews', e))
    .filter((rel) => isFile(path.join(root, rel)));
}

const securityVerdicts = (root, slug) => reviewsMatching(root, slug, '-security-verdict.md');

/**
 * `{ count, verdict }` over both authorizing forms. The suffix order mirrors how
 * the two candidate sets are read, so the reported verdict is stable when a plan
 * carries exactly one — and a count above one is reported rather than resolved.
 */
function authorizingVerdicts(root, slug) {
  const found = [
    ...reviewsMatching(root, slug, '-verdict.md'),
    ...reviewsMatching(root, slug, '-evalverdict.md'),
  ];
  return { count: found.length, verdict: found.length ? found[found.length - 1] : '' };
}

/** The verdict's sibling JSON, when a proof bundle was composed alongside it. */
const verdictJsonFor = (verdictRel) => verdictRel.replace(/\.md$/, '.json');

/** Does the verdict name this revision? Matched as a hex prefix so short or full SHA both count. */
function namesRevision(root, verdictRel, sha) {
  let content;
  try { content = fs.readFileSync(path.join(root, verdictRel), 'utf8'); } catch { return false; }
  return new RegExp(`\\b${sha}[0-9a-f]*\\b`, 'i').test(content);
}

module.exports = {
  activePlan,
  authorizingVerdicts,
  namesRevision,
  reviewsMatching,
  securityVerdicts,
  slugFromPointer,
  verdictJsonFor,
};
