// `task-state update` transition metadata: --blocker, --verification, --evidence-ref, and
// --capability-decision map onto the record's list fields (merging, not replacing), and a
// task_transition trace event is emitted ONLY after the state write succeeds.
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { taskState } from "../task-state.js";
import { readTaskRecord, activateTask, readActiveTaskPointer } from "../../core/task-record.js";
import { parseTraceLog } from "../../core/trace-analysis.js";

const roots: string[] = [];
let cwd: string;
beforeEach(() => {
	cwd = process.cwd();
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
	process.chdir(cwd);
	vi.restoreAllMocks();
	roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});
function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-tsmeta-"));
	roots.push(root);
	return root;
}

describe("task-state update — transition metadata", () => {
	it("maps blocker/verification/evidence/decision onto the record", async () => {
		const root = makeRoot();
		process.chdir(root);
		await taskState({
			subcommand: "update",
			taskId: "feat-x",
			status: "blocked",
			step: "review",
			next: "await approval",
			plan: "plans/260711-x/plan.md",
			blocker: "waiting on review",
			verification: ["build=pass", "lint:clean"],
			evidenceRef: ["tasks/reviews/x-verdict.md"],
			capabilityDecision: "mk:cook|selected|impl intent|snap-1",
			cliVersion: "1.18.2",
		});
		const rec = readTaskRecord(root, "feat-x")!;
		expect(rec.status).toBe("blocked");
		expect(rec.blockers).toEqual(["waiting on review"]);
		expect(rec.verificationSummaries).toEqual([
			{ ref: "build", result: "pass" },
			{ ref: "lint", result: "clean" },
		]);
		expect(rec.evidenceRefs).toEqual(["tasks/reviews/x-verdict.md"]);
		expect(rec.capabilityDecisions[0]).toEqual({
			capabilityId: "mk:cook",
			decision: "selected",
			reason: "impl intent",
			adapterSnapshotId: "snap-1",
		});
	});

	it("MERGES list metadata across updates (no replace, no duplicates)", async () => {
		const root = makeRoot();
		process.chdir(root);
		await taskState({ subcommand: "update", taskId: "feat-x", blocker: "first", cliVersion: "1.18.2" });
		await taskState({ subcommand: "update", taskId: "feat-x", blocker: ["first", "second"], cliVersion: "1.18.2" });
		const rec = readTaskRecord(root, "feat-x")!;
		expect(rec.blockers).toEqual(["first", "second"]);
	});

	it("emits a task_transition trace event AFTER a successful update", async () => {
		const root = makeRoot();
		process.chdir(root);
		await taskState({
			subcommand: "update",
			taskId: "feat-x",
			status: "active",
			step: "build",
			plan: "plans/260711-x/plan.md",
			cliVersion: "1.18.2",
		});
		const logPath = join(root, ".claude", "memory", "trace-log.jsonl");
		expect(existsSync(logPath)).toBe(true);
		const records = parseTraceLog(readFileSync(logPath, "utf-8"));
		const t = records.find((r) => r.event === "task_transition");
		expect(t?.task_id).toBe("feat-x");
		expect(t?.plan_path).toBe("plans/260711-x/plan.md");
		expect((t?.data as { status?: string })?.status).toBe("active");
	});

	it("clears the task's canonical pointer when the update marks it done", async () => {
		const root = makeRoot();
		process.chdir(root);
		await activateTask(root, { taskId: "feat-x", planPath: "plans/260711-x/plan.md", now: "2026-07-19T12:00:00.000Z" });
		expect(readActiveTaskPointer(root)?.kind).toBe("canonical");
		await taskState({ subcommand: "update", taskId: "feat-x", status: "done", cliVersion: "1.18.2" });
		expect(readActiveTaskPointer(root)).toBeNull();
		expect(readTaskRecord(root, "feat-x")?.status).toBe("done"); // record kept, only pointer cleared
	});
});
