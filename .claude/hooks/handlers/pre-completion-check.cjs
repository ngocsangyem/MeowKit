'use strict';
// pre-completion-check.cjs — refuse to end a session that has no verification
// evidence, up to a bounded number of attempts.
//
// Enforcement is opt-in per plan: it fires only when the orchestrating skill has
// explicitly marked verification as required. Without that marker a session is
// free to end, because most sessions are not builds and a blanket block would
// make stopping a negotiation.
//
// It answers with a block DECISION rather than a failing exit, which is this
// event's channel for "do not stop yet". The attempt counter is what keeps that
// from becoming a loop: after the cap it degrades to a nudge and lets the
// session end.
//
// The verdict parser is required in-process rather than spawned, so this
// handler and the ship guard cannot disagree about what a blocking verdict is.

const fs = require('node:fs');
const path = require('node:path');

const { validateGate2 } = require('../lib/validate-gate-2.cjs');
const V = require('../lib/gate2-verdict-lookup.cjs');
const { telemetryDir } = require('../lib/meowkit-paths.cjs');

const ATTEMPTS_REL = 'session-state/precompletion-attempts.json';
const REQUIRED_REL = 'session-state/verification-required.json';
const MAX_ATTEMPTS = 3;

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

function writeAttempts(root, slug, value) {
  const file = path.join(root, ATTEMPTS_REL);
  const data = readJson(file, {});
  if (value === null) delete data[slug];
  else data[slug] = value;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  } catch {
    // An unwritable counter costs the cap, not correctness.
  }
}

const slugOf = (raw) => {
  const m = String(raw || '').trim().match(/^[0-9]{6}(?:-[0-9]{4})?-(.+)$/);
  return m ? m[1] : String(raw || '').trim();
};

/** The plan this session is answerable to, from the explicit pointers only. */
function resolvePlan(root) {
  const activePlan = V.activePlan(root);
  if (activePlan) return { activePlan, slug: V.slugFromPointer(activePlan) };
  const required = readJson(path.join(root, REQUIRED_REL), {});
  const slug = slugOf(required.slug || required.plan_slug || '');
  return { activePlan: '', slug };
}

/**
 * A recent test pass in the shared trace history also counts. Only the tail is
 * scanned: the history can be large and an old pass is not evidence about this
 * session.
 */
function traceShowsTestPass(root) {
  try {
    const lines = fs.readFileSync(path.join(telemetryDir(root), 'trace-log.jsonl'), 'utf8').split('\n');
    return lines.slice(-500).some((l) => /"test_result":[ \t]*"pass"|"exit_code":[ \t]*0.*"test"/.test(l));
  } catch {
    return false;
  }
}

/** Any one of these satisfies verification. */
function hasEvidence(root, slug) {
  if (V.reviewsMatching(root, slug, '-evalverdict.md').length) return true;
  if (V.reviewsMatching(root, slug, '-verdict.md').length) return true;
  if (traceShowsTestPass(root)) return true;
  const dir = path.join(root, 'tasks/contracts');
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return false; }
  const re = new RegExp(`^.*-${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-sprint-.*\\.md$`);
  return entries.filter((e) => re.test(e)).some((e) => {
    const status = (fs.readFileSync(path.join(dir, e), 'utf8').match(/^status:[ \t]*(.*)$/m) || [])[1];
    return status !== undefined && ['signed', 'amended'].includes(status.replace(/[ \t]/g, ''));
  });
}

const blockDecision = (reason) => ({ stdout: `${JSON.stringify({ decision: 'block', reason })}\n`, feedback: true });

module.exports = function preCompletionCheck(ctx) {
  const root = ctx.root;
  if (process.env.MEOWKIT_PRECOMPLETION === 'off') return null;

  const density = process.env.MEOWKIT_AUTOBUILD_MODE || '';
  if (density === 'MINIMAL') return null;
  if (density === 'LEAN') {
    return { stderr: 'Note: verification not enforced in LEAN mode. Ensure you ran tests / evaluator before stopping.\n' };
  }

  // Only the orchestrating skill decides that a session owes verification.
  const required = readJson(path.join(root, REQUIRED_REL), null);
  if (required === null) return null;
  if (required.required === false) return null;

  const { activePlan, slug } = resolvePlan(root);
  if (!slug) {
    return { stderr: 'verification-required set but active plan slug missing; skipping block.\n' };
  }

  // A security block must stop completion even when another artifact would
  // otherwise satisfy verification, so it is checked before the evidence.
  for (const securityVerdict of V.securityVerdicts(root, slug)) {
    if (validateGate2({ input: path.join(root, securityVerdict) }).exit !== 0) {
      return blockDecision(
        `Security verdict '${securityVerdict}' blocks active plan '${activePlan || slug}'. `
        + 'Resolve the finding and obtain a new PASS security verdict before stopping.',
      );
    }
  }

  if (hasEvidence(root, slug)) {
    writeAttempts(root, slug, null);
    return null;
  }

  const attempts = Number(readJson(path.join(root, ATTEMPTS_REL), {})[slug] || 0);
  if (attempts < MAX_ATTEMPTS) {
    const next = attempts + 1;
    writeAttempts(root, slug, next);
    return blockDecision(
      `Verification missing for active plan '${activePlan || slug}' (attempt ${next}/${MAX_ATTEMPTS}). `
      + 'No evaluator verdict, no signed contract, and no test-pass markers found in this session. '
      + 'Run tests, invoke /mk:evaluate, OR sign the sprint contract before stopping.',
    );
  }

  // Past the cap: nudge and let the session end. The host assigns a new session
  // id for every blocked stop, so holding the line here would loop forever.
  writeAttempts(root, slug, null);
  return {
    stderr: [
      '@@PRECOMPLETION_NUDGE@@',
      `Max PreCompletion re-entries reached (${attempts}/${MAX_ATTEMPTS}) for '${activePlan}'. Allowing stop to prevent infinite loop.`,
      'WARN: session ending without verification evidence. This is a soft nudge — please run verification before your next session.',
      '',
    ].join('\n'),
  };
};
