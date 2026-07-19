// The safe orientation envelope: a pure projection of durable task state into one of four
// honest outcomes a fresh session can act on. It NEVER touches the filesystem or git — repo
// revisions arrive as injected probes — so it is trivially testable and cannot become an
// existence oracle. Excluding `done` records, surfacing corrupt records as issues, and refusing
// to silently pick one of several active records are the honesty guarantees.
import type { ActiveTaskPointerResult, ResumeState, TaskRecord } from "./task-record.js";

export const ORIENT_ENVELOPE_SCHEMA_VERSION = "1.0";

/**
 * The four honest orientation outcomes:
 * - `active`   — exactly one resumable task resolved (its `status` may be `active` or `blocked`).
 * - `none`     — no resumable task (no records, or only `done` records).
 * - `ambiguous`— several resumable tasks and the pointer did not disambiguate.
 * - `corrupt-only` — the only durable state present is unreadable.
 */
export type OrientOutcome = "active" | "none" | "ambiguous" | "corrupt-only";

/** An injected current-revision reading per owning repo (the builder stays pure — no git access). */
export interface RepoRevisionProbe {
	identity: string;
	currentRevision: string | null;
}

/** The resumable task, flattened to the compact fields a fresh session needs to continue. */
export interface OrientActiveTask {
	taskId: string;
	/** A blocked task is still "the" active task — it resolves, but must not silently auto-resume. */
	status: "active" | "blocked";
	planPath: string | null;
	planSlug: string | null;
	currentStep: string;
	nextAction: string;
	blockers: string[];
}

export interface OrientEnvelope {
	schemaVersion: typeof ORIENT_ENVELOPE_SCHEMA_VERSION;
	outcome: OrientOutcome;
	/** Set only when `outcome === "active"`. */
	activeTask: OrientActiveTask | null;
	/** Task ids in play: the resolved one for `active`, every candidate for `ambiguous`, else []. */
	candidates: string[];
	/** Definite recorded-vs-current revision mismatches for the active task's repos. */
	staleWarnings: string[];
	/** Unreadable records surfaced so one bad file never hides the rest. */
	issues: { taskId: string; problem: string }[];
	/** How the pointer was read (diagnostic; `legacy` support is temporary). */
	pointerKind: "canonical" | "legacy" | "none";
}

/**
 * Derive a plan slug from a plan path: the directory holding `plan.md`, else the basename without
 * its `.md` extension. Pure and separator-tolerant. Used for EXACT legacy-pointer matching only.
 */
export function planSlugFromPath(planPath: string | null | undefined): string | null {
	if (!planPath) return null;
	const parts = planPath.replace(/\\/g, "/").split("/").filter(Boolean);
	if (parts.length === 0) return null;
	const last = parts[parts.length - 1];
	if (/\.md$/i.test(last)) return parts.length >= 2 ? parts[parts.length - 2] : last.replace(/\.md$/i, "");
	return last;
}

/** Exact (never substring) match of a legacy plan reference against a record's plan path/slug. */
function matchesLegacyRef(record: TaskRecord, planRef: string): boolean {
	return record.planPath === planRef || planSlugFromPath(record.planPath) === planRef;
}

/** Compute definite revision mismatches (both revisions known and unequal) for one task's repos. */
function computeStaleWarnings(record: TaskRecord, probes: RepoRevisionProbe[]): string[] {
	const current = new Map(probes.map((p) => [p.identity, p.currentRevision]));
	const warnings: string[] = [];
	for (const repo of record.repos) {
		if (repo.revision === null || !current.has(repo.identity)) continue;
		const now = current.get(repo.identity) ?? null;
		if (now !== null && now !== repo.revision) {
			warnings.push(`repo ${repo.identity} moved from ${repo.revision} to ${now}`);
		}
	}
	return warnings;
}

function flatten(record: TaskRecord): OrientActiveTask {
	return {
		taskId: record.taskId,
		status: record.status === "blocked" ? "blocked" : "active",
		planPath: record.planPath,
		planSlug: planSlugFromPath(record.planPath),
		currentStep: record.currentStep,
		nextAction: record.nextAction,
		blockers: record.blockers,
	};
}

function envelope(partial: Partial<OrientEnvelope> & { outcome: OrientOutcome }): OrientEnvelope {
	return {
		schemaVersion: ORIENT_ENVELOPE_SCHEMA_VERSION,
		activeTask: null,
		candidates: [],
		staleWarnings: [],
		issues: [],
		pointerKind: "none",
		...partial,
	};
}

/**
 * Build the orientation envelope from reconstructed durable state, the active-task pointer, and
 * injected repo probes. Resolution order:
 *   1. If the pointer resolves to exactly one NON-done record → `active` (that record).
 *   2. Otherwise, over the non-done records: 0 → `none` (or `corrupt-only` if the ONLY state is
 *      unreadable), 1 → `active` (the sole recoverable task), >1 → `ambiguous` (all candidate ids).
 * Corrupt records are always surfaced in `issues`, regardless of outcome.
 */
export function buildOrientEnvelope(
	resume: ResumeState,
	pointer: ActiveTaskPointerResult,
	probes: RepoRevisionProbe[] = [],
): OrientEnvelope {
	const issues = resume.issues;
	const pointerKind = pointer ? pointer.kind : "none";
	const nonDone = resume.records.filter((r) => r.status !== "done");

	let pointed: TaskRecord | undefined;
	if (pointer?.kind === "canonical") {
		pointed = nonDone.find((r) => r.taskId === pointer.pointer.taskId);
	} else if (pointer?.kind === "legacy") {
		pointed = nonDone.find((r) => matchesLegacyRef(r, pointer.planRef));
	}

	if (pointed) {
		return envelope({
			outcome: "active",
			activeTask: flatten(pointed),
			candidates: [pointed.taskId],
			staleWarnings: computeStaleWarnings(pointed, probes),
			issues,
			pointerKind,
		});
	}

	if (nonDone.length === 0) {
		const outcome: OrientOutcome = resume.records.length === 0 && issues.length > 0 ? "corrupt-only" : "none";
		return envelope({ outcome, issues, pointerKind });
	}

	if (nonDone.length === 1) {
		return envelope({
			outcome: "active",
			activeTask: flatten(nonDone[0]),
			candidates: [nonDone[0].taskId],
			staleWarnings: computeStaleWarnings(nonDone[0], probes),
			issues,
			pointerKind,
		});
	}

	return envelope({
		outcome: "ambiguous",
		candidates: nonDone.map((r) => r.taskId).sort(),
		issues,
		pointerKind,
	});
}
