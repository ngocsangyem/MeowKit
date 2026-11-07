'use strict';
// gate2-check.cjs — the structural ship-boundary proof.
//
// WHAT THIS PROVES
//   A verdict file for the active plan exists, names no FAIL dimension and no
//   security BLOCK, is bound to the revision being shipped (it names current
//   HEAD), and — when a workflow-evidence index is present — that the index does
//   not contradict it.
//
// WHAT THIS DOES NOT PROVE
//   That a HUMAN approved anything. Every artifact read here, including the
//   revision the verdict names, is writable by the same session that produced
//   the change, so a session can author all of them. The revision binding is
//   anti-accidental — it catches a stale verdict from an earlier state — not
//   unforgeable. A pass means "the paperwork is present, self-consistent, and
//   bound to this revision", never "a human approved this".
//
// Returns `{ exit, stdout, stderr }` line arrays so a hook can act on the
// decision in-process. exit 2 is the only blocking value: exit 1 is advisory
// and would let the ship happen after printing "BLOCKED".

const path = require('node:path');

const V = require('./gate2-verdict-lookup.cjs');
const { changeSet, firstShipFile, headSha, isNoShip, isShipCommand } = require('./gate2-change-set.cjs');
const { validateGate2 } = require('./validate-gate-2.cjs');
const S = require('./gate2-structural-checks.cjs');

const allow = (stdout = []) => ({ exit: 0, stdout, stderr: [] });

/** Classify what the command ships, or report that the question is unanswerable. */
function resolveShipScope(root, command) {
  const { changed, baseMissing } = changeSet(root, command);
  if (baseMissing) {
    return {
      blocked: S.block(
        'Cannot determine what this push/merge would ship.',
        'No upstream is configured and origin/HEAD did not resolve, so the',
        'commit range is unknown — and an unknown range cannot be classified.',
        'Fix: set an upstream (git push -u origin <branch>) and retry.',
      ),
    };
  }
  // A genuinely empty commit or push is git's error to report, not a gate
  // bypass; blocking here would replace git's clear message with a vague one.
  if (changed.length === 0) return { done: allow() };

  // ANY ship-capable file makes the whole change ship-capable: a mixed change is
  // not partially exempt, because the source file in it still ships.
  const shipFile = firstShipFile(changed);
  if (!shipFile) {
    return { done: allow(['Gate 2: N/A — no-ship change (documentation, reports, and markdown only). Not skipped, not applicable.']) };
  }
  return { shipFile };
}

/** The plan this ship is answerable to, from the explicit pointer only. */
function resolvePlan(root, shipFile) {
  const activePlan = V.activePlan(root);
  if (!activePlan) {
    return {
      blocked: S.block(
        `Ship-capable change (e.g. ${shipFile}) with no active-plan pointer.`,
        'Cannot tell WHICH review verdict is supposed to authorize this ship, and',
        'guessing the newest verdict would let an unrelated review authorize it.',
        'Fix: set session-state/active-plan.json {"path": "tasks/plans/<plan-dir>"}.',
      ),
    };
  }
  const slug = V.slugFromPointer(activePlan);
  if (!slug) return { blocked: S.block(`Active-plan pointer '${activePlan}' did not resolve to a plan slug.`) };
  return { activePlan, slug };
}

/**
 * A security BLOCK is independently ship-blocking, which is why security
 * verdicts are checked before the authorizing verdict is even looked up — and
 * why they are never counted as one.
 */
function checkSecurityVerdicts(root, slug) {
  for (const securityVerdict of V.securityVerdicts(root, slug)) {
    if (validateGate2({ input: path.join(root, securityVerdict) }).exit !== 0) {
      return S.block(
        `Security verdict '${securityVerdict}' blocks plan '${slug}'.`,
        'Fix: resolve the security findings and obtain a new PASS security verdict.',
      );
    }
  }
  return null;
}

/** Exactly one authorizing verdict, or a block that refuses to choose. */
function resolveVerdict(root, slug, shipFile) {
  const { count, verdict } = V.authorizingVerdicts(root, slug);
  if (count === 0) {
    return {
      blocked: S.block(
        `Ship-capable change (e.g. ${shipFile}) with no review verdict for plan '${slug}'.`,
        `Expected: tasks/reviews/<YYMMDD>-${slug}-verdict.md (or -evalverdict.md).`,
        'Fix: run /mk:review to produce a verdict, then present Gate 2 to the human.',
      ),
    };
  }
  if (count > 1) {
    return {
      blocked: S.block(
        `Ambiguous: ${count} verdicts match plan '${slug}'.`,
        'Refusing to pick one — the wrong choice would authorize this ship on the',
        'wrong review. Fix: keep exactly one verdict per plan slug.',
      ),
    };
  }
  return { verdict };
}

/**
 * At commit time HEAD is the base the review was done against (the new commit
 * does not exist yet); at push or merge it is the tip being shipped. Either way
 * the honest binding is "the verdict names current HEAD". With no history there
 * is no prior revision to bind to, so the check is skipped rather than failed.
 */
function checkRevisionBinding(root, verdict, sha) {
  if (!sha || V.namesRevision(root, verdict, sha)) return null;
  return S.block(
    `Verdict ${verdict} does not name the revision under review (${sha}).`,
    'A verdict with no matching revision cannot be tied to this code — a stale',
    'verdict from an earlier state would look identical to a current one.',
    `Fix: record the reviewed revision in the verdict (e.g. a 'Revision: ${sha}'`,
    'line), or re-review at the current HEAD and record its SHA.',
  );
}

function passed(slug, verdict, sha) {
  return allow([
    `Gate 2 structural check PASSED for plan '${slug}' (verdict: ${verdict}).`,
    '  PROVEN:    verdict present, no FAIL dimension, no security BLOCK, and bound',
    `             to the shipped revision (${sha}).`,
    '  UNPROVEN:  human approval — this check cannot establish it (the verdict is',
    "             agent-writable). Gate 2 approval remains the human's, at the gate.",
  ]);
}

function gate2Check({ root = process.cwd(), command = '' } = {}) {
  // Everything that is not a ship boundary is none of this check's business.
  if (!isShipCommand(command)) return allow();

  const scope = resolveShipScope(root, command);
  if (scope.blocked) return scope.blocked;
  if (scope.done) return scope.done;

  const plan = resolvePlan(root, scope.shipFile);
  if (plan.blocked) return plan.blocked;

  const securityBlock = checkSecurityVerdicts(root, plan.slug);
  if (securityBlock) return securityBlock;

  const chosen = resolveVerdict(root, plan.slug, scope.shipFile);
  if (chosen.blocked) return chosen.blocked;

  const sha = headSha(root);
  for (const check of [
    () => S.checkVerdictContent(root, chosen.verdict),
    () => S.checkEvidenceIndex(root, plan.activePlan, plan.slug),
    () => S.checkReviewCoverage(root, chosen.verdict),
    () => checkRevisionBinding(root, chosen.verdict, sha),
  ]) {
    const blocked = check();
    if (blocked) return blocked;
  }

  return passed(plan.slug, chosen.verdict, sha);
}

module.exports = { gate2Check, isNoShip, isShipCommand };
