#!/usr/bin/env node
// validate-workflow-evidence.cjs — Validate a MeowKit Workflow Evidence Index file.
//
// The evidence index is an INDEX of pointers + normalized summaries. It NEVER
// approves anything — Gate 1 / Gate 2 remain human authority. This validator
// rejects empty required fields and missing pointers. It performs NO score
// check (score is advisory display only; it is not an approval predicate).
//
// Usage:
//   node .claude/scripts/validate-workflow-evidence.cjs <path-to-evidence.json> --phase fix|cook [--plan-input]
//   node .claude/scripts/validate-workflow-evidence.cjs --self-test
//
// Exit 0 = EVIDENCE_OK
// Exit 1 = EVIDENCE_BLOCKED:<comma-separated reasons>
//
// Message shape mirrors cook/scripts/validate-gate-2.sh (PREFIX:reasons).

const fs = require('fs');

// Canonical risk-flag IDs. Source of truth: .claude/rules/risk-checklist.md
// (the 9-flag table). Kept in sync by Phase 7 parity check.
const RISK_FLAGS = [
  'AUTH', 'AUTHZ', 'DATA_MODEL', 'AUDIT_SEC', 'EXT_SYSTEM',
  'PUBLIC_CONTRACT', 'CROSS_PLATFORM', 'EXISTING_BEHAVIOR', 'WEAK_PROOF',
];

const FIX_DIAGNOSIS_STRINGS = ['exactSymptom', 'reproduction', 'expectedActual', 'rootCause', 'whyNow'];
const COOK_CONTRACT_ARRAYS = ['acceptanceCriteria', 'scopeBoundary', 'constraints', 'touchpoints'];

function nonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function nonEmptyArray(v) {
  return Array.isArray(v) && v.length > 0 && v.every((x) => nonEmptyString(x));
}

// --- Evidence revision / supersession ---------------------------------------
// Mirrors packages/mewkit/src/core/workflow-evidence-revision.ts. That module is the
// semantic owner (it also APPLIES corrections); this is the shipped checker for
// projects with no TypeScript build. A parity test runs both over shared fixtures,
// because two implementations of one rule drift and the looser one quietly wins.
//
// Absent fields mean revision 1 and nothing superseded, so an index written before
// this mechanism existed still validates. The feature is additive by construction.

function currentRevision(ev) {
  return Number.isInteger(ev.evidenceRevision) ? ev.evidenceRevision : 1;
}

function scopeRevision(ev) {
  return Number.isInteger(ev.scopeRevision) ? ev.scopeRevision : 0;
}

function isSuperseded(rec, current) {
  if (!rec) return false;
  const at = Number.isInteger(rec.evidenceRevision) ? rec.evidenceRevision : current;
  return at < current || rec.status === 'superseded';
}

// Returns reason strings for revision/supersession violations.
function supersessionReasons(ev) {
  const reasons = [];
  const current = currentRevision(ev);
  if (!Number.isInteger(current) || current < 1) return ['invalid-evidenceRevision'];
  if (scopeRevision(ev) > current) reasons.push('scopeRevision-ahead-of-evidenceRevision');

  for (const field of ['verification', 'review']) {
    const rec = ev[field];
    if (!rec) continue;
    const at = rec.evidenceRevision;
    if (at !== undefined && (!Number.isInteger(at) || at < 1 || at > current)) {
      reasons.push(`${field}-revision-out-of-range`);
      continue;
    }
    // A stored `valid` over stale evidence is refused, not corrected: whoever wrote it
    // is exactly the caller a later reader would have trusted.
    const staleByRevision = (Number.isInteger(at) ? at : current) < current;
    if (rec.status === 'valid' && staleByRevision) reasons.push(`stale-${field}-marked-valid`);
  }

  const approvals = ev.approvals || {};
  if (approvals.gate2 === 'approved' && isSuperseded(ev.review, current)) {
    reasons.push('gate2-approved-on-superseded-review');
  }
  if (approvals.gate2 === 'approved' && isSuperseded(ev.verification, current)) {
    reasons.push('gate2-approved-on-superseded-verification');
  }
  // Gate 1 covers a SCOPE. Once scope moves past the approval, that approval
  // describes a plan that is no longer the one being built.
  if (approvals.gate1 === 'approved') {
    const approvedAt = Number.isInteger(approvals.gate1Revision) ? approvals.gate1Revision : 0;
    if (scopeRevision(ev) > approvedAt) reasons.push('gate1-approved-before-scope-change');
  }

  return [...new Set(reasons)];
}

