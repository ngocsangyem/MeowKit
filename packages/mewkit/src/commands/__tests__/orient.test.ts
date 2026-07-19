// `mewkit orient` end-to-end over real files: reconstructs durable state, resolves the pointer,
// probes repo revisions (degrading to null on missing/unreadable repos), and prints either the
// full JSON envelope or the bounded human block. It never scans plans or the wiki.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orient } from "../orient.js";
import { writeTaskRecord, writeActiveTaskPointer, type TaskRecord } from "../../core/task-record.js";
import { ORIENT_UNTRUSTED_HEADER } from "../../core/orient-context-renderer.js";

const roots: string[] = [];
let cwd: string;
let out: string[];
beforeEach(() => {
	cwd = process.cwd();
	out = [];
	vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void out.push(a.join(" ")));
});
afterEach(() => {
	process.chdir(cwd);
	vi.restoreAllMocks();
	roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});
function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-orient-cmd-"));
	roots.push(root);
	return root;
}
function rec(over: Partial<TaskRecord>): TaskRecord {
	return {
		schemaVersion: "1.0",
		taskId: "feat-x",
		planPath: "plans/260711-x/plan.md",
		status: "active",
		currentStep: "build",
		repos: [],
		blockers: [],
		nextAction: "write tests",
		verificationSummaries: [],
		evidenceRefs: [],
		capabilityDecisions: [],
		writtenByCli: "1.18.2",
		writtenByKit: "2.14.3",
		updatedAt: "2026-07-19T00:00:00.000Z",
		...over,
	};
}
const parseJson = (): Record<string, unknown> => JSON.parse(out.join("\n"));

describe("mewkit orient", () => {
	it("reports none when there are no records (--json)", async () => {
		process.chdir(makeRoot());
		orient({ json: true });
		expect(parseJson().outcome).toBe("none");
	});

	it("reports the active task resolved by the canonical pointer (--json)", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, rec({ taskId: "active-x" }));
		await writeActiveTaskPointer(root, { taskId: "active-x", planPath: "plans/260711-x/plan.md" });
		process.chdir(root);
		orient({ json: true });
		const env = parseJson() as { outcome: string; activeTask: { taskId: string } };
		expect(env.outcome).toBe("active");
		expect(env.activeTask.taskId).toBe("active-x");
	});

	it("reports ambiguous with candidates when multiple active records and no pointer", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, rec({ taskId: "task-a" }));
		await writeTaskRecord(root, rec({ taskId: "task-b" }));
		process.chdir(root);
		orient({ json: true });
		const env = parseJson() as { outcome: string; candidates: string[] };
		expect(env.outcome).toBe("ambiguous");
		expect(env.candidates.sort()).toEqual(["task-a", "task-b"]);
	});

	it("degrades cleanly when a recorded repo identity is missing (no crash, no stale warning)", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, rec({ taskId: "with-repo", repos: [{ identity: "/nonexistent/repo", revision: "a".repeat(40) }] }));
		await writeActiveTaskPointer(root, { taskId: "with-repo" });
		process.chdir(root);
		orient({ json: true });
		const env = parseJson() as { outcome: string; staleWarnings: string[] };
		expect(env.outcome).toBe("active");
		expect(env.staleWarnings).toEqual([]); // missing repo → null probe → no false "stale"
	});

	it("human output uses the bounded untrusted-state renderer", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, rec({ taskId: "active-x" }));
		await writeActiveTaskPointer(root, { taskId: "active-x", planPath: "plans/260711-x/plan.md" });
		process.chdir(root);
		orient({});
		expect(out.join("\n")).toContain(ORIENT_UNTRUSTED_HEADER);
		expect(out.join("\n")).toContain("orientation: active");
	});
});
