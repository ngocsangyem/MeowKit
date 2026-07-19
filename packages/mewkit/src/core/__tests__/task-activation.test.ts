// Durable activation: one active record + canonical pointer committed as an all-or-fail unit,
// idempotent reactivation (never a duplicate record), and the rollback/repair contract when the
// pointer commit fails after the record write.
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	activateTask,
	ActivationError,
	normalizeTaskId,
	readTaskRecord,
	readActiveTaskPointer,
	listTaskRecordIds,
} from "../task-record.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-activate-"));
	roots.push(root);
	return root;
}
const NOW = "2026-07-19T12:00:00.000Z";

describe("normalizeTaskId", () => {
	it("coerces a plan slug to a valid, capped task id", () => {
		expect(normalizeTaskId("260719-1604-Meow Kit!!")).toBe("260719-1604-meow-kit");
		expect(normalizeTaskId("---")).toBe("task");
		expect(normalizeTaskId("A".repeat(200)).length).toBeLessThanOrEqual(64);
	});
});

describe("activateTask", () => {
	it("commits exactly one active record + canonical pointer", async () => {
		const root = makeRoot();
		const res = await activateTask(root, { taskId: "feat-x", planPath: "plans/260711-x/plan.md", planSlug: "260711-x", now: NOW });
		expect(res.createdRecord).toBe(true);
		expect(readTaskRecord(root, "feat-x")?.status).toBe("active");
		const pointer = readActiveTaskPointer(root);
		expect(pointer?.kind).toBe("canonical");
		if (pointer?.kind === "canonical") expect(pointer.pointer.taskId).toBe("feat-x");
		expect(listTaskRecordIds(root)).toEqual(["feat-x"]);
	});

	it("is idempotent — re-activation keeps ONE record", async () => {
		const root = makeRoot();
		await activateTask(root, { taskId: "feat-x", planPath: "plans/x/plan.md", now: NOW });
		await activateTask(root, { taskId: "feat-x", planPath: "plans/x/plan.md", now: "2026-07-19T13:00:00.000Z" });
		expect(listTaskRecordIds(root)).toEqual(["feat-x"]);
	});

	it("supports no-plan activation recoverable by task id", async () => {
		const root = makeRoot();
		await activateTask(root, { taskId: "adhoc", planPath: null, now: NOW });
		expect(readTaskRecord(root, "adhoc")?.planPath).toBeNull();
		const pointer = readActiveTaskPointer(root);
		expect(pointer?.kind === "canonical" && pointer.pointer.taskId).toBe("adhoc");
	});

	it("rolls back a newly-created record and throws when the pointer commit fails", async () => {
		const root = makeRoot();
		// Force writeActiveTaskPointer to fail: occupy session-state with a regular FILE so the
		// pointer dir cannot be created.
		writeFileSync(join(root, "session-state"), "not a dir");
		await expect(activateTask(root, { taskId: "feat-x", planPath: "plans/x/plan.md", now: NOW })).rejects.toBeInstanceOf(
			ActivationError,
		);
		// The partial (newly created) record was rolled back — never left claiming activation.
		expect(existsSync(join(root, "tasks", "active", "feat-x.json"))).toBe(false);
	});

	it("carries rolledBack=true and the task id on the ActivationError", async () => {
		const root = makeRoot();
		writeFileSync(join(root, "session-state"), "not a dir");
		try {
			await activateTask(root, { taskId: "feat-y", planPath: null, now: NOW });
			throw new Error("expected activation to fail");
		} catch (err) {
			expect(err).toBeInstanceOf(ActivationError);
			const ae = err as ActivationError;
			expect(ae.taskId).toBe("feat-y");
			expect(ae.rolledBack).toBe(true);
		}
	});

	it("does NOT roll back a pre-existing record when the pointer commit fails", async () => {
		const root = makeRoot();
		// Pre-create the record via a first successful activation, then break the pointer path.
		await activateTask(root, { taskId: "feat-z", planPath: "plans/z/plan.md", now: NOW });
		rmSync(join(root, "session-state"), { recursive: true, force: true });
		writeFileSync(join(root, "session-state"), "not a dir");
		await expect(activateTask(root, { taskId: "feat-z", planPath: "plans/z/plan.md", now: NOW })).rejects.toBeInstanceOf(
			ActivationError,
		);
		// The pre-existing record survives (repairable), never deleted.
		expect(existsSync(join(root, "tasks", "active", "feat-z.json"))).toBe(true);
	});
});

describe("marking done clears only the pointed task's pointer", () => {
	it("keeps the record but the pointer is cleared for the matching task", async () => {
		const root = makeRoot();
		await activateTask(root, { taskId: "feat-x", planPath: "plans/x/plan.md", now: NOW });
		// Re-read raw pointer to confirm it exists, then simulate done via the exported clear.
		const { clearActiveTaskPointer } = await import("../task-record.js");
		expect(await clearActiveTaskPointer(root, "other")).toBe(false); // different task → untouched
		expect(readActiveTaskPointer(root)?.kind).toBe("canonical");
		expect(await clearActiveTaskPointer(root, "feat-x")).toBe(true);
		expect(readActiveTaskPointer(root)).toBeNull();
		// The record itself is NOT removed by clearing the pointer.
		mkdirSync(join(root, "tasks", "active"), { recursive: true });
		expect(readTaskRecord(root, "feat-x")?.taskId).toBe("feat-x");
		expect(readFileSync(join(root, "tasks", "active", "feat-x.json"), "utf-8")).toContain("feat-x");
	});
});