// Returns an array of reason strings; empty array means the evidence is OK.
function validate(ev, opts) {
  const reasons = [];
  const phase = opts.phase || ev.skill; // infer from skill when --phase absent

  // --- Universal rules -----------------------------------------------------
  if (!['mk:fix', 'mk:cook'].includes(ev.skill)) reasons.push('invalid-skill');
  if (!nonEmptyString(ev.task)) reasons.push('empty-task');

  const flags = (ev.risk && ev.risk.matchedFlags) || []; // null/absent → treated as [] (no flags matched)
  if (!Array.isArray(flags)) {
    reasons.push('risk.matchedFlags-not-array');
  } else {
    const unknown = flags.filter((f) => !RISK_FLAGS.includes(f));
    if (unknown.length) reasons.push(`unknown-risk-flag(${unknown.join('|')})`);
  }

  // verification.commands must be non-empty by the time review/approval runs.
  const verification = ev.verification || {};
  if (!nonEmptyArray(verification.commands)) reasons.push('empty-verification-commands');

  // Revision / supersession invariants. A returned correction advances the revision
  // and marks Verify + review stale; these keep that stale proof from reading as
  // current at a later gate or at ship preflight.
  reasons.push(...supersessionReasons(ev));

  // Gate 2 cannot be marked approved without a verdict pointer.
  const approvals = ev.approvals || {};
  if (approvals.gate2 === 'approved' && !nonEmptyString((ev.review || {}).verdictPath)) {
    reasons.push('gate2-approved-without-verdict');
  }

  // Side effects detected require a recorded user-decision addendum.
  const review = ev.review || {};
  if (review.sideEffectsDetected === true && !nonEmptyString(review.userDecisionAddendum)) {
    reasons.push('side-effects-without-addendum');
  }

  // --- Skill-specific completeness ----------------------------------------
  if (phase === 'mk:fix' || phase === 'fix') {
    const dx = ev.fixDiagnosis || {};
    for (const field of FIX_DIAGNOSIS_STRINGS) {
      if (!nonEmptyString(dx[field])) reasons.push(`missing-fixDiagnosis.${field}`);
    }
    if (!nonEmptyArray(dx.blastRadius)) reasons.push('missing-fixDiagnosis.blastRadius');
  } else if (phase === 'mk:cook' || phase === 'cook') {
    // Skip contract completeness when the input was an existing plan/phase path —
    // the contract already lives in the plan file.
    if (!opts.planInput) {
      const c = ev.cookContract || {};
      if (!nonEmptyString(c.expectedOutput)) reasons.push('missing-cookContract.expectedOutput');
      for (const dim of COOK_CONTRACT_ARRAYS) {
        if (!nonEmptyArray(c[dim])) reasons.push(`missing-cookContract.${dim}`);
      }
    }
  }

  // NOTE: there is intentionally NO score validation anywhere in this file.
  return reasons;
}

function loadJson(path) {
  if (!fs.existsSync(path)) return { error: `file-not-found(${path})` };
  try {
    return { data: JSON.parse(fs.readFileSync(path, 'utf8')) };
  } catch (e) {
    return { error: 'invalid-json' };
  }
}

function emit(reasons) {
  if (reasons.length === 0) {
    console.log('EVIDENCE_OK');
    return 0;
  }
  console.log(`EVIDENCE_BLOCKED:${reasons.join(',')}`);
  console.log('Evidence indexes pointers only; it never approves. Fill the missing fields and re-run.');
  return 1;
}

function parseArgs(argv) {
  const opts = { phase: null, planInput: false, path: null, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') opts.selfTest = true;
    else if (a === '--plan-input') opts.planInput = true;
    else if (a === '--phase') opts.phase = argv[++i];
    else if (!a.startsWith('--') && !opts.path) opts.path = a;
  }
  return opts;
}

