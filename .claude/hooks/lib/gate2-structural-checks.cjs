'use strict';
// gate2-structural-checks.cjs — the delegated halves of the ship proof, plus the
// one block-message shape they all share.
//
// Verdict and evidence parsing is NOT re-implemented here. The verdict parser is
// validate-gate-2.cjs; the evidence index and the review-coverage bundle have
// their own in-repo validators, which are called as child processes because they
// are the canonical readers of those formats and duplicating them is how the two
// answers would start to disagree.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { validateGate2 } = require('./validate-gate-2.cjs');
const { verdictJsonFor } = require('./gate2-verdict-lookup.cjs');

const EVIDENCE_VALIDATOR = '.claude/scripts/validate-workflow-evidence.cjs';
const REVIEW_COVERAGE_VALIDATOR = '.claude/scripts/validate-review-coverage.cjs';

/**
 * Every block says what it could not prove AND what it never claimed to prove.
 * The second half is not boilerplate: a reader who takes a passing structural
 * check for a human approval has misread the gate.
 */
const BLOCK_FOOTER = [
  '',
  'Gate 2 is human-approved and has no exceptions (.claude/rules/gate-rules.md).',
  'This check proves only that the paperwork exists and is self-consistent;',
  'it does not and cannot prove a human approved anything.',
];

function block(...reason) {
  return {
    exit: 2,
    stdout: [],
    stderr: ['@@GATE_BLOCK@@', 'Gate 2 structural check FAILED — ship blocked.', '', ...reason, ...BLOCK_FOOTER],
  };
}

function isFile(root, rel) {
  try { return fs.statSync(path.join(root, rel)).isFile(); } catch { return false; }
}

/** Run an in-repo validator with this node binary. `{ ok, out }` with streams merged. */
function runValidator(root, validatorRel, args) {
  const r = spawnSync(process.execPath, [path.join(root, validatorRel), ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`.replace(/\n$/, '');
  return { ok: !r.error && r.status === 0, out };
}

/** Candidate evidence index locations; the last one present wins. */
function findEvidence(root, activePlan, slug) {
  const candidates = [path.posix.join('tasks/plans', path.basename(activePlan), 'reports/evidence/workflow-evidence.json')];
  try {
    for (const dir of fs.readdirSync(path.join(root, '.claude/session-state/evidence')).sort()) {
      if (dir.includes(slug)) candidates.push(path.posix.join('.claude/session-state/evidence', dir, 'workflow-evidence.json'));
    }
  } catch {
    // No session evidence tree: the index is optional.
  }
  return candidates.filter((rel) => isFile(root, rel)).pop() || '';
}

/** The verdict itself must name no FAIL dimension, no critical issue and no unreviewed side effect. */
function checkVerdictContent(root, verdict) {
  const abs = path.join(root, verdict);
  const result = validateGate2({ input: abs, content: fs.readFileSync(abs, 'utf8') });
  if (result.exit === 0) return null;
  return block(
    `Verdict ${verdict} does not satisfy Gate 2's structural conditions:`,
    `  ${[...result.stdout, ...result.stderr].join('\n')}`,
    'Fix: resolve the FAIL/critical/security items, re-review, then re-present Gate 2.',
  );
}

/** The evidence index is optional; when present it must not contradict the verdict. */
function checkEvidenceIndex(root, activePlan, slug) {
  const evidence = findEvidence(root, activePlan, slug);
  if (!evidence || !isFile(root, EVIDENCE_VALIDATOR)) return null;
  const { ok, out } = runValidator(root, EVIDENCE_VALIDATOR, [evidence, '--phase', 'cook']);
  if (ok) return null;
  return block(
    'Workflow evidence index disagrees with the verdict, or is incomplete:',
    `  ${out}`,
    `Fix: complete the evidence index at ${evidence} before shipping.`,
  );
}

/**
 * A review-session proof bundle carries its coverage inline, so the coverage
 * must not contradict the verdict it sits beside. Inert for a normal verdict,
 * which has no sibling JSON — this couples coverage to the verdict at the gate
 * rather than only where the bundle was composed.
 */
function checkReviewCoverage(root, verdict) {
  const verdictJson = verdictJsonFor(verdict);
  if (!isFile(root, verdictJson) || !isFile(root, REVIEW_COVERAGE_VALIDATOR)) return null;
  const { ok, out } = runValidator(root, REVIEW_COVERAGE_VALIDATOR, [verdictJson]);
  if (ok) return null;
  return block(
    'Review-session verdict is contradicted by its embedded coverage block:',
    `  ${out}`,
    "Fix: complete coverage (session-observed for PASS) and recompose with 'mewkit review compose'.",
  );
}

module.exports = {
  BLOCK_FOOTER,
  block,
  checkEvidenceIndex,
  checkReviewCoverage,
  checkVerdictContent,
  findEvidence,
  isFile,
  runValidator,
};
