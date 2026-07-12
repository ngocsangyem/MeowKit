// Phase 4 slice: durable task record — atomic write/read round-trip, schemaVersion
// compatibility handshake (loud reject on drift), id validation + containment, and resume
// reconstruction that surfaces a bad record as an issue instead of crashing.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
	writeTaskRecord,
	readTaskRecord,
	updateTaskRecord,
	reconstructResumeState,
	readActivePlanPointer,
	IncompatibleTaskRecordError,
	TASK_RECORD_SCHEMA_VERSION,
	type TaskRecord,
} from "../task-record.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-taskrec-"));
	roots.push(root);
	return root;
}

function record(over: Partial<TaskRecord> = {}): TaskRecord {
	return {
		schemaVersion: TASK_RECORD_SCHEMA_VERSION,
		taskId: "feat-x",
		planPath: "plans/260711-x/plan.md",
		status: "active",
		currentStep: "build",
		repos: [{ identity: "meowkit", revision: "abc123" }],
		blockers: [],
		nextAction: "write tests",
		verificationSummaries: [],
		evidenceRefs: [],
		capabilityDecisions: [{ capabilityId: "mk:cook", decision: "selected", reason: "impl intent", adapterSnapshotId: "s1" }],
		writtenByCli: "1.14.1",
		writtenByKit: "2.13.3",
		updatedAt: "2026-07-12T00:00:00.000Z",
		...over,
	};
}

describe("task record write/read", () => {
	it("round-trips atomically through tasks/active/<id>.json", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, record());
		const back = readTaskRecord(root, "feat-x");
		expect(back?.status).toBe("active");
		expect(back?.capabilityDecisions[0]?.decision).toBe("selected");
		expect(back?.repos[0]).toEqual({ identity: "meowkit", revision: "abc123" });
	});

	it("returns null for an absent record", () => {
		expect(readTaskRecord(makeRoot(), "nope")).toBeNull();
	});

	it("rejects an invalid task id (filename-unsafe) at write", async () => {
		await expect(writeTaskRecord(makeRoot(), record({ taskId: "../escape" }))).rejects.toThrow();
	});

	it("preserves a non-git repo with a null revision (no invented revision)", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, record({ taskId: "nogit", repos: [{ identity: "local-dir", revision: null }] }));
		expect(readTaskRecord(root, "nogit")?.repos[0]?.revision).toBeNull();
	});
});

describe("schemaVersion compatibility handshake", () => {
	it("rejects a record whose schemaVersion is outside the supported range (loud)", () => {
		const root = makeRoot();
		mkdirSync(join(root, "tasks", "active"), { recursive: true });
		writeFileSync(join(root, "tasks", "active", "future.json"), JSON.stringify({ schemaVersion: "99.0", taskId: "future" }));
		expect(() => readTaskRecord(root, "future")).toThrow(IncompatibleTaskRecordError);
	});

	it("writeTaskRecord refuses to overwrite an incompatible on-disk record (fails closed)", async () => {
		const root = makeRoot();
		mkdirSync(join(root, "tasks", "active"), { recursive: true });
		writeFileSync(join(root, "tasks", "active", "feat-x.json"), JSON.stringify({ schemaVersion: "99.0", taskId: "feat-x" }));
		await expect(writeTaskRecord(root, record({ taskId: "feat-x" }))).rejects.toThrow(IncompatibleTaskRecordError);
		// The incompatible record is left untouched.
		expect(JSON.parse(readFileSync(join(root, "tasks", "active", "feat-x.json"), "utf-8")).schemaVersion).toBe("99.0");
	});
});

describe("updateTaskRecord (read-modify-write under one lock)", () => {
	it("passes the existing record to the mutator and persists the result", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, record({ taskId: "u1", currentStep: "build" }));
		const seen: (TaskRecord | null)[] = [];
		await updateTaskRecord(root, "u1", (existing) => {
			seen.push(existing);
			return { ...existing!, currentStep: "review", updatedAt: "2026-07-12T01:00:00.000Z" };
		});
		expect(seen[0]?.currentStep).toBe("build"); // mutator saw the prior state
		expect(readTaskRecord(root, "u1")?.currentStep).toBe("review");
	});

	it("a status-only update preserves repos/blockers/capabilityDecisions (no wipe)", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, record({ taskId: "u2", blockers: ["waiting on review"] }));
		await updateTaskRecord(root, "u2", (e) => ({ ...e!, status: "blocked", updatedAt: "2026-07-12T02:00:00.000Z" }));
		const back = readTaskRecord(root, "u2");
		expect(back?.status).toBe("blocked");
		expect(back?.repos).toEqual([{ identity: "meowkit", revision: "abc123" }]);
		expect(back?.blockers).toEqual(["waiting on review"]);
		expect(back?.capabilityDecisions[0]?.decision).toBe("selected");
	});

	it("creates a fresh record when none exists (mutator receives null)", async () => {
		const root = makeRoot();
		const out = await updateTaskRecord(root, "u3", (e) => {
			expect(e).toBeNull();
			return record({ taskId: "u3", status: "active" });
		});
		expect(out.taskId).toBe("u3");
		expect(readTaskRecord(root, "u3")?.status).toBe("active");
	});
});

