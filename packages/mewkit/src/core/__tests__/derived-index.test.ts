import { mkdtemp, mkdir, rm, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex, queryIndex, dbPath, SCHEMA_VERSION } from "../derived-index.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const TRACE_LINES = [
	{ schema_version: "1.0", ts: "2026-06-20T10:00:00Z", event: "file_edited", run_id: "r1", data: { file: "a.ts" } },
	{ schema_version: "1.0", ts: "2026-06-20T10:01:00Z", event: "test_run", run_id: "r1", data: {} },
	{ schema_version: "1.0", ts: "2026-06-20T10:02:00Z", event: "friction", run_id: "r1", data: { message: "build failed", responsibility: "verification" } },
	{ schema_version: "1.0", ts: "2026-06-20T10:03:00Z", event: "friction", run_id: "r2", data: { message: "build failed", responsibility: "verification" } },
	{ schema_version: "1.0", ts: "2026-06-20T10:04:00Z", event: "review", run_id: "r2", data: {} },
];
const COST = [
	{ date: "2026-06-20", command: "cook", tier: "complex", model: "opus", tokens: 1200, task: "x" },
	{ date: "2026-06-20", command: "review", tier: "complex", model: "opus", tokens: 800, task: "y" },
];

async function makeLogs(): Promise<{ claudeDir: string; tracePath: string; costPath: string }> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-idx-"));
	tempDirs.push(root);
	const claudeDir = join(root, ".claude");
	const mem = join(claudeDir, "memory");
	await mkdir(mem, { recursive: true });
	const tracePath = join(mem, "trace-log.jsonl");
	const costPath = join(mem, "cost-log.json");
	await writeFile(tracePath, TRACE_LINES.map((r) => JSON.stringify(r)).join("\n") + "\n");
	await writeFile(costPath, JSON.stringify(COST));
	return { claudeDir, tracePath, costPath };
}

describe("buildIndex / queryIndex", () => {
	it("builds from logs and answers aggregate queries", async () => {
		const { claudeDir } = await makeLogs();
		const res = buildIndex(claudeDir);
		expect(res.traceRows).toBe(5);
		expect(res.costRows).toBe(2);
		expect(res.schemaVersion).toBe(SCHEMA_VERSION);

		const q = queryIndex(claudeDir);
		expect(q.eventsByType.find((e) => e.event === "friction")!.n).toBe(2);
		expect(q.frictionByResponsibility.find((r) => r.responsibility === "verification")!.n).toBe(2);
		expect(q.runsByTier.find((r) => r.run_id === "r1")!.events).toBe(3);
		expect(q.costByModel.find((c) => c.model === "opus")!.tokens).toBe(2000);
	});

	it("is rebuild-able: delete the DB → reindex → identical aggregates", async () => {
		const { claudeDir } = await makeLogs();
		buildIndex(claudeDir);
		const before = queryIndex(claudeDir);

		rmSync(dbPath(claudeDir)); // throw away the disposable index
		expect(existsSync(dbPath(claudeDir))).toBe(false);

		buildIndex(claudeDir); // rebuild from the canonical logs
		const after = queryIndex(claudeDir);
		expect(after).toEqual(before);
	});

	it("never mutates the canonical source logs", async () => {
		const { claudeDir, tracePath, costPath } = await makeLogs();
		const t0 = await readFile(tracePath, "utf-8");
		const c0 = await readFile(costPath, "utf-8");
		buildIndex(claudeDir);
		queryIndex(claudeDir);
		expect(await readFile(tracePath, "utf-8")).toBe(t0);
		expect(await readFile(costPath, "utf-8")).toBe(c0);
	});

	it("enables WAL and stamps the schema version on the DB", async () => {
		const { claudeDir } = await makeLogs();
		buildIndex(claudeDir);
		const db = new DatabaseSync(dbPath(claudeDir), { readOnly: true });
		try {
			expect((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode.toLowerCase()).toBe("wal");
			expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(SCHEMA_VERSION);
		} finally {
			db.close();
		}
	});

	it("queryIndex throws before any index is built (query is opt-in)", async () => {
		const { claudeDir } = await makeLogs();
		expect(() => queryIndex(claudeDir)).toThrow(/no index/);
	});

	it("handles empty/absent logs without error (zero rows)", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-idx-empty-"));
		tempDirs.push(root);
		await mkdir(join(root, ".claude", "memory"), { recursive: true });
		const res = buildIndex(join(root, ".claude"));
		expect(res.traceRows).toBe(0);
		expect(res.costRows).toBe(0);
		expect(queryIndex(join(root, ".claude")).eventsByType).toEqual([]);
	});
});
