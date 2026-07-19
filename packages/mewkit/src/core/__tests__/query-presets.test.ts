// Phase-7 recovery-measurement presets over a fixture trace log: recovery-outcome distribution,
// stale-warning frequency, transitions-missing-task-context, and verification re-run counts.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex, queryPresets } from "../derived-index.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

// Two orient runs active (one with a stale warning), one none; two transitions with task context
// (one carrying a verification, twice for the same task) and one transition with no task id.
const LINES = [
	{ schema_version: "1.0", ts: "t1", event: "orient_run", task_id: "feat-x", data: { outcome: "active", staleWarnings: 1 } },
	{ schema_version: "1.0", ts: "t2", event: "orient_run", task_id: "feat-x", data: { outcome: "active", staleWarnings: 0 } },
	{ schema_version: "1.0", ts: "t3", event: "orient_run", data: { outcome: "none", staleWarnings: 0 } },
	{ schema_version: "1.0", ts: "t4", event: "task_transition", task_id: "feat-x", data: { status: "active", verifications: [{ ref: "build", result: "pass" }] } },
	{ schema_version: "1.0", ts: "t5", event: "task_transition", task_id: "feat-x", data: { status: "blocked", verifications: [{ ref: "build", result: "fail" }] } },
	{ schema_version: "1.0", ts: "t6", event: "task_transition", data: { status: "active" } }, // no task id
];

function makeIndex(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-presets-"));
	roots.push(root);
	const mem = join(root, ".claude", "memory");
	mkdirSync(mem, { recursive: true });
	writeFileSync(join(mem, "trace-log.jsonl"), LINES.map((l) => JSON.stringify(l)).join("\n") + "\n");
	buildIndex(join(root, ".claude"));
	return join(root, ".claude");
}

describe("queryPresets", () => {
	it("recovery-outcome distribution counts orient runs by outcome", () => {
		const p = queryPresets(makeIndex());
		const byOutcome = Object.fromEntries(p.recoveryOutcomes.map((r) => [r.outcome, r.n]));
		expect(byOutcome.active).toBe(2);
		expect(byOutcome.none).toBe(1);
	});

	it("stale-warning frequency counts orient runs with at least one warning", () => {
		const p = queryPresets(makeIndex());
		expect(p.staleWarnings).toEqual({ totalRuns: 3, runsWithStale: 1 });
	});

	it("transitions-missing-task-context counts transitions with no task id", () => {
		const p = queryPresets(makeIndex());
		expect(p.transitionsMissingTask).toEqual({ total: 3, missing: 1 });
	});

	it("verification re-run counts group verification-bearing transitions by task", () => {
		const p = queryPresets(makeIndex());
		expect(p.verificationRuns).toEqual([{ taskId: "feat-x", runs: 2 }]);
	});

	it("throws only when no index has been built", () => {
		const root = mkdtempSync(join(tmpdir(), "mewkit-presets-noidx-"));
		roots.push(root);
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		expect(() => queryPresets(join(root, ".claude"))).toThrow(/no index/);
	});
});
