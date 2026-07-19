import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex, dbPath, ensureIndexSchema, queryIndex, SCHEMA_VERSION } from "../../../core/derived-index.js";
import { WIKI_MIGRATION_SQL } from "../wiki-schema.js";
import { searchWiki } from "../wiki-query.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function page(id: string, title: string, body: string): string {
	return (
		"---\nid: " +
		id +
		"\nslug: " +
		id.split("/")[0] +
		"\ntitle: " +
		title +
		"\nstate: committed\norigin: human\n---\n" +
		body +
		"\n"
	);
}

/** Full v3 fixture: a page, a candidate with two sourceIds, two sources, one handoff record. */
async function makeV3Wiki(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-v3-"));
	tempDirs.push(root);
	const claudeDir = join(root, ".claude");
	await mkdir(join(claudeDir, "memory"), { recursive: true });
	const dir = join(root, "tasks", "wikis", "demo");
	await mkdir(join(dir, "pages"), { recursive: true });
	await writeFile(join(dir, "wiki.json"), JSON.stringify({ slug: "demo", title: "Demo" }));
	await writeFile(
		join(dir, "pages", "intro.md"),
		page("demo/intro", "Salience Rubric", "The salience rubric scores candidates."),
	);
	await writeFile(
		join(dir, "candidates.jsonl"),
		JSON.stringify({
			id: "demo/c1",
			slug: "demo",
			origin: "agent",
			title: "T",
			content: "B",
			state: "proposed",
			sourceIds: ["s1", "s2"],
			salience: { total: 9, components: { explicit_user_intent: 3 } },
		}) + "\n",
	);
	await writeFile(
		join(dir, "sources.jsonl"),
		JSON.stringify({ id: "s1", kind: "internal", url: "tasks/reports/a.md" }) +
			"\n" +
			JSON.stringify({ id: "s2", kind: "internal", url: "tasks/reports/b.md" }) +
			"\n",
	);
	await writeFile(
		join(dir, "handoffs.jsonl"),
		JSON.stringify({
			id: "demo/ho1",
			slug: "demo",
			skillName: "mk:cook",
			handoffClass: "required",
			profile: "lifecycle-run",
			artifactPath: "tasks/reports/a.md",
			artifactHash: "f".repeat(64),
			title: "Run report",
			whySave: "non-obvious decision",
			evidence: "tasks/reviews/v.md",
			reuseScope: "lifecycle",
			verificationState: "verified",
			riskScore: 0,
			salience: {
				total: 9,
				components: { verified_outcome: 3, source_quality: 2, future_reuse_likelihood: 2, blast_radius: 2 },
			},
			decisionKind: "propose-candidate",
			candidateId: "demo/c1",
			status: "proposed",
			createdAt: "2026-06-29T00:00:00.000Z",
		}) + "\n",
	);
	return claudeDir;
}

/** Aspire-shaped fixture: pages + candidate with EMPTY sourceIds, no sources, no handoffs. */
async function makeAspireShapedWiki(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-aspire-"));
	tempDirs.push(root);
	const claudeDir = join(root, ".claude");
	await mkdir(join(claudeDir, "memory"), { recursive: true });
	const dir = join(root, "tasks", "wikis", "aspire-cf");
	await mkdir(join(dir, "pages"), { recursive: true });
	await writeFile(join(dir, "wiki.json"), JSON.stringify({ slug: "aspire-cf", title: "Aspire CF" }));
	await writeFile(
		join(dir, "pages", "backend-infra.md"),
		page("aspire-cf/backend", "Backend Infra", "The backend infra notes."),
	);
	await writeFile(
		join(dir, "candidates.jsonl"),
		JSON.stringify({
			id: "aspire-cf/c1",
			slug: "aspire-cf",
			origin: "human",
			title: "T",
			content: "B",
			state: "proposed",
			sourceIds: [],
			salience: { total: 10, components: {} },
		}) + "\n",
	);
	return claudeDir;
}

function tableNames(file: string, names: string[]): string[] {
	const db = new DatabaseSync(file, { readOnly: true });
	try {
		const rows = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (" + names.map(() => "?").join(",") + ")",
			)
			.all(...names) as { name: string }[];
		return rows.map((r) => r.name).sort();
	} finally {
		db.close();
	}
}

describe("migration v3 — fresh build", () => {
	it("creates wiki_handoff + wiki_candidate_source exactly once, no duplicate-DDL error", async () => {
		const claudeDir = await makeV3Wiki();
		const res = buildIndex(claudeDir);
		expect(res.schemaVersion).toBe(SCHEMA_VERSION);
		expect(tableNames(dbPath(claudeDir), ["wiki_handoff", "wiki_candidate_source"])).toEqual([
			"wiki_candidate_source",
			"wiki_handoff",
		]);
	});

	it("ingests handoffs.jsonl with salience flattened to total + json", async () => {
		const claudeDir = await makeV3Wiki();
		const res = buildIndex(claudeDir);
		expect(res.wiki.handoffs).toBe(1);
		const db = new DatabaseSync(dbPath(claudeDir), { readOnly: true });
		try {
			const row = db
				.prepare(
					"SELECT skill_name, salience_total, salience_json, candidate_id, status FROM wiki_handoff WHERE id = ?",
				)
				.get("demo/ho1") as {
				skill_name: string;
				salience_total: number;
				salience_json: string;
				candidate_id: string;
				status: string;
			};
			expect(row.skill_name).toBe("mk:cook");
			expect(row.salience_total).toBe(9);
			expect(row.candidate_id).toBe("demo/c1");
			expect(row.status).toBe("proposed");
			expect(JSON.parse(row.salience_json).components.verified_outcome).toBe(3);
		} finally {
			db.close();
		}
	});

	it("backfills wiki_candidate_source from candidate sourceIds", async () => {
		const claudeDir = await makeV3Wiki();
		const res = buildIndex(claudeDir);
		expect(res.wiki.candidateSources).toBe(2);
		const db = new DatabaseSync(dbPath(claudeDir), { readOnly: true });
		try {
			const n = (
				db.prepare("SELECT COUNT(*) AS n FROM wiki_candidate_source WHERE candidate_id = ?").get("demo/c1") as {
					n: number;
				}
			).n;
			expect(n).toBe(2);
		} finally {
			db.close();
		}
	});

	it("is deterministic: a second reindex yields identical handoff + relation counts", async () => {
		const claudeDir = await makeV3Wiki();
		const first = buildIndex(claudeDir);
		const second = buildIndex(claudeDir);
		expect(second.wiki.handoffs).toBe(first.wiki.handoffs);
		expect(second.wiki.candidateSources).toBe(first.wiki.candidateSources);
		expect(second.wiki.candidateSources).toBe(2);
	});
});

