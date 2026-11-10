#!/usr/bin/env node
'use strict';

/**
 * validate-review-coverage.cjs — Gate 2 narrow extension for REVIEW-SESSION verdicts.
 *
 * Usage: node validate-review-coverage.cjs <verdict.json>
 *
 * If the verdict is NOT a review-session proof bundle (no `review_session` field), this
 * is INERT (exit 0) — normal mk:review/evaluator verdicts are unaffected. For a
 * review-session verdict it validates the embedded coverage block:
 *   - `coverage.report` exists and reports `complete: true` with no gaps;
 *   - `coverage.sha256` matches sha256(JSON.stringify(coverage.report)) — tamper-evident;
 *   - a `PASS` decision requires `evidenceLevel: session-observed` (attested caps below PASS).
 * Otherwise the embedded coverage CONTRADICTS the verdict → exit 2 (Gate 2 blocks).
 *
 * HONESTY: like the rest of Gate 2, this proves the paperwork is present, self-consistent,
 * and internally non-contradictory — NOT that a human approved. The coverage logs are
 * session-writable (anti-accidental, not unforgeable).
 */

const fs = require('fs');
const crypto = require('crypto');

function fail(msg) { process.stderr.write(`review-coverage: ${msg}\n`); process.exit(2); }

const p = process.argv[2];
if (!p) { process.stderr.write('review-coverage: no verdict path given\n'); process.exit(0); }

let verdict;
try { verdict = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (e) { fail(`cannot read verdict JSON: ${e.message}`); }

// Inert for non-review verdicts.
if (!verdict || typeof verdict !== 'object' || !('review_session' in verdict)) process.exit(0);

const cov = verdict.coverage;
if (!cov || typeof cov !== 'object' || !cov.report) fail('review-session verdict has no embedded coverage block');

const report = cov.report;
const recomputed = crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
if (cov.sha256 !== recomputed) fail('embedded coverage hash does not match the coverage report (tampered)');

if (report.complete !== true) fail(`coverage is not complete (${(report.gaps || []).length} gap(s)) — verdict contradicted`);

if (verdict.decision === 'PASS' && report.evidenceLevel !== 'session-observed') {
  fail(`PASS verdict but evidence level is "${report.evidenceLevel}" (session-observed required for PASS)`);
}

process.exit(0);
