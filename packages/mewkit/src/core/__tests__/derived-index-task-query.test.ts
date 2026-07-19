// `mewkit query --task <id>` end-to-end: the derived index ingests canonical task identity from
// both top-level fields (fresh logs) and the data payload (transitional logs), filters strictly
// by task id, returns plan linkage, and leaves legacy logs (no task id) readable but unmatched.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex, queryByTask } from "../derived-index.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const LINES = [
	// legacy event — no task identity at all
	{ schema_version: "1.0", ts: "2026-07-12T10:00:00Z", event: "file_edited", run_id: "r0", data: { file: "a.ts" } },
	// fresh event — task identity at top level
	{
		schema_version: "1.0",
		ts: "2026-07-12T10:01:00Z",
		event: "task_transition",
		run_id: "r1",
		task_id: "feat-x",
		plan_path: "plans/260711-x/plan.md",
		data: { status: "active" },
	},
	{
		schema_version: "1.0",
		ts: "2026-07-12T10:02:00Z",
		event: "task_transition",
		run_id: "r1",
		task_id: "feat-x",
		plan_path: "plans/260711-x/plan.md",
		data: { status: "done" },
	},
	// transitional event — task identity nested in data only
	{
		schema_version: "1.0",
		ts: "2026-07-12T10:03:00Z",
		event: "capability_decision",
		run_id: "r2",
		data: { task_id: "feat-y", plan_path: "plans/260711-y/plan.md", decision: "selected" },
	},
];

function makeIndex(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-taskq-"));
	roots.push(root);
	const mem = join(root, ".claude", "memory");
	mkdirSync(mem, { recursive: true });
	writeFileSync(join(mem, "trace-log.jsonl"), LINES.map((l) => JSON.stringify(l)).join("\n") + "\n");
	buildIndex(join(root, ".claude"));
	return join(root, ".claude");
}

describe("queryByTask", () => {
	it("returns only the named task's events, oldest first, with plan linkage", () => {
		const claudeDir = makeIndex();
		const res = queryByTask(claudeDir, "feat-x");
		expect(res.events.map((e) => e.event)).toEqual(["task_transition", "task_transition"]);
		expect(res.plans).toEqual(["plans/260711-x/plan.md"]);
	});

	it("resolves task identity carried inside the data payload (transitional logs)", () => {
		const claudeDir = makeIndex();
		const res = queryByTask(claudeDir, "feat-y");
		expect(res.events).toHaveLength(1);
		expect(res.plans).toEqual(["plans/260711-y/plan.md"]);
	});

	it("returns an empty result for an unknown task (never throws)", () => {
		const claudeDir = makeIndex();
		expect(queryByTask(claudeDir, "nope").events).toEqual([]);
	});

	it("ingests the legacy no-task event but never matches it under --task", () => {
		const claudeDir = makeIndex();
		// The legacy 'file_edited' row is present in the index but carries no task id.
		expect(queryByTask(claudeDir, "feat-x").events.some((e) => e.event === "file_edited")).toBe(false);
	});

	it("throws only when no index has been built", () => {
		const root = mkdtempSync(join(tmpdir(), "mewkit-taskq-noidx-"));
		roots.push(root);
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		expect(() => queryByTask(join(root, ".claude"), "x")).toThrow(/no index/);
	});
});