describe("migration v3 — Aspire-shaped v2 data", () => {
	it("ingests pages/candidates with empty sourceIds and no sources, yielding zero relation rows", async () => {
		const claudeDir = await makeAspireShapedWiki();
		const res = buildIndex(claudeDir);
		expect(res.wiki.pages).toBe(1);
		expect(res.wiki.candidates).toBe(1);
		expect(res.wiki.sources).toBe(0);
		expect(res.wiki.handoffs).toBe(0);
		expect(res.wiki.candidateSources).toBe(0);
		expect(searchWiki(dbPath(claudeDir), "backend").length).toBe(1);
	});

	it("upgrades an existing user_version=2 DB to 3 additively, preserving pages + search", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-upgrade-"));
		tempDirs.push(root);
		const claudeDir = join(root, ".claude");
		await mkdir(join(claudeDir, "memory"), { recursive: true });
		const file = dbPath(claudeDir);
		await mkdir(join(claudeDir, "memory"), { recursive: true });

		// Simulate a live v2 install: a real DB reaches v2 by applying v1 (trace/cost tables)
		// THEN v2 (wiki), so seed both before stamping v2 — otherwise a later additive migration
		// that alters a v1 table has nothing to alter.
		const seed = new DatabaseSync(file);
		seed.exec("PRAGMA journal_mode = WAL");
		seed.exec(`
			CREATE TABLE trace_events (
				id INTEGER PRIMARY KEY,
				ts TEXT, event TEXT, run_id TEXT, model TEXT, density TEXT,
				responsibility TEXT, data TEXT
			);
			CREATE INDEX idx_trace_event ON trace_events(event);
			CREATE INDEX idx_trace_run ON trace_events(run_id);
			CREATE TABLE cost_entries (
				id INTEGER PRIMARY KEY,
				date TEXT, command TEXT, tier TEXT, model TEXT,
				tokens INTEGER, task TEXT, raw TEXT
			);`);
		seed.exec(WIKI_MIGRATION_SQL);
		seed
			.prepare(
				"INSERT INTO wiki_page (id, slug, title, path, content, state, origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.run(
				"aspire-cf/backend",
				"aspire-cf",
				"Backend Infra",
				"pages/backend-infra.md",
				"The backend infra notes about salience.",
				"committed",
				"human",
				null,
				null,
			);
		seed
			.prepare("INSERT INTO wiki_candidate (id, slug, origin, title, content, state) VALUES (?, ?, ?, ?, ?, ?)")
			.run("aspire-cf/c1", "aspire-cf", "human", "T", "B", "proposed");
		seed.exec("PRAGMA user_version = 2");
		seed.close();

		// Open + run the migration runner: it must add v3 tables and bump to 3 WITHOUT
		// deleting the pre-existing rows (ensureIndexSchema is additive, not a re-ingest).
		const db = new DatabaseSync(file);
		ensureIndexSchema(db);
		try {
			expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(SCHEMA_VERSION);
			expect((db.prepare("SELECT COUNT(*) AS n FROM wiki_page").get() as { n: number }).n).toBe(1);
			expect((db.prepare("SELECT COUNT(*) AS n FROM wiki_candidate").get() as { n: number }).n).toBe(1);
			// v3 tables now exist and are empty.
			expect((db.prepare("SELECT COUNT(*) AS n FROM wiki_handoff").get() as { n: number }).n).toBe(0);
			expect((db.prepare("SELECT COUNT(*) AS n FROM wiki_candidate_source").get() as { n: number }).n).toBe(0);
		} finally {
			db.close();
		}
		// FTS search over the preserved page still resolves.
		expect(searchWiki(file, "salience").length).toBe(1);
	});
});

describe("migration v3 — query contract intact", () => {
	it("mewkit query still answers aggregates after the bump", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-v3-query-"));
		tempDirs.push(root);
		const claudeDir = join(root, ".claude");
		await mkdir(join(claudeDir, "memory"), { recursive: true });
		await writeFile(
			join(claudeDir, "memory", "trace-log.jsonl"),
			JSON.stringify({
				schema_version: "1.0",
				ts: "2026-06-29T10:00:00Z",
				event: "friction",
				run_id: "r1",
				data: { responsibility: "verification" },
			}) + "\n",
		);
		buildIndex(claudeDir);
		const q = queryIndex(claudeDir);
		expect(q.schemaVersion).toBe(SCHEMA_VERSION);
		expect(q.eventsByType.find((e) => e.event === "friction")!.n).toBe(1);
	});
});
