// Contract tests for the pure orientation envelope builder and the canonical/legacy pointer
// round-trip. The builder takes only data (ResumeState + pointer + probes), so it cannot touch
// the filesystem — the "purity" tests exercise that by feeding non-existent paths and asserting
// deterministic output with no side effects.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeActiveTaskPointer, readActiveTaskPointer, clearActiveTaskPointer } from "../task-record.js";
import { buildOrientEnvelope, planSlugFromPath } from "../orient-envelope.js";
import { fixtures } from "./fixtures/recovery-states.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-orient-"));
	roots.push(root);
	return root;
}

describe("buildOrientEnvelope — honest outcomes", () => {
	it("no record → none", () => {
		const e = buildOrientEnvelope(fixtures.noRecord.state, fixtures.noRecord.pointer);
		expect(e.outcome).toBe("none");
		expect(e.activeTask).toBeNull();
	});

	it("active planned → active with plan slug resolved", () => {
		const e = buildOrientEnvelope(fixtures.activePlanned.state, fixtures.activePlanned.pointer);
		expect(e.outcome).toBe("active");
		expect(e.activeTask?.taskId).toBe("active-planned");
		expect(e.activeTask?.status).toBe("active");
		expect(e.activeTask?.planSlug).toBe("260711-x");
	});

	it("no-plan active task remains recoverable through the canonical pointer taskId", () => {
		const e = buildOrientEnvelope(fixtures.activeNoPlan.state, fixtures.activeNoPlan.pointer);
		expect(e.outcome).toBe("active");
		expect(e.activeTask?.taskId).toBe("no-plan");
		expect(e.activeTask?.planPath).toBeNull();
	});

	it("blocked task resolves as active with status=blocked (explicit, not auto-resumable)", () => {
		const e = buildOrientEnvelope(fixtures.blocked.state, fixtures.blocked.pointer);
		expect(e.outcome).toBe("active");
		expect(e.activeTask?.status).toBe("blocked");
		expect(e.activeTask?.blockers).toEqual(["waiting on review"]);
	});

	it("done-only → none (a completed record is never resumed)", () => {
		const e = buildOrientEnvelope(fixtures.doneOnly.state, fixtures.doneOnly.pointer);
		expect(e.outcome).toBe("none");
	});

	it("corrupt-only → corrupt-only, with the bad record surfaced as an issue", () => {
		const e = buildOrientEnvelope(fixtures.corruptOnly.state, fixtures.corruptOnly.pointer);
		expect(e.outcome).toBe("corrupt-only");
		expect(e.issues.map((i) => i.taskId)).toContain("bad");
	});

	it("stale → active with a definite revision-mismatch warning", () => {
		const e = buildOrientEnvelope(fixtures.stale.state, fixtures.stale.pointer, fixtures.stale.probes);
		expect(e.outcome).toBe("active");
		expect(e.staleWarnings).toHaveLength(1);
		expect(e.staleWarnings[0]).toMatch(/\/work\/meowkit moved from/);
	});

	it("non-git repo (null revision) produces no stale warning", () => {
		const e = buildOrientEnvelope(fixtures.nonGit.state, fixtures.nonGit.pointer, fixtures.nonGit.probes);
		expect(e.outcome).toBe("active");
		expect(e.staleWarnings).toEqual([]);
	});

	it("multiple unmatched active records → ambiguous with every candidate id", () => {
		const e = buildOrientEnvelope(fixtures.multiActive.state, fixtures.multiActive.pointer);
		expect(e.outcome).toBe("ambiguous");
		expect(e.candidates).toEqual(["task-a", "task-b"]);
		expect(e.activeTask).toBeNull();
	});

	it("legacy pointer matches a plan slug EXACTLY — no substring bleed into a sibling plan", () => {
		const e = buildOrientEnvelope(fixtures.pointerCollision.state, fixtures.pointerCollision.pointer);
		expect(e.outcome).toBe("active");
		expect(e.activeTask?.taskId).toBe("task-a"); // 260711-alpha, NOT 260711-alpha-extended
		expect(e.pointerKind).toBe("legacy");
	});

	it("a canonical pointer to a done/missing task falls through to non-pointer resolution", () => {
		// pointer names 'shipped' (done) → not resolvable → only done records remain → none
		const e = buildOrientEnvelope(fixtures.doneOnly.state, fixtures.doneOnly.pointer);
		expect(e.outcome).toBe("none");
	});
});