describe("storage root (flat-copy == plugin: consumer project tasks/active)", () => {
	it("writes the record at <projectRoot>/tasks/active/<id>.json", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, record({ taskId: "loc" }));
		expect(existsSync(join(root, "tasks", "active", "loc.json"))).toBe(true);
	});
});

describe("checkpoint join (active-plan pointer)", () => {
	it("reads the pointer from active-plan.json (path), slug fallback, then legacy text, else null", () => {
		const a = makeRoot();
		mkdirSync(join(a, "session-state"), { recursive: true });
		writeFileSync(join(a, "session-state", "active-plan.json"), JSON.stringify({ path: "plans/p1/plan.md" }));
		expect(readActivePlanPointer(a)).toBe("plans/p1/plan.md");

		const b = makeRoot();
		mkdirSync(join(b, "session-state"), { recursive: true });
		writeFileSync(join(b, "session-state", "active-plan.json"), JSON.stringify({ slug: "260712-x" }));
		expect(readActivePlanPointer(b)).toBe("260712-x");

		const c = makeRoot();
		mkdirSync(join(c, "session-state"), { recursive: true });
		writeFileSync(join(c, "session-state", "active-plan"), "plans/legacy/plan.md\n");
		expect(readActivePlanPointer(c)).toBe("plans/legacy/plan.md");

		expect(readActivePlanPointer(makeRoot())).toBeNull();
	});

	it("resume state exposes the active-plan pointer alongside records", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, record({ taskId: "cur", planPath: "plans/p1/plan.md" }));
		mkdirSync(join(root, "session-state"), { recursive: true });
		writeFileSync(join(root, "session-state", "active-plan.json"), JSON.stringify({ path: "plans/p1/plan.md" }));
		const state = reconstructResumeState(root);
		expect(state.activePlanPointer).toBe("plans/p1/plan.md");
		expect(state.records.find((r) => r.planPath === state.activePlanPointer)?.taskId).toBe("cur");
	});
});

describe("additive-field forward compatibility (passthrough)", () => {
	it("preserves an unknown additive field through a read-modify-write cycle", async () => {
		const root = makeRoot();
		mkdirSync(join(root, "tasks", "active"), { recursive: true });
		// A record from a future CLI: same schemaVersion 1.0 + an extra additive field.
		const future = { ...record({ taskId: "fwd" }), futureField: "keep-me" };
		writeFileSync(join(root, "tasks", "active", "fwd.json"), JSON.stringify(future));
		await updateTaskRecord(root, "fwd", (e) => ({ ...e!, status: "done", updatedAt: "2026-07-12T03:00:00.000Z" }));
		const raw = JSON.parse(readFileSync(join(root, "tasks", "active", "fwd.json"), "utf-8"));
		expect(raw.futureField).toBe("keep-me"); // not stripped
		expect(raw.status).toBe("done");
	});
});

describe("reconstructResumeState (resume reader)", () => {
	it("reads all active records from files only", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, record({ taskId: "a" }));
		await writeTaskRecord(root, record({ taskId: "b", status: "blocked" }));
		const state = reconstructResumeState(root);
		expect(state.records.map((r) => r.taskId).sort()).toEqual(["a", "b"]);
		expect(state.issues).toEqual([]);
	});

	it("surfaces a corrupt/incompatible record as an issue without failing the whole reconstruction", async () => {
		const root = makeRoot();
		await writeTaskRecord(root, record({ taskId: "good" }));
		mkdirSync(join(root, "tasks", "active"), { recursive: true });
		writeFileSync(join(root, "tasks", "active", "bad.json"), JSON.stringify({ schemaVersion: "99.0" }));
		const state = reconstructResumeState(root);
		expect(state.records.map((r) => r.taskId)).toEqual(["good"]);
		expect(state.issues.some((i) => i.taskId === "bad")).toBe(true);
	});
});
