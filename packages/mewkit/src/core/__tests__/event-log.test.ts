import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { utimesSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { readEvents, parseSince } from "../event-log.js";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Build a temp `.claude` dir with a `memory/` holding the given trace files. */
function scaffold(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-eventlog-"));
	tempDirs.push(root);
	const memoryDir = join(root, ".claude", "memory");
	mkdirSync(memoryDir, { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		writeFileSync(join(memoryDir, name), content);
	}
	return join(root, ".claude");
}

const rec = (event: string, ts: string, data: Record<string, unknown> = {}): string =>
	JSON.stringify({ schema_version: "1.0", ts, event, run_id: "r1", harness_version: "3.0.0", data });

const isoDaysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");

describe("parseSince", () => {
	it("parses relative day/hour specs and ISO instants", () => {
		const now = Date.now();
		expect(parseSince("7d")).toBeLessThanOrEqual(now - 7 * 86_400_000 + 1000);
		expect(parseSince("2h")).toBeLessThanOrEqual(now - 2 * 3_600_000 + 1000);
		expect(parseSince("2026-01-01T00:00:00Z")).toBe(Date.parse("2026-01-01T00:00:00Z"));
	});

	it("returns null for absent or unparseable specs", () => {
		expect(parseSince(undefined)).toBeNull();
		expect(parseSince("not-a-date")).toBeNull();
	});
});

describe("readEvents", () => {
	it("reads well-formed lines and ignores blank lines", () => {
		const claudeDir = scaffold({
			"trace-log.jsonl": [rec("file_edited", isoDaysAgo(1)), "", rec("gate.blocked", isoDaysAgo(0))].join("\n") + "\n",
		});
		const { events, malformed } = readEvents(claudeDir);
		expect(events.map((e) => e.event)).toEqual(["file_edited", "gate.blocked"]);
		expect(malformed).toBe(0);
	});

	it("skips and tallies a malformed JSON line", () => {
		const claudeDir = scaffold({
			"trace-log.jsonl": [rec("file_edited", isoDaysAgo(1)), "{not valid json", rec("gate.blocked", isoDaysAgo(0))].join("\n"),
		});
		const { events, malformed } = readEvents(claudeDir);
		expect(events).toHaveLength(2);
		expect(malformed).toBe(1);
	});

	it("skips and tallies an oversized (>64 KiB) line", () => {
		const huge = JSON.stringify({ schema_version: "1.0", ts: isoDaysAgo(0), event: "file_edited", data: { blob: "x".repeat(100 * 1024) } });
		const claudeDir = scaffold({ "trace-log.jsonl": [rec("gate.blocked", isoDaysAgo(0)), huge].join("\n") });
		const { events, malformed } = readEvents(claudeDir);
		expect(events).toHaveLength(1);
		expect(malformed).toBe(1);
	});

	it("folds an in-window rotated .gz archive", () => {
		const claudeDir = scaffold({
			"trace-log.jsonl": rec("gate.blocked", isoDaysAgo(0)) + "\n",
			"trace-log.260530-101010.jsonl.gz": "",
		});
		// Overwrite the .gz with real gzip content and set its mtime inside the window.
		const gzPath = join(claudeDir, "memory", "trace-log.260530-101010.jsonl.gz");
		writeFileSync(gzPath, gzipSync(Buffer.from(rec("file_edited", isoDaysAgo(2)) + "\n")));
		utimesSync(gzPath, new Date(), new Date(Date.now() - 2 * 86_400_000));
		const { events } = readEvents(claudeDir, { since: "7d" });
		expect(events.map((e) => e.event).sort()).toEqual(["file_edited", "gate.blocked"]);
	});

	it("excludes a rotated archive whose mtime predates the since window", () => {
		const claudeDir = scaffold({ "trace-log.jsonl": rec("gate.blocked", isoDaysAgo(0)) + "\n" });
		const gzPath = join(claudeDir, "memory", "trace-log.250101-000000.jsonl.gz");
		writeFileSync(gzPath, gzipSync(Buffer.from(rec("file_edited", isoDaysAgo(40)) + "\n")));
		utimesSync(gzPath, new Date(), new Date(Date.now() - 40 * 86_400_000));
		const { events } = readEvents(claudeDir, { since: "7d" });
		expect(events.map((e) => e.event)).toEqual(["gate.blocked"]);
	});

	it("filters by since, task, and types", () => {
		const claudeDir = scaffold({
			"trace-log.jsonl": [
				rec("gate.blocked", isoDaysAgo(10), { task: "t1" }),
				rec("gate.blocked", isoDaysAgo(1), { task: "t1" }),
				rec("hook.failed", isoDaysAgo(1), { task: "t2" }),
			].join("\n"),
		});
		expect(readEvents(claudeDir, { since: "7d" }).events).toHaveLength(2);
		expect(readEvents(claudeDir, { task: "t1" }).events).toHaveLength(2);
		expect(readEvents(claudeDir, { types: ["hook.failed"] }).events).toHaveLength(1);
	});

	it("returns empty + zero malformed when the log is absent", () => {
		const claudeDir = scaffold({});
		const { events, malformed } = readEvents(claudeDir);
		expect(events).toEqual([]);
		expect(malformed).toBe(0);
	});

	it("sorts events chronologically", () => {
		const claudeDir = scaffold({
			"trace-log.jsonl": [rec("a_late", isoDaysAgo(0)), rec("b_early", isoDaysAgo(5))].join("\n"),
		});
		const { events } = readEvents(claudeDir);
		expect(events.map((e) => e.event)).toEqual(["b_early", "a_late"]);
	});
});
