import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reflect } from "../reflect.js";

const tempDirs: string[] = [];
let cwdSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	cwdSpy?.mockRestore();
	logSpy?.mockRestore();
});

const rec = (event: string, ts: string, data: Record<string, unknown> = {}): string =>
	JSON.stringify({ schema_version: "1.0", ts, event, data });

const isoDaysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");

/** Create a temp project rooted at a fake cwd with a trace log, and point process.cwd() at it. */
function withLog(lines: string[]): { output: () => string } {
	const root = mkdtempSync(join(tmpdir(), "mewkit-reflect-"));
	tempDirs.push(root);
	const memoryDir = join(root, ".claude", "memory");
	mkdirSync(memoryDir, { recursive: true });
	if (lines.length > 0) writeFileSync(join(memoryDir, "trace-log.jsonl"), lines.join("\n") + "\n");
	cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
	const chunks: string[] = [];
	logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
		chunks.push(args.map(String).join(" "));
	});
	return { output: () => chunks.join("\n") };
}

describe("reflect", () => {
	it("renders an explicit no-data message for an empty log (exit 0)", () => {
		const { output } = withLog([]);
		reflect({});
		expect(output()).toMatch(/No events in window/i);
	});

	it("counts gate blocks grouped by gate and reason", () => {
		const { output } = withLog([
			rec("gate.blocked", isoDaysAgo(0), { gate: "gate1-no-plan", reason: "no plan" }),
			rec("gate.blocked", isoDaysAgo(0), { gate: "gate1-no-plan", reason: "no plan" }),
			rec("privacy.blocked", isoDaysAgo(0), { kind: "sensitive-read" }),
		]);
		reflect({ json: true });
		const report = JSON.parse(output());
		expect(report.gateBlocks).toContainEqual({ label: "gate1-no-plan — no plan", count: 2 });
		expect(report.privacyBlocks).toContainEqual({ label: "sensitive-read", count: 1 });
	});

	it("detects repeated review failures with a repeat count", () => {
		const { output } = withLog([
			rec("verdict_written", isoDaysAgo(0), { slug: "auth", overall: "FAIL" }),
			rec("verdict_written", isoDaysAgo(0), { slug: "auth", overall: "FAIL" }),
			rec("verdict_written", isoDaysAgo(0), { slug: "billing", overall: "PASS" }),
		]);
		reflect({ json: true });
		const report = JSON.parse(output());
		expect(report.repeatedReviewFailures).toContainEqual({ label: "auth", count: 2 });
		expect(report.reviewOutcomes).toContainEqual({ label: "FAIL", count: 2 });
		expect(report.reviewOutcomes).toContainEqual({ label: "PASS", count: 1 });
	});

	it("reports reserved metrics as null (N/A), never zero", () => {
		const { output } = withLog([rec("gate.blocked", isoDaysAgo(0), { gate: "gate1-no-plan", reason: "x" })]);
		reflect({ json: true });
		const report = JSON.parse(output());
		expect(report.skillsInvoked).toBeNull();
		expect(report.memoryWrites).toBeNull();
		expect(report.selfHealingAttempts).toBeNull();
		expect(report.timings).toBeNull();
	});

	it("windows by --last", () => {
		const { output } = withLog([
			rec("gate.blocked", isoDaysAgo(10), { gate: "gate1-no-plan", reason: "old" }),
			rec("gate.blocked", isoDaysAgo(1), { gate: "gate1-no-plan", reason: "recent" }),
		]);
		reflect({ last: "7d", json: true });
		const report = JSON.parse(output());
		expect(report.totalEvents).toBe(1);
		expect(report.gateBlocks).toContainEqual({ label: "gate1-no-plan — recent", count: 1 });
	});

	it("filters by --task", () => {
		const { output } = withLog([
			rec("gate.blocked", isoDaysAgo(0), { gate: "g", reason: "r", task: "t1" }),
			rec("gate.blocked", isoDaysAgo(0), { gate: "g", reason: "r", task: "t2" }),
		]);
		reflect({ task: "t1", json: true });
		const report = JSON.parse(output());
		expect(report.totalEvents).toBe(1);
	});
});
