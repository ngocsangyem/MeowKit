import { describe, expect, it } from "vitest";
import {
	parseTraceLog,
	scoreTier,
	scoreByRun,
	shannonEntropy,
	normalizeFriction,
	groupFriction,
	auditTraces,
	proposeImprovements,
	type TraceRecord,
} from "../trace-analysis.js";

const rec = (over: Partial<TraceRecord> = {}): TraceRecord => ({ event: "file_edited", run_id: "r1", ...over });
const friction = (message: string, over: Partial<TraceRecord> = {}): TraceRecord =>
	rec({ event: "friction", data: { message }, ...over });

describe("parseTraceLog", () => {
	it("parses JSONL and skips blank/malformed lines", () => {
		const content = `${JSON.stringify(rec())}\n\nnot json\n${JSON.stringify(rec({ event: "test_run" }))}\n`;
		expect(parseTraceLog(content)).toHaveLength(2);
	});
});

describe("scoreTier", () => {
	it("minimal when sparse, standard when moderate, detailed when rich+diverse", () => {
		expect(scoreTier([rec()]).tier).toBe("minimal");
		expect(scoreTier([rec(), rec({ event: "test_run" }), rec({ event: "review" })]).tier).toBe("standard");
		const many = Array.from({ length: 10 }, (_, i) => rec({ event: `e${i % 5}` }));
		expect(scoreTier(many).tier).toBe("detailed");
	});

	it("scoreByRun keys lanes by run_id and buckets the unattributed", () => {
		const m = scoreByRun([rec({ run_id: "a" }), rec({ run_id: "b" }), rec({ run_id: undefined })]);
		expect(m.has("a")).toBe(true);
		expect(m.has("b")).toBe(true);
		expect(m.has("(unattributed)")).toBe(true);
	});
});

describe("shannonEntropy", () => {
	it("is 0 for a single event type and positive for a mix", () => {
		expect(shannonEntropy([rec(), rec()])).toBe(0);
		expect(shannonEntropy([rec({ event: "a" }), rec({ event: "b" })])).toBeGreaterThan(0);
	});
});

describe("normalizeFriction + groupFriction", () => {
	it("collapses 3 identical friction lines into 1 grouped item with count 3", () => {
		const recs = [
			friction("Build failed: tsc not found"),
			friction("build failed: tsc not found."),
			friction("  BUILD FAILED: tsc not found  "),
		];
		const groups = groupFriction(recs);
		expect(groups).toHaveLength(1);
		expect(groups[0].count).toBe(3);
	});

	it("keeps distinct friction separate and carries responsibility", () => {
		const groups = groupFriction([
			friction("flaky test", { data: { message: "flaky test", responsibility: "verification" } }),
			friction("slow build"),
		]);
		expect(groups).toHaveLength(2);
		expect(groups.find((g) => g.message === "flaky test")?.responsibility).toBe("verification");
	});
});

describe("auditTraces", () => {
	const now = new Date("2026-06-27T00:00:00Z");
	it("counts orphaned, stale, unverified runs, repeated friction, and friction-by-responsibility", () => {
		const recs: TraceRecord[] = [
			rec({ run_id: undefined }), // orphaned
			rec({ ts: "2026-01-01T00:00:00Z" }), // stale (>30d)
			rec({ run_id: "work-only", event: "file_edited" }), // work, no verify → unverified run
			friction("disk full", { data: { message: "disk full", responsibility: "observability" } }),
			friction("disk full"),
		];
		const a = auditTraces(recs, { now, staleDays: 30 });
		expect(a.orphaned).toBe(1);
		expect(a.stale).toBe(1);
		expect(a.unverifiedRuns).toBeGreaterThanOrEqual(1);
		expect(a.repeatedFriction.find((g) => g.message === "disk full")?.count).toBe(2);
		expect(a.frictionByResponsibility["observability"]).toBe(1);
	});

	it("a run with both work and verification is NOT unverified", () => {
		const a = auditTraces([rec({ run_id: "ok", event: "file_edited" }), rec({ run_id: "ok", event: "test_run" })], { now });
		expect(a.unverifiedRuns).toBe(0);
	});
});

describe("proposeImprovements", () => {
	it("emits one item per repeated friction group plus drift findings", () => {
		const now = new Date("2026-06-27T00:00:00Z");
		const recs = [friction("x"), friction("x"), rec({ run_id: undefined })];
		const items = proposeImprovements(auditTraces(recs, { now }));
		expect(items.some((i) => i.kind === "friction" && i.evidenceCount === 2)).toBe(true);
		expect(items.some((i) => i.kind === "drift")).toBe(true);
	});
});
