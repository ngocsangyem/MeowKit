// Athena route contract — direct strategy consult vs embedded lifecycle supervision.
//
// Canonical contract: `.claude/rules-conditional/advice-supervision-rules.md` §11.
// Cadence lives in `athena-supervision-protocol.ts`, continuity in
// `athena-supervision-dossier.ts`.
//
// Athena is reachable two ways, and they are DIFFERENT capabilities:
//
//   direct   — an explicitly requested, stateless strategy brief. No run id, no
//              dossier, no receipt, no cap accounting. It is not supervision.
//   embedded — a bounded checkpoint inside a supervised run. Requires a valid
//              `supervisionRunId`, a stage and a checkpoint id.
//
// The failure this module exists to prevent is the two modes impersonating each
// other. A stateless consult recorded as supervision would put a directive in the
// audit trail that no run ever governed — and, in the other direction, an
// "embedded" call with no run id would be supervision with nothing to resume from
// and no cap to bound it. Both are refused rather than coerced into a working shape,
// because a guessed mode produces a record that misrepresents what happened.
import { SUPERVISION_STAGES, type SupervisionStage } from "./athena-supervision-protocol.js";

/** The two routes. Neither is a superset of the other. */
export const SUPERVISION_MODES = ["direct", "embedded"] as const;
export type SupervisionMode = (typeof SUPERVISION_MODES)[number];

/**
 * Canonical supervision run id: lowercase slug, filename-safe because it becomes
 * part of the dossier path. Defined here — run identity is what separates the two
 * routes — and imported by the dossier so one regex governs both.
 */
export const RUN_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** True when `runId` is a well-formed supervision run id. */
export function isValidRunId(runId: unknown): runId is string {
	return typeof runId === "string" && RUN_ID_RE.test(runId);
}

/**
 * True when `stage` is one of the four real stages.
 *
 * Truthiness is not enough. A truthy-but-unknown stage ("bogus", "  ") would pass a
 * presence check, be classified as valid embedded supervision, and then crash the
 * cadence checks that index a stage table with it. Refusing here keeps the module's
 * promise: refuse, never coerce.
 */
export function isValidStage(stage: unknown): stage is SupervisionStage {
	return typeof stage === "string" && (SUPERVISION_STAGES as readonly string[]).includes(stage);
}

/** True when `mode` is a declared route rather than an invented one. */
export function isValidMode(mode: unknown): mode is SupervisionMode {
	return typeof mode === "string" && (SUPERVISION_MODES as readonly string[]).includes(mode);
}

/**
 * A checkpoint id is an opaque caller-chosen token; it need only be non-blank. Not
 * exported — nothing outside this module needs to ask, and an export with no consumer
 * is dead weight.
 */
function isValidCheckpointId(id: unknown): id is string {
	return typeof id === "string" && id.trim().length > 0;
}

/** What a caller claims it is doing, and the run state it brought along. */
export interface SupervisionCallClaim {
	claimedMode: SupervisionMode;
	runId?: string | null;
	stage?: SupervisionStage | null;
	checkpointId?: string | null;
}

export type ModeDecision =
	| { valid: true; mode: SupervisionMode; stateful: boolean }
	| { valid: false; reason: string };

/**
 * Decide whether a call may run as the mode it claims.
 *
 * `embedded` must carry the full triple (run id, stage, checkpoint id): those are
 * what make it resumable, idempotent and capped. `direct` must carry NONE of them —
 * a consult that arrives holding run state is indistinguishable from supervision
 * once it is written down, so the state itself is the violation.
 */
export function classifySupervisionCall(claim: SupervisionCallClaim): ModeDecision {
	const { claimedMode, runId, stage, checkpointId } = claim;

	// An unknown mode is refused rather than falling through to the permissive branch.
	// Silently treating an invented mode as a direct consult would let a caller opt out
	// of the embedded requirements simply by misspelling the route it wanted.
	if (!isValidMode(claimedMode))
		return { valid: false, reason: `unknown mode ${JSON.stringify(claimedMode)} — expected direct or embedded` };

	if (claimedMode === "embedded") {
		if (!isValidRunId(runId))
			return {
				valid: false,
				reason: "embedded supervision requires a valid supervisionRunId — a direct consult cannot become supervision",
			};
		// Validated against the stage vocabulary, not merely present: an unknown stage
		// would be classified valid here and then crash the cadence checks downstream.
		if (!isValidStage(stage))
			return { valid: false, reason: `embedded supervision requires a known stage, got ${JSON.stringify(stage)}` };
		if (!isValidCheckpointId(checkpointId))
			return { valid: false, reason: "embedded supervision requires a non-blank checkpointId" };
		return { valid: true, mode: "embedded", stateful: true };
	}

	// A direct consult is stateless by definition; run state would launder it into
	// supervision, so name the offending field rather than silently dropping it.
	const carried = [
		runId != null && runId !== "" ? "runId" : null,
		stage ? "stage" : null,
		checkpointId ? "checkpointId" : null,
	].filter(Boolean);
	if (carried.length > 0)
		return {
			valid: false,
			reason: `a direct consult is stateless and must not carry ${carried.join(", ")} — it is a strategy brief, not lifecycle supervision`,
		};

	return { valid: true, mode: "direct", stateful: false };
}

// Durable-artifact permission is deliberately NOT a helper here. Only an embedded run
// has a run id, and a dossier path cannot be built without one, so "direct writes no
// artifacts" is already structural rather than a predicate a caller must remember to
// check. `mewkit advice begin` is the call site that classifies: it claims `embedded`
// and is refused outright when the triple is incomplete, so an unbounded, unresumable
// call cannot reach the dossier or receipt writers at all.
