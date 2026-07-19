// `mewkit task-state show|update` — the durable-task-record surface (Phase 4).
// `show` reconstructs resume state from files only; `update` writes the record atomically.
// Distinct from `task` (which scaffolds task FILES from templates): this owns durable STATE.
import path from "node:path";
import pc from "picocolors";
import {
	reconstructResumeState,
	updateTaskRecord,
	clearActiveTaskPointer,
	readActiveTaskPointer,
	IncompatibleTaskRecordError,
	TASK_RECORD_SCHEMA_VERSION,
	type TaskRecord,
	type CapabilityDecisionSchema,
} from "../core/task-record.js";
import { planSlugFromPath } from "../core/orient-envelope.js";
import { readInstallMetadata } from "../core/install-metadata.js";
import { appendTraceRecord } from "../core/trace-append.js";
import type { z } from "zod";

type CapabilityDecision = z.infer<typeof CapabilityDecisionSchema>;
const DECISION_VALUES = ["selected", "skipped", "unavailable", "unsupported"] as const;

export interface TaskStateOptions {
	subcommand?: string;
	taskId?: string;
	status?: string;
	step?: string;
	next?: string;
	plan?: string;
	json?: boolean;
	/** Transition metadata (each may be repeated on the CLI → string | string[]). */
	blocker?: string | string[];
	verification?: string | string[];
	evidenceRef?: string | string[];
	capabilityDecision?: string | string[];
	/** Invoking CLI version, for record provenance (never the compatibility gate). */
	cliVersion?: string;
}

/** Normalize a repeatable CLI flag (absent | one | many) to a clean string array. */
function toArray(v: string | string[] | undefined): string[] {
	if (v === undefined) return [];
	return (Array.isArray(v) ? v : [v]).map((s) => String(s).trim()).filter(Boolean);
}

/** Parse `ref=result` / `ref:result` (delimiter-optional) into a verification summary. */
function parseVerification(raw: string): { ref: string; result: string } {
	const m = /^([^=:]+)[=:](.*)$/.exec(raw);
	return m ? { ref: m[1].trim(), result: m[2].trim() } : { ref: raw, result: "" };
}

/** Parse `capId|decision|reason|snapshot?`; throws on an invalid decision token. */
function parseCapabilityDecision(raw: string): CapabilityDecision {
	const [capabilityId, decision, reason, adapterSnapshotId] = raw.split("|").map((s) => s.trim());
	if (!capabilityId || !decision) throw new Error(`--capability-decision needs "capId|decision|reason": got ${JSON.stringify(raw)}`);
	if (!(DECISION_VALUES as readonly string[]).includes(decision)) {
		throw new Error(`invalid capability decision "${decision}" — expected ${DECISION_VALUES.join("|")}`);
	}
	return {
		capabilityId,
		decision: decision as CapabilityDecision["decision"],
		reason: reason ?? "",
		...(adapterSnapshotId ? { adapterSnapshotId } : {}),
	};
}

/** Union a value into a list by identity, preserving order (no duplicate blockers/evidence). */
function unionPush<T>(existing: T[], additions: T[], key: (t: T) => string): T[] {
	const seen = new Set(existing.map(key));
	const out = [...existing];
	for (const a of additions) if (!seen.has(key(a))) {
		seen.add(key(a));
		out.push(a);
	}
	return out;
}

/** Best-effort installed kit version (provenance only). */
function kitVersion(projectRoot: string): string {
	try {
		return readInstallMetadata(path.join(projectRoot, ".claude")).meta?.version ?? "";
	} catch {
		return "";
	}
}

