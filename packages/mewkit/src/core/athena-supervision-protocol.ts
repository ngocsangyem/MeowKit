// Athena supervision protocol — the provider-neutral state machine.
//
// Canonical contract: `.claude/rules-conditional/advice-supervision-rules.md`.
// This module is the mechanical half of it: which stages may run, which
// dispositions each stage may return, how many calls a run may make, and how a
// transport status combines with a disposition. Prose and this file must agree;
// where they disagree, the deterministic tests over this file are the tiebreak.
//
// Deliberately pure: no filesystem, no clock, no provider. Packet shape lives in
// `athena-supervision-packet.ts`, durable continuity in
// `athena-supervision-dossier.ts`.
//
// The invariant this file exists to make unbreakable: a supervisor can return
// work, but it can never advance a gate. `RETURN_TO_EXECUTOR` routes work; it is
// not an approval, and no disposition here grants one.

/** The four supervisory checkpoints of one supervised run. */
export const SUPERVISION_STAGES = ["GUIDE", "RESCUE", "REVIEW", "RECHECK"] as const;
export type SupervisionStage = (typeof SUPERVISION_STAGES)[number];

/** Every disposition Athena may return, across all stages. */
export const DISPOSITIONS = [
	"CONTINUE_WITH_DIRECTIVE",
	"READY_FOR_EXISTING_GATE",
	"RETURN_TO_EXECUTOR",
	"ESCALATE_TO_HUMAN",
	"BLOCKED_MISSING_EVIDENCE",
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

/**
 * Stage-specific legal dispositions. A forward-looking stage cannot report on
 * finished work, and a backward-looking stage cannot hand out a "carry on"
 * directive — mixing them is how a review turns into tacit approval.
 */
const STAGE_DISPOSITIONS: Record<SupervisionStage, readonly Disposition[]> = {
	GUIDE: ["CONTINUE_WITH_DIRECTIVE", "ESCALATE_TO_HUMAN", "BLOCKED_MISSING_EVIDENCE"],
	RESCUE: ["CONTINUE_WITH_DIRECTIVE", "ESCALATE_TO_HUMAN", "BLOCKED_MISSING_EVIDENCE"],
	REVIEW: ["READY_FOR_EXISTING_GATE", "RETURN_TO_EXECUTOR", "ESCALATE_TO_HUMAN", "BLOCKED_MISSING_EVIDENCE"],
	RECHECK: ["READY_FOR_EXISTING_GATE", "RETURN_TO_EXECUTOR", "ESCALATE_TO_HUMAN", "BLOCKED_MISSING_EVIDENCE"],
};

/**
 * True when `disposition` is legal for `stage`.
 *
 * An unknown stage yields `false` rather than throwing: this is a legality question, and
 * "no disposition is legal for a stage that does not exist" is the safe answer. Throwing
 * would turn a rejected input into a crash at the routing boundary.
 */
export function isDispositionLegal(stage: SupervisionStage, disposition: Disposition): boolean {
	return STAGE_DISPOSITIONS[stage]?.includes(disposition) ?? false;
}

/** The legal dispositions for a stage (readonly view, for error messages and tests). */
export function legalDispositions(stage: SupervisionStage): readonly Disposition[] {
	return STAGE_DISPOSITIONS[stage] ?? [];
}

/**
 * `READY_FOR_EXISTING_GATE` is the single most misreadable disposition: it means
 * "the normal reviewer/gate is the correct next step", NEVER "the gate is
 * cleared". Callers route on it; they may not treat it as approval.
 */
export const GATE_ADVANCING_DISPOSITIONS: readonly Disposition[] = [];

/** Per-stage call ceiling within one supervised run. */
export const PER_STAGE_MAX: Record<SupervisionStage, number> = {
	GUIDE: 1,
	// One rescue per rework round; two rounds is the ceiling before a human decides.
	RESCUE: 2,
	REVIEW: 1,
	RECHECK: 1,
};

/**
 * Total-call ceiling per wrapped skill, keyed by skill id.
 *
 * Every entry is a FLAT per-run total: `evaluateStageRequest` compares the whole
 * run's history length against it. `mk:ship` is designed to budget 4 calls per
 * RELEASE STAGE, which this flat counter cannot express — a stage-partitioned
 * counter is required when the ship wrapper is authored. Until then the flat value
 * is the stricter reading, so it under-permits rather than over-permits.
 */
export const SKILL_HARD_CAPS: Record<string, number> = {
	"mk:brainstorming": 4,
	"mk:plan-creator": 4,
	"mk:cook": 5,
	"mk:fix": 5,
	"mk:autobuild": 5,
	"mk:ship": 4,
};

/** Skills that expose `--advice`. Anything else is not a supervision entry point. */
export function isSupervisedSkill(skill: string): boolean {
	return Object.prototype.hasOwnProperty.call(SKILL_HARD_CAPS, skill);
}

/** One committed checkpoint in a run's history. */
export interface CheckpointRecord {
	checkpointId: string;
	stage: SupervisionStage;
	disposition: Disposition;
}

/** Why a proposed call is refused. `escalate` means hand off to a human, not retry. */
export interface StageRefusal {
	allowed: false;
	reason: string;
	escalate: boolean;
}
export type StageDecision = { allowed: true; duplicateOf?: string } | StageRefusal;

/** Count committed calls at `stage`. */
const countStage = (history: readonly CheckpointRecord[], stage: SupervisionStage): number =>
	history.filter((h) => h.stage === stage).length;

/**
 * Whether a proposed checkpoint call may run.
 *
 * Ordering matters. Idempotency is checked FIRST: a retried checkpoint (same
 * `checkpointId`) must be a no-op rather than consume a cap slot, otherwise a
 * crash-and-resume between the pending marker and the committed result silently
 * spends the run's budget. Everything after that is a real new call.
 */
export function evaluateStageRequest(input: {
	skill: string;
	stage: SupervisionStage;
	checkpointId: string;
	history: readonly CheckpointRecord[];
}): StageDecision {
	const { skill, stage, checkpointId, history } = input;

	const duplicate = history.find((h) => h.checkpointId === checkpointId);
	if (duplicate) return { allowed: true, duplicateOf: duplicate.checkpointId };

	if (!isSupervisedSkill(skill))
		return { allowed: false, reason: `${skill} does not expose --advice`, escalate: false };

	// A second unresolved return is a human's decision, not a third supervisor opinion.
	const returns = history.filter((h) => h.disposition === "RETURN_TO_EXECUTOR").length;
	if (returns >= 2)
		return {
			allowed: false,
			reason: "work was returned twice without resolution — escalate to a human",
			escalate: true,
		};

	if (countStage(history, stage) >= PER_STAGE_MAX[stage])
		return {
			allowed: false,
			reason: `${stage} already ran ${PER_STAGE_MAX[stage]}× in this run`,
			escalate: stage === "RECHECK",
		};

	// RECHECK exists only to re-examine returned work; without a return it would be
	// a second free review of unchanged evidence.
	if (stage === "RECHECK" && returns === 0)
		return { allowed: false, reason: "RECHECK requires a prior RETURN_TO_EXECUTOR", escalate: false };

	const cap = SKILL_HARD_CAPS[skill];
	if (history.length >= cap)
		return { allowed: false, reason: `${skill} reached its ${cap}-call supervision cap`, escalate: true };

	return { allowed: true };
}

/**
 * A1 transport status, which answers only "did a valid packet arrive". It is NOT
 * the routing signal — `disposition` is. Keeping them separate is what stops a
 * transport-level `DONE` from being read as workflow approval.
 */
export const TRANSPORT_STATUSES = ["DONE", "DONE_WITH_CONCERNS", "BLOCKED"] as const;
export type TransportStatus = (typeof TRANSPORT_STATUSES)[number];

/** Result of reconciling transport status against disposition. */
export type PrecedenceResult =
	| { valid: true; route: Disposition }
	| { valid: false; reason: string };

/**
 * Reconcile transport status with disposition before routing.
 *
 * `BLOCKED` means no usable directive exists, so it cannot carry one; conversely a
 * delivered packet must state a disposition. Either mismatch is a contract
 * violation and is refused rather than guessed at — guessing here would invent a
 * routing decision no supervisor actually made.
 */
export function reconcileStatus(
	status: TransportStatus,
	disposition: Disposition | null | undefined,
): PrecedenceResult {
	if (status === "BLOCKED") {
		if (disposition && disposition !== "BLOCKED_MISSING_EVIDENCE")
			return { valid: false, reason: `transport BLOCKED cannot carry disposition ${disposition}` };
		return { valid: true, route: "BLOCKED_MISSING_EVIDENCE" };
	}
	if (!disposition) return { valid: false, reason: `transport ${status} requires a disposition` };
	return { valid: true, route: disposition };
}