// Embedded self-test: a fully-populated sample (passes) + a broken sample
// (blocks). No test-framework dependency — runnable via `--self-test`.
function selfTest() {
  const validFix = {
    schemaVersion: 1, skill: 'mk:fix', mode: 'auto', task: 'rotate refresh token',
    risk: { matchedFlags: ['AUTH'], requiresHumanApproval: true, reason: 'auth path' },
    fixDiagnosis: {
      exactSymptom: '401 after 24h', reproduction: 'wait 24h then call /me',
      expectedActual: 'expected 200, got 401', rootCause: 'auth.ts:42 no rotation',
      whyNow: 'introduced in abc123', blastRadius: ['session refresh', 'mobile login'],
    },
    verification: { commands: ['npm test -- auth'], overall: 'pass' },
    review: { verdictPath: 'tasks/reviews/x-verdict.md', status: 'PASS', sideEffectsDetected: false },
    approvals: { gate1: 'not_applicable', gate2: 'required', ship: 'required' },
    memory: { fixPatternWritten: true, reviewPatternWritten: false },
  };
  const brokenFix = JSON.parse(JSON.stringify(validFix));
  brokenFix.task = '';
  brokenFix.risk.matchedFlags = ['NOT_A_FLAG'];
  brokenFix.fixDiagnosis.rootCause = '';
  brokenFix.verification.commands = [];

  // Second broken sample exercises the gate/side-effect invariants directly.
  const brokenGate = JSON.parse(JSON.stringify(validFix));
  brokenGate.approvals.gate2 = 'approved';
  brokenGate.review = { verdictPath: '', sideEffectsDetected: true }; // no verdict, no addendum

  // Valid cook sample + a cook sample missing one contract dimension.
  const validCook = {
    schemaVersion: 1, skill: 'mk:cook', mode: 'interactive', task: 'add profile page',
    planPath: 'tasks/plans/x/plan.md', risk: { matchedFlags: [] },
    cookContract: {
      expectedOutput: 'profile route', acceptanceCriteria: ['loads'],
      scopeBoundary: ['no auth'], constraints: ['react'], touchpoints: ['routes.ts'],
    },
    verification: { commands: ['npm test'], overall: 'pass' },
    review: { verdictPath: 'tasks/reviews/y.md', status: 'PASS', sideEffectsDetected: false },
    approvals: { gate1: 'approved', gate2: 'required', ship: 'required' },
  };
  const brokenCook = JSON.parse(JSON.stringify(validCook));
  brokenCook.cookContract.scopeBoundary = [];

  // Supersession samples: a correction advanced the source revision, so the Verify
  // and review evidence recorded at the earlier revision no longer describes the code.
  const supersededReview = JSON.parse(JSON.stringify(validFix));
  supersededReview.evidenceRevision = 2;
  supersededReview.verification.evidenceRevision = 2;
  supersededReview.review.evidenceRevision = 1;
  supersededReview.approvals.gate2 = 'approved';

  const staleMarkedValid = JSON.parse(JSON.stringify(validFix));
  staleMarkedValid.evidenceRevision = 3;
  staleMarkedValid.verification.evidenceRevision = 1;
  staleMarkedValid.verification.status = 'valid';

  const scopeChanged = JSON.parse(JSON.stringify(validCook));
  scopeChanged.evidenceRevision = 2;
  scopeChanged.scopeRevision = 2;
  scopeChanged.approvals.gate1 = 'approved'; // approved before the scope moved

  const correctedThenRerun = JSON.parse(JSON.stringify(validFix));
  correctedThenRerun.evidenceRevision = 2;
  correctedThenRerun.verification.evidenceRevision = 2;
  correctedThenRerun.verification.status = 'valid';
  correctedThenRerun.review.evidenceRevision = 2;
  correctedThenRerun.review.status = 'valid';

  const cases = [
    ['valid-fix', validFix, { phase: 'fix' }, true],
    ['superseded-review-under-gate2', supersededReview, { phase: 'fix' }, false],
    ['stale-verification-marked-valid', staleMarkedValid, { phase: 'fix' }, false],
    ['gate1-approved-before-scope-change', scopeChanged, { phase: 'cook' }, false],
    ['corrected-then-rerun-is-current', correctedThenRerun, { phase: 'fix' }, true],
    ['broken-fix', brokenFix, { phase: 'fix' }, false],
    ['broken-gate', brokenGate, { phase: 'fix' }, false],
    ['valid-cook', validCook, { phase: 'cook' }, true],
    ['broken-cook-dim', brokenCook, { phase: 'cook' }, false],
    ['broken-cook-skipped-by-plan-input', brokenCook, { phase: 'cook', planInput: true }, true],
  ];
  let pass = true;
  for (const [name, ev, opts, expectOk] of cases) {
    const reasons = validate(ev, opts);
    const ok = reasons.length === 0;
    const got = ok === expectOk;
    pass = pass && got;
    console.log(`self-test ${name}: ${got ? 'PASS' : 'FAIL'} [${reasons.join(',')}]`);
  }
  console.log(pass ? 'SELF_TEST_OK' : 'SELF_TEST_FAILED');
  return pass ? 0 : 1;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.selfTest) process.exit(selfTest());
  if (!opts.path) {
    console.log('EVIDENCE_BLOCKED:no-path-given');
    process.exit(1);
  }
  const loaded = loadJson(opts.path);
  if (loaded.error) process.exit(emit([loaded.error]));
  process.exit(emit(validate(loaded.data, opts)));
}

main();
