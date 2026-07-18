import { mkdtemp, mkdir, rm, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex, queryIndex, dbPath, SCHEMA_VERSION } from "../derived-index.js";
import { searchWiki, listWikiPages } from "../../wiki/infrastructure/wiki-query.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const TRACE_LINES = [
	{ schema_version: "1.0", ts: "2026-06-20T10:00:00Z", event: "file_edited", run_id: "r1", data: { file: "a.ts" } },
	{ schema_version: "1.0", ts: "2026-06-20T10:01:00Z", event: "test_run", run_id: "r1", data: {} },
	{
		schema_version: "1.0",
		ts: "2026-06-20T10:02:00Z",
		event: "friction",
		run_id: "r1",
		data: { message: "build failed", responsibility: "verification" },
	},
	{
		schema_version: "1.0",
		ts: "2026-06-20T10:03:00Z",
		event: "friction",
		run_id: "r2",
		data: { message: "build failed", responsibility: "verification" },
	},
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
			expect((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode.toLowerCase()).toBe(
				"wal",
			);
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
		expect(res.wiki.pages).toBe(0);
		expect(queryIndex(join(root, ".claude")).eventsByType).toEqual([]);
	});

	it("stamps the consolidated schema version (v3)", async () => {
		const { claudeDir } = await makeLogs();
		expect(buildIndex(claudeDir).schemaVersion).toBe(3);
		expect(SCHEMA_VERSION).toBe(3);
	});

	it("removes a stale legacy index.db on the first unified build", async () => {
		const { claudeDir } = await makeLogs();
		const legacy = join(claudeDir, "memory", "index.db");
		await writeFile(legacy, "stale");
		expect(existsSync(legacy)).toBe(true);
		buildIndex(claudeDir);
		expect(existsSync(legacy)).toBe(false);
		expect(existsSync(dbPath(claudeDir))).toBe(true); // new unified DB
	});
});

async function makeWiki(): Promise<{ claudeDir: string; root: string }> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-wiki-"));
	tempDirs.push(root);
	const claudeDir = join(root, ".claude");
	await mkdir(join(claudeDir, "memory"), { recursive: true });
	const pagesDir = join(root, "tasks", "wikis", "demo", "pages");
	await mkdir(pagesDir, { recursive: true });
	await writeFile(
		join(root, "tasks", "wikis", "demo", "wiki.json"),
		JSON.stringify({ slug: "demo", title: "Demo Wiki", createdAt: "260629", updatedAt: "260629" }),
	);
	await writeFile(
		join(pagesDir, "intro.md"),
		"---\nid: demo/intro\nslug: demo\ntitle: Salience Rubric\nstate: committed\norigin: human\nlinks:\n  - demo/usage\n---\nThe salience rubric scores candidates before any canonical write.\n",
	);
	await writeFile(
		join(pagesDir, "usage.md"),
		"---\nid: demo/usage\nslug: demo\ntitle: Usage\nstate: committed\norigin: human\n---\nRun mewkit wiki search to query the FTS index.\n",
	);
	await writeFile(
		join(root, "tasks", "wikis", "demo", "candidates.jsonl"),
		JSON.stringify({
			id: "c1",
			slug: "demo",
			origin: "agent",
			title: "T",
			content: "B",
			state: "proposed",
			salience: { total: 9, components: { explicit_user_intent: 3 } },
		}) + "\n",
	);
	return { claudeDir, root };
}

describe("wiki ingest + FTS", () => {
	it("ingests the canonical wiki tree into the index", async () => {
		const { claudeDir } = await makeWiki();
		const res = buildIndex(claudeDir);
		expect(res.wiki.wikis).toBe(1);
		expect(res.wiki.pages).toBe(2);
		expect(res.wiki.candidates).toBe(1);
		expect(res.wiki.links).toBe(1);
	});

	it("returns FTS matches with provenance + a token estimate", async () => {
		const { claudeDir } = await makeWiki();
		buildIndex(claudeDir);
		const hits = searchWiki(dbPath(claudeDir), "salience");
		expect(hits.length).toBe(1);
		expect(hits[0]!.slug).toBe("demo");
		expect(hits[0]!.pageId).toBe("demo/intro");
		expect(hits[0]!.tokenEstimate).toBeGreaterThan(0);
	});

	it("treats a SQL-ish match string as search text, not SQL", async () => {
		const { claudeDir } = await makeWiki();
		buildIndex(claudeDir);
		expect(searchWiki(dbPath(claudeDir), "nonexistentterm")).toEqual([]);
		expect(listWikiPages(dbPath(claudeDir), "demo").length).toBe(2);
	});

	it("is rebuild-able: wiki tables + FTS reindex identically", async () => {
		const { claudeDir } = await makeWiki();
		buildIndex(claudeDir);
		const before = searchWiki(dbPath(claudeDir), "rubric");
		rmSync(dbPath(claudeDir));
		buildIndex(claudeDir);
		const after = searchWiki(dbPath(claudeDir), "rubric");
		expect(after).toEqual(before);
	});

	it("re-ingest does not duplicate FTS rows (triggers stay in sync)", async () => {
		const { claudeDir } = await makeWiki();
		buildIndex(claudeDir);
		buildIndex(claudeDir); // second build over the same DB
		expect(searchWiki(dbPath(claudeDir), "salience").length).toBe(1);
		expect(listWikiPages(dbPath(claudeDir)).length).toBe(2);
	});

	it("does not crash on duplicate page ids; first file wins with no FTS duplication", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-wiki-dup-"));
		tempDirs.push(root);
		const claudeDir = join(root, ".claude");
		await mkdir(join(claudeDir, "memory"), { recursive: true });
		const pagesDir = join(root, "tasks", "wikis", "demo", "pages");
		await mkdir(pagesDir, { recursive: true });
		const frontmatter = (title: string, body: string) =>
			"---\nid: demo/dup\nslug: demo\ntitle: " + title + "\nstate: committed\norigin: human\n---\n" + body + "\n";
		await writeFile(join(pagesDir, "a.md"), frontmatter("First", "alpha salience text"));
		await writeFile(join(pagesDir, "b.md"), frontmatter("Second", "beta salience text"));
		const res = buildIndex(claudeDir); // must not throw on the duplicate id
		expect(res.wiki.pages).toBe(1);
		const hits = searchWiki(dbPath(claudeDir), "salience");
		expect(hits.length).toBe(1);
		expect(hits[0]!.pageId).toBe("demo/dup");
	});
});