export async function taskState(args: TaskStateOptions = {}): Promise<void> {
	const projectRoot = process.cwd();
	const sub = args.subcommand ?? "show";

	if (sub === "show") {
		const state = reconstructResumeState(projectRoot);
		if (args.json) {
			console.log(JSON.stringify(state, null, 2));
			return;
		}
		// Resolve the current task by EXACT identity — canonical pointer by taskId, or a legacy
		// pointer by exact plan-path/slug match. Never substring (a bug the pointer contract bans).
		const pointer = readActiveTaskPointer(projectRoot);
		const isCurrentRecord = (r: TaskRecord): boolean => {
			if (pointer?.kind === "canonical") return r.taskId === pointer.pointer.taskId;
			if (pointer?.kind === "legacy") return r.planPath === pointer.planRef || planSlugFromPath(r.planPath) === pointer.planRef;
			return false;
		};
		console.log(pc.bold(pc.cyan("Durable task state")));
		if (state.activePlanPointer) console.log(pc.dim(`  active plan: ${state.activePlanPointer}`));
		if (state.records.length === 0) console.log(pc.dim("  No active task records."));
		for (const r of state.records) {
			const marker = isCurrentRecord(r) ? pc.green(" ◀ current") : "";
			console.log(
				`  ${pc.bold(r.taskId)} ${pc.dim(`[${r.status}]`)}${r.planPath ? pc.dim(` ${r.planPath}`) : ""}${marker}`,
			);
			console.log(`    step: ${r.currentStep || pc.dim("(none)")}  next: ${r.nextAction || pc.dim("(none)")}`);
			if (r.repos.length)
				console.log(`    repos: ${r.repos.map((x) => `${x.identity}@${x.revision ?? "(no-rev)"}`).join(", ")}`);
			if (r.blockers.length) console.log(`    ${pc.yellow(`blockers: ${r.blockers.join("; ")}`)}`);
			if (r.capabilityDecisions.length) {
				console.log(`    decisions: ${r.capabilityDecisions.map((d) => `${d.capabilityId}=${d.decision}`).join(", ")}`);
			}
		}
		for (const i of state.issues) console.log(`  [${pc.red("ISSUE")}] ${i.taskId}: ${i.problem}`);
		return;
	}

	if (sub === "update") {
		const taskId = args.taskId;
		if (!taskId) {
			console.error(pc.red("`task-state update` requires a task id."));
			process.exit(1);
		}
		const status = args.status ?? "active";
		if (status !== "active" && status !== "blocked" && status !== "done") {
			console.error(pc.red(`Invalid --status "${status}". Expected active|blocked|done.`));
			process.exit(1);
		}

		// Parse/validate transition metadata BEFORE any write — bad input never half-updates.
		const newBlockers = toArray(args.blocker);
		const newEvidence = toArray(args.evidenceRef);
		const newVerifications = toArray(args.verification).map(parseVerification);
		let newDecisions: CapabilityDecision[];
		try {
			newDecisions = toArray(args.capabilityDecision).map(parseCapabilityDecision);
		} catch (err) {
			console.error(pc.red((err as Error).message));
			process.exit(1);
			return;
		}

		try {
			// Read→merge→write under ONE lock (updateTaskRecord) so concurrent same-id updates
			// cannot lose each other's changes. The mutator preserves untouched fields and MERGES
			// list metadata (never replaces) so evidence/blockers accumulate across transitions.
			const updated = await updateTaskRecord(projectRoot, taskId, (existing) => {
				const base: TaskRecord = existing ?? {
					schemaVersion: TASK_RECORD_SCHEMA_VERSION,
					taskId,
					planPath: null,
					status: "active",
					currentStep: "",
					repos: [],
					blockers: [],
					nextAction: "",
					verificationSummaries: [],
					evidenceRefs: [],
					capabilityDecisions: [],
					writtenByCli: "",
					writtenByKit: "",
					updatedAt: "",
				};
				return {
					...base,
					status: args.status ? status : base.status,
					currentStep: args.step ?? base.currentStep,
					nextAction: args.next ?? base.nextAction,
					planPath: args.plan ?? base.planPath,
					blockers: unionPush(base.blockers, newBlockers, (b) => b),
					evidenceRefs: unionPush(base.evidenceRefs, newEvidence, (e) => e),
					verificationSummaries: unionPush(base.verificationSummaries, newVerifications, (v) => `${v.ref}=${v.result}`),
					capabilityDecisions: unionPush(base.capabilityDecisions, newDecisions, (d) => d.capabilityId),
					writtenByCli: args.cliVersion ?? base.writtenByCli,
					writtenByKit: kitVersion(projectRoot) || base.writtenByKit,
					updatedAt: new Date().toISOString(),
				};
			});
			console.log(pc.green(`Updated task record: ${path.join("tasks/active", `${updated.taskId}.json`)}`));

			// Emit the transition trace ONLY after a successful state write. Advisory: a failed
			// append warns but never fails the command (the durable state is already committed).
			try {
				await appendTraceRecord(path.join(projectRoot, ".claude"), {
					event: "task_transition",
					taskId: updated.taskId,
					planPath: updated.planPath,
					data: {
						status: updated.status,
						step: updated.currentStep,
						next: updated.nextAction,
						...(newBlockers.length ? { blockers: newBlockers } : {}),
						...(newVerifications.length ? { verifications: newVerifications } : {}),
						...(newEvidence.length ? { evidence: newEvidence } : {}),
						...(newDecisions.length ? { capabilityDecisions: newDecisions } : {}),
					},
				});
			} catch (emitErr) {
				console.error(pc.yellow(`⚠ task-state updated, but trace emission failed: ${(emitErr as Error).message}`));
			}

			// Completing the task clears ONLY its own pointer (exact taskId match) — never another
			// live task's pointer. Advisory: a missing/other-task pointer is a no-op, not an error.
			if (updated.status === "done") {
				try {
					await clearActiveTaskPointer(projectRoot, taskId);
				} catch {
					/* pointer clear is advisory — the durable status change already succeeded */
				}
			}
		} catch (err) {
			if (err instanceof IncompatibleTaskRecordError) {
				// Loud + non-zero: never overwrite a record this CLI can't safely read.
				console.error(pc.red(`Refusing to update: ${err.message}`));
				process.exit(1);
			}
			throw err;
		}
		return;
	}

	console.error(pc.red(`Unknown task-state subcommand "${sub}". Expected show|update.`));
	process.exit(1);
}
