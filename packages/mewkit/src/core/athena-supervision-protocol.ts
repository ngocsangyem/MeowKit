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
 * Call ceiling per wrapped skill, keyed by skill id.
 *
 * For most skills this is a flat per-RUN total. For a skill listed in
 * `PARTITIONED_SKILL_CAPS` it is the ceiling per PARTITION instead — see there for
 * why one ship run needs more than one budget.
 */
export const SKILL_HARD_CAPS: Record<string, number> = {
	"mk:brainstorming": 4,
	"mk:plan-creator": 4,
	"mk:cook": 5,
	"mk:fix": 5,
	"mk:autobuild": 5,
	"mk:ship": 4,
};

/** Ship's scopes. One ship run may pass through all three in sequence. */
export const RELEASE_STAGES = ["prepare", "release", "publish"] as const;
export type ReleaseStage = (typeof RELEASE_STAGES)[number];

/**
 * Skills whose cap is spent per PARTITION rather than per run, with the partition
 * values each one accepts.
 *
 * `mk:ship` is the reason this exists. Its three scopes are three separate decisions
 * — stage a local commit, push and open a PR, cut a version — and a run that walks
 * all three under one flat budget would arrive at `publish` with its supervision
 * already spent on `prepare`. Per-partition accounting matches how the skill is
 * actually used; the previous flat counter under-permitted rather than over-permitted,
 * which was safe but wrong.
 *
 * A partitioned skill REQUIRES a partition and an unpartitioned one REFUSES it, both
 * in `evaluateStageRequest`. Neither is defaulted: silently assuming `prepare` would
 * charge a publish-time call to the wrong budget, and silently ignoring a partition on
 * an unpartitioned skill would let a caller believe it bought a budget it did not.
 */
export const PARTITIONED_SKILL_CAPS: Record<string, readonly string[]> = {
	"mk:ship": RELEASE_STAGES,
};

/** The partition values a skill accepts, or `null` when its cap is per-run. */
export function partitionValuesFor(skill: string): readonly string[] | null {
	return Object.prototype.hasOwnProperty.call(PARTITIONED_SKILL_CAPS, skill) ? PARTITIONED_SKILL_CAPS[skill] : null;
}

/** Skills that expose `--advice`. Anything else is not a supervision entry point. */
export function isSupervisedSkill(skill: string): boolean {
	return Object.prototype.hasOwnProperty.call(SKILL_HARD_CAPS, skill);
}

/** One committed checkpoint in a run's history. */
export interface CheckpointRecord {
	checkpointId: string;
	stage: SupervisionStage;
	disposition: Disposition;
	/** Which budget this call was charged to. Absent on an unpartitioned skill. */
	partition?: string;
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
 * Whether `record` is charged to `partition`'s budget for `skill`.
 *
 * On an unpartitioned skill everything counts — there is one budget.
 *
 * On a partitioned skill, a record that names no partition, or names one the skill does
 * not declare, is UNATTRIBUTABLE and counts against EVERY partition. Two ways to hold
 * one: history written before the skill was partitioned (those entries have no partition
 * field at all), or a hand-edited dossier whose value does not match a declared stage.
 *
 * The tempting reading — "it belongs to no partition, so skip it" — silently turns every
 * such entry into a free slot in all three budgets, which is how a run that already
 * exhausted a flat cap acquires 4×3 fresh calls, and how a run holding two unresolved
 * returns loses its escalation. Counting an unattributable record everywhere can only
 * under-permit, which is the direction this module errs in on purpose. It is also why an
 * in-flight run needs no migration story: across the change it becomes more restricted,
 * never less.
 *
 * Shared with the CLI so cap accounting at `begin` and return accounting at `commit`
 * cannot drift apart — two copies of this rule is one copy too many.
 */
export function chargesToPartition(skill: string, record: CheckpointRecord, partition: string | undefined): boolean {
	const legal = partitionValuesFor(skill);
	if (!legal) return true;
	const attributable = record.partition !== undefined && legal.includes(record.partition);
	return record.partition === partition || !attributable;
}

/**
 * Whether a proposed checkpoint call may run.
 *
 * Ordering matters. Idempotency is checked FIRST, against the WHOLE run history: a
 * retried checkpoint (same `checkpointId`) must be a no-op rather than consume a cap
 * slot, otherwise a crash-and-resume between the pending marker and the committed
 * result silently spends the run's budget. A `checkpointId` is unique per run, not per
 * partition, so this check deliberately ignores partitioning. Everything after it is a
 * real new call and is counted within the active budget.
 */
export function evaluateStageRequest(input: {
	skill: string;
	stage: SupervisionStage;
	checkpointId: string;
	history: readonly CheckpointRecord[];
	/** Required for a partitioned skill, refused for any other. */
	partition?: string;
}): StageDecision {
	const { skill, stage, checkpointId, history, partition } = input;

	const duplicate = history.find((h) => h.checkpointId === checkpointId);
	if (duplicate) return { allowed: true, duplicateOf: duplicate.checkpointId };

	if (!isSupervisedSkill(skill))
		return { allowed: false, reason: `${skill} does not expose --advice`, escalate: false };

	const legalPartitions = partitionValuesFor(skill);
	if (legalPartitions) {
		if (partition === undefined)
			return {
				allowed: false,
				reason: `${skill} budgets supervision per release stage — name one of ${legalPartitions.join(", ")}`,
				escalate: false,
			};
		if (!legalPartitions.includes(partition))
			return {
				allowed: false,
				reason: `"${partition}" is not a release stage for ${skill} — expected ${legalPartitions.join(", ")}`,
				escalate: false,
			};
	} else if (partition !== undefined) {
		return {
			allowed: false,
			reason: `${skill} has a per-run cap and takes no release stage`,
			escalate: false,
		};
	}

	// The active budget. For a partitioned skill each partition carries its own
	// per-stage maxima, return counter and cap — that is what "per release stage" means.
	const scoped = history.filter((h) => chargesToPartition(skill, h, partition));
	const within = legalPartitions ? `in ${partition}` : "in this run";

	// A second unresolved return is a human's decision, not a third supervisor opinion.
	// Counted within the budget: a resolved return while preparing and an unrelated one
	// while releasing are two episodes, not one unresolved loop.
	const returns = scoped.filter((h) => h.disposition === "RETURN_TO_EXECUTOR").length;
	if (returns >= 2)
		return {
			allowed: false,
			reason: `work was returned twice without resolution ${within} — escalate to a human`,
			escalate: true,
		};

	if (countStage(scoped, stage) >= PER_STAGE_MAX[stage])
		return {
			allowed: false,
			reason: `${stage} already ran ${PER_STAGE_MAX[stage]}× ${within}`,
			escalate: stage === "RECHECK",
		};

	// RECHECK exists only to re-examine returned work; without a return it would be
	// a second free review of unchanged evidence.
	if (stage === "RECHECK" && returns === 0)
		return { allowed: false, reason: `RECHECK requires a prior RETURN_TO_EXECUTOR ${within}`, escalate: false };

	const cap = SKILL_HARD_CAPS[skill];
	if (scoped.length >= cap)
		return { allowed: false, reason: `${skill} reached its ${cap}-call supervision cap ${within}`, escalate: true };

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
