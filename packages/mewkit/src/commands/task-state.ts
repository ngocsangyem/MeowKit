// `mewkit task-state show|update` — the durable-task-record surface (Phase 4).
// `show` reconstructs resume state from files only; `update` writes the record atomically.
// Distinct from `task` (which scaffolds task FILES from templates): this owns durable STATE.
import path from "node:path";
import pc from "picocolors";
import {
	reconstructResumeState,
	updateTaskRecord,
	IncompatibleTaskRecordError,
	TASK_RECORD_SCHEMA_VERSION,
	type TaskRecord,
} from "../core/task-record.js";
import { readInstallMetadata } from "../core/install-metadata.js";

export interface TaskStateOptions {
	subcommand?: string;
	taskId?: string;
	status?: string;
	step?: string;
	next?: string;
	plan?: string;
	json?: boolean;
	/** Invoking CLI version, for record provenance (never the compatibility gate). */
	cliVersion?: string;
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
		console.log(pc.bold(pc.cyan("Durable task state")));
		if (state.activePlanPointer) console.log(pc.dim(`  active plan: ${state.activePlanPointer}`));
		if (state.records.length === 0) console.log(pc.dim("  No active task records."));
		for (const r of state.records) {
			// Checkpoint join: mark the record whose plan matches the active-plan pointer.
			const isCurrent =
				state.activePlanPointer !== null && r.planPath !== null && r.planPath.includes(state.activePlanPointer);
			const marker = isCurrent ? pc.green(" ◀ current") : "";
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
		try {
			// Read→merge→write under ONE lock (updateTaskRecord) so concurrent same-id updates
			// cannot lose each other's changes. The mutator preserves untouched fields.
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
					writtenByCli: args.cliVersion ?? base.writtenByCli,
					writtenByKit: kitVersion(projectRoot) || base.writtenByKit,
					updatedAt: new Date().toISOString(),
				};
			});
			console.log(pc.green(`Updated task record: ${path.join("tasks/active", `${updated.taskId}.json`)}`));
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
