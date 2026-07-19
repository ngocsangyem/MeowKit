// Trace-append primitive: record shape (task identity top-level, scrubbed data), rotation, and
// the concurrency guarantees that matter for a shared JSONL log — the TS writer alone, and the
// shell writer + TS writer contending on the same sidecar lock, must never interleave or corrupt
// a line.
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendTraceRecord, appendTraceRecordSync, TRACE_MAX_BYTES } from "../trace-append.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
function makeClaudeDir(): { root: string; claudeDir: string; logPath: string } {
	const root = mkdtempSync(join(tmpdir(), "mewkit-trace-"));
	roots.push(root);
	const claudeDir = join(root, ".claude");
	mkdirSync(join(claudeDir, "memory"), { recursive: true });
	return { root, claudeDir, logPath: join(claudeDir, "memory", "trace-log.jsonl") };
}
function readLines(logPath: string): string[] {
	return readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
}

describe("appendTraceRecord — record shape", () => {
	it("writes canonical task identity at top level and scrubs secret-shaped data", async () => {
		const { claudeDir, logPath } = makeClaudeDir();
		await appendTraceRecord(claudeDir, {
			event: "task_transition",
			taskId: "feat-x",
			planPath: "plans/260711-x/plan.md",
			data: { note: "api_key=sk-abcdef0123456789 done" },
			now: new Date("2026-07-12T00:00:00Z"),
		});
		const rec = JSON.parse(readLines(logPath)[0]);
		expect(rec.task_id).toBe("feat-x");
		expect(rec.plan_path).toBe("plans/260711-x/plan.md");
		expect(rec.schema_version).toBe("1.0");
		expect(rec.ts).toBe("2026-07-12T00:00:00Z");
		expect(JSON.stringify(rec.data)).not.toContain("sk-abcdef0123456789");
	});

	it("omits task_id/plan_path when not supplied (legacy-shaped line)", async () => {
		const { claudeDir, logPath } = makeClaudeDir();
		await appendTraceRecord(claudeDir, { event: "friction", data: {} });
		const rec = JSON.parse(readLines(logPath)[0]);
		expect(rec).not.toHaveProperty("task_id");
		expect(rec).not.toHaveProperty("plan_path");
	});
});

describe("appendTraceRecord — rotation", () => {
	it("rotates a >50MB log to a .gz and starts a fresh log", async () => {
		const { claudeDir, logPath } = makeClaudeDir();
		// Pre-fill above the threshold with valid JSONL, then one more append triggers rotation.
		const bigLine = JSON.stringify({ schema_version: "1.0", event: "pad", data: { x: "y".repeat(200) } }) + "\n";
		const repeats = Math.ceil((TRACE_MAX_BYTES + 1024) / bigLine.length);
		writeFileSync(logPath, bigLine.repeat(repeats));
		await appendTraceRecord(claudeDir, { event: "post_rotate", data: {}, now: new Date("2026-07-12T00:00:00Z") });
		const gz = readdirSync(join(claudeDir, "memory")).filter((f) => f.endsWith(".jsonl.gz"));
		expect(gz.length).toBe(1);
		// Fresh log holds only lines appended after rotation, all valid JSON.
		const lines = readLines(logPath);
		expect(lines.length).toBeLessThan(repeats);
		for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
	});
});

describe("appendTraceRecord — concurrency (no interleaving/corruption)", () => {
	it("keeps every line valid under many concurrent async appends", async () => {
		const { claudeDir, logPath } = makeClaudeDir();
		const N = 30;
		// Async-only: the async lock releases run on the event loop, so N concurrent appends
		// serialize cleanly. (Mixing SYNC appends into the same process is not a real usage — the
		// sync writer is the wiki adapter and the async writer is task-state; they run in separate
		// CLI processes. Cross-process contention is covered by the shell+TS parity test below.)
		await Promise.all(Array.from({ length: N }, (_, i) => appendTraceRecord(claudeDir, { event: "async_ev", data: { i } })));
		const lines = readLines(logPath);
		expect(lines.length).toBe(N);
		for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
	});

	it("appends valid lines through the sync writer (sequential)", () => {
		const { claudeDir, logPath } = makeClaudeDir();
		const N = 10;
		for (let i = 0; i < N; i++) appendTraceRecordSync(claudeDir, { event: "sync_ev", data: { i } });
		const lines = readLines(logPath);
		expect(lines.length).toBe(N);
		for (const l of lines) expect(JSON.parse(l).event).toBe("sync_ev");
	});
});

function python3Available(): boolean {
	if (existsSync(resolve(process.cwd(), "..", "..", ".claude", "skills", ".venv", "bin", "python3"))) return true;
	return spawnSync("python3", ["--version"], { stdio: "ignore" }).status === 0;
}

describe("shell + TS parity (shared sidecar lock across languages)", () => {
	it("neither writer interleaves or corrupts a line under concurrent append", async () => {
		if (!python3Available()) return; // the shell writer builds its record via python3
		const scriptPath = resolve(process.cwd(), "..", "..", ".claude", "hooks", "append-trace.sh");
		if (!existsSync(scriptPath)) return;
		const { root, claudeDir, logPath } = makeClaudeDir();
		const N = 6;
		const shell = Array.from({ length: N }, (_, i) =>
			new Promise<void>((res) => {
				const p = spawn("bash", [scriptPath, "shell_ev", JSON.stringify({ i })], {
					env: { ...process.env, CLAUDE_PROJECT_DIR: root },
					stdio: "ignore",
				});
				p.on("close", () => res());
				p.on("error", () => res());
			}),
		);
		const ts = Array.from({ length: N }, (_, i) => appendTraceRecord(claudeDir, { event: "ts_ev", data: { i } }));
		const tsResults = await Promise.allSettled(ts);
		await Promise.all(shell);
		const tsLanded = tsResults.filter((r) => r.status === "fulfilled").length;
		const lines = readLines(logPath);
		// PRIMARY guarantee: every line is a complete, valid, non-interleaved JSON record.
		const events = lines.map((l) => JSON.parse(l).event as string);
		// Every landed line is attributable to one of the two writers — no corrupted/spliced line.
		expect(events.every((e) => e === "shell_ev" || e === "ts_ev")).toBe(true);
		// Every async TS append that resolved landed exactly one line (the lock never dropped one).
		expect(events.filter((e) => e === "ts_ev").length).toBe(tsLanded);
		// Cross-language contention actually occurred: at least one shell writer landed on the same
		// lock. (The shell writer is advisory and MAY drop under severe CPU starvation, so the exact
		// shell count is not asserted — the non-interleaving guarantee above is what matters.)
		expect(events.filter((e) => e === "shell_ev").length).toBeGreaterThan(0);
	});
});