describe("buildOrientEnvelope — purity (no filesystem/git access)", () => {
	it("is deterministic and side-effect-free for non-existent absolute paths", () => {
		const state = fixtures.stale.state;
		const a = buildOrientEnvelope(state, fixtures.stale.pointer, fixtures.stale.probes);
		const b = buildOrientEnvelope(state, fixtures.stale.pointer, fixtures.stale.probes);
		expect(a).toEqual(b); // same input → same output, no hidden state
	});
});

describe("planSlugFromPath", () => {
	it("derives the plan directory as the slug", () => {
		expect(planSlugFromPath("plans/260711-x/plan.md")).toBe("260711-x");
		expect(planSlugFromPath("plans/260711-x/phase-01.md")).toBe("260711-x");
		expect(planSlugFromPath("260711-x")).toBe("260711-x");
		expect(planSlugFromPath(null)).toBeNull();
	});
});

describe("active-task pointer round-trip (canonical + legacy read compatibility)", () => {
	it("round-trips the taskId through a canonical JSON pointer", async () => {
		const root = makeRoot();
		await writeActiveTaskPointer(root, { taskId: "feat-x", planPath: "plans/260711-x/plan.md", planSlug: "260711-x" });
		const res = readActiveTaskPointer(root);
		expect(res?.kind).toBe("canonical");
		if (res?.kind === "canonical") expect(res.pointer.taskId).toBe("feat-x");
	});

	it("mirrors path/slug so the legacy checkpoint reader keeps working", async () => {
		const root = makeRoot();
		await writeActiveTaskPointer(root, { taskId: "feat-x", planPath: "plans/260711-x/plan.md", planSlug: "260711-x" });
		const raw = JSON.parse(readFileSync(join(root, "session-state", "active-plan.json"), "utf-8"));
		expect(raw.path).toBe("plans/260711-x/plan.md");
		expect(raw.slug).toBe("260711-x");
	});

	it("reads a legacy path-only pointer as a legacy plan reference (no taskId)", () => {
		const root = makeRoot();
		mkdirSync(join(root, "session-state"), { recursive: true });
		writeFileSync(join(root, "session-state", "active-plan.json"), JSON.stringify({ path: "plans/260711-x/plan.md" }));
		const res = readActiveTaskPointer(root);
		expect(res).toEqual({ kind: "legacy", planRef: "plans/260711-x/plan.md" });
	});

	it("reads a legacy plain-text pointer as a normalized legacy reference", () => {
		const root = makeRoot();
		mkdirSync(join(root, "session-state"), { recursive: true });
		writeFileSync(join(root, "session-state", "active-plan"), "260711-x\n");
		expect(readActiveTaskPointer(root)).toEqual({ kind: "legacy", planRef: "260711-x" });
	});

	it("returns null when no pointer exists", () => {
		expect(readActiveTaskPointer(makeRoot())).toBeNull();
	});

	it("clears the pointer only when it names the given task", async () => {
		const root = makeRoot();
		await writeActiveTaskPointer(root, { taskId: "feat-x" });
		expect(await clearActiveTaskPointer(root, "other")).toBe(false);
		expect(existsSync(join(root, "session-state", "active-plan.json"))).toBe(true);
		expect(await clearActiveTaskPointer(root, "feat-x")).toBe(true);
		expect(existsSync(join(root, "session-state", "active-plan.json"))).toBe(false);
	});
});
