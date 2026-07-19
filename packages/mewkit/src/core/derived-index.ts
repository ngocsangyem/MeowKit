import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseTraceLog } from "./trace-analysis.js";
import { WIKI_MIGRATION_SQL, WIKI_V3_MIGRATION_SQL } from "../wiki/infrastructure/wiki-schema.js";
import { ingestWiki, type WikiIngestCounts } from "../wiki/infrastructure/wiki-ingest.js";

// The consolidated DERIVED, disposable SQLite index. Canonical data stays in the append
// logs (.claude/memory/*) and the wiki tree (tasks/wikis/<slug>/); this DB is a rebuild-able
// read index (delete → reindex → identical). Opt-in: nothing builds it automatically and no
// hook writes to it. All inserts are parameterized (prepared statements); queries are static
// aggregates with no user-supplied SQL — no injection surface. v2 folds in the wiki tables +
// FTS5 (was a separate index.db, now unified as wiki-index.db per the consolidation decision).

export const SCHEMA_VERSION = 4;
const DB_REL = path.join("memory", "wiki-index.db");
/** The pre-consolidation DB, removed once on the first unified build. */
const LEGACY_DB_REL = path.join("memory", "index.db");

/** Forward migrations, applied in order when the DB's PRAGMA user_version is behind. */
const MIGRATIONS: { version: number; sql: string }[] = [
	{
		version: 1,
		sql: `
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
		);`,
	},
	{ version: 2, sql: WIKI_MIGRATION_SQL },
	{ version: 3, sql: WIKI_V3_MIGRATION_SQL },
	{
		version: 4,
		sql: `
		ALTER TABLE trace_events ADD COLUMN task_id TEXT;
		ALTER TABLE trace_events ADD COLUMN plan_path TEXT;
		CREATE INDEX idx_trace_task ON trace_events(task_id);`,
	},
];

export function dbPath(claudeDir: string): string {
	return path.join(claudeDir, DB_REL);
}

function userVersion(db: DatabaseSync): number {
	const row = db.prepare("PRAGMA user_version").get();
	const v = row?.["user_version"];
	return typeof v === "number" ? v : 0;
}

/** Apply any pending forward migrations and stamp the schema version. Exported so the live
 * write adapter (`SqliteWikiIndex.upsertPage`) can self-heal a never-built index DB: the
 * wiki schema is otherwise created only by `buildIndex` (`mewkit index` / `wiki reindex`),
 * so a first `approve` on a fresh wiki would hit `no such table: wiki_page`. Idempotent —
 * a no-op once `user_version` is current. */
export function ensureIndexSchema(db: DatabaseSync): void {
	let current = userVersion(db);
	for (const m of MIGRATIONS) {
		if (m.version > current) {
			db.exec(m.sql);
			db.exec(`PRAGMA user_version = ${m.version}`); // integer constant — not user input
			current = m.version;
		}
	}
}

function asString(v: unknown): string | null {
	if (v === null || v === undefined) return null;
	return typeof v === "string" ? v : JSON.stringify(v);
}

function asNumber(v: unknown): number | null {
	return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Ingest the trace log (full replace — deterministic rebuild). */
function ingestTrace(db: DatabaseSync, claudeDir: string): number {
	const logPath = path.join(claudeDir, "memory", "trace-log.jsonl");
	if (!fs.existsSync(logPath)) return 0;
	const records = parseTraceLog(fs.readFileSync(logPath, "utf-8"));
	const stmt = db.prepare(
		"INSERT INTO trace_events (ts, event, run_id, model, density, responsibility, task_id, plan_path, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	for (const r of records) {
		const data = r.data ?? {};
		const resp = typeof data["responsibility"] === "string" ? (data["responsibility"] as string) : null;
		// Task identity is top-level on fresh logs; fall back to data for any record that carried
		// it inside the payload. Legacy logs have neither → null (never matched by --task).
		const taskId = r.task_id ?? (typeof data["task_id"] === "string" ? (data["task_id"] as string) : null);
		const planPath = r.plan_path ?? (typeof data["plan_path"] === "string" ? (data["plan_path"] as string) : null);
		stmt.run(
			asString(r.ts),
			asString(r.event),
			asString(r.run_id),
			asString(r.model),
			asString(r.density),
			resp,
			taskId,
			planPath,
			asString(data),
		);
	}
	return records.length;
}

/** Ingest the cost log defensively (the CostEntry union varies; keep common columns + raw JSON). */
function ingestCost(db: DatabaseSync, claudeDir: string): number {
	const logPath = path.join(claudeDir, "memory", "cost-log.json");
	if (!fs.existsSync(logPath)) return 0;
	let arr: unknown;
	try {
		arr = JSON.parse(fs.readFileSync(logPath, "utf-8"));
	} catch {
		return 0;
	}
	if (!Array.isArray(arr)) return 0;
	const stmt = db.prepare(
		"INSERT INTO cost_entries (date, command, tier, model, tokens, task, raw) VALUES (?, ?, ?, ?, ?, ?, ?)",
	);
	for (const e of arr) {
		const o = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
		stmt.run(
			asString(o["date"] ?? o["ts"]),
			asString(o["command"]),
			asString(o["tier"]),
			asString(o["model"]),
			asNumber(o["tokens"]),
			asString(o["task"]),
			asString(o),
		);
	}
	return arr.length;
}

export interface IndexResult {
	dbPath: string;
	schemaVersion: number;
	traceRows: number;
	costRows: number;
	wiki: WikiIngestCounts;
}

/** Remove the pre-consolidation index.db (and its WAL/SHM sidecars) once. The new
 *  unified wiki-index.db supersedes it; the logs remain canonical so nothing is lost. */
function removeLegacyDb(claudeDir: string): void {
	const legacy = path.join(claudeDir, LEGACY_DB_REL);
	let removed = false;
	for (const suffix of ["", "-wal", "-shm"]) {
		const f = legacy + suffix;
		if (fs.existsSync(f)) {
			fs.rmSync(f);
			removed = true;
		}
	}
	if (removed) {
		console.error(`[mewkit] removed legacy ${LEGACY_DB_REL} — superseded by ${DB_REL}`);
	}
}

/** Build/refresh the derived index from the canonical logs + wiki tree. Full re-ingest =
 *  deterministic and rebuild-able. Creates the DB (WAL) if absent. Never mutates the sources. */
export function buildIndex(claudeDir: string): IndexResult {
	removeLegacyDb(claudeDir);
	const target = dbPath(claudeDir);
	const projectRoot = path.dirname(claudeDir);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	const db = new DatabaseSync(target);
	try {
		db.exec("PRAGMA journal_mode = WAL");
		ensureIndexSchema(db);
		db.exec("DELETE FROM trace_events");
		db.exec("DELETE FROM cost_entries");
		const traceRows = ingestTrace(db, claudeDir);
		const costRows = ingestCost(db, claudeDir);
		const wiki = ingestWiki(db, projectRoot);
		return { dbPath: target, schemaVersion: userVersion(db), traceRows, costRows, wiki };
	} finally {
		db.close();
	}
}

export interface QueryResult {
	schemaVersion: number;
	eventsByType: { event: string; n: number }[];
	runsByTier: { run_id: string; events: number }[];
	frictionByResponsibility: { responsibility: string; n: number }[];
	costByModel: { model: string; entries: number; tokens: number }[];
}

/** Read-only aggregate/join queries. Opens the DB read-only; only static SELECTs run. */
export function queryIndex(claudeDir: string): QueryResult {
	const target = dbPath(claudeDir);
	if (!fs.existsSync(target)) throw new Error("no index — run `mewkit index` first");
	const db = new DatabaseSync(target, { readOnly: true });
	try {
		const eventsByType = db
			.prepare("SELECT event, COUNT(*) AS n FROM trace_events GROUP BY event ORDER BY n DESC, event")
			.all() as { event: string; n: number }[];
		const runsByTier = db
			.prepare(
				"SELECT run_id, COUNT(*) AS events FROM trace_events WHERE run_id <> '' GROUP BY run_id ORDER BY events DESC, run_id",
			)
			.all() as { run_id: string; events: number }[];
		const frictionByResponsibility = db
			.prepare(
				"SELECT responsibility, COUNT(*) AS n FROM trace_events WHERE event = 'friction' AND responsibility IS NOT NULL GROUP BY responsibility ORDER BY n DESC, responsibility",
			)
			.all() as { responsibility: string; n: number }[];
		const costByModel = db
			.prepare(
				"SELECT COALESCE(model,'') AS model, COUNT(*) AS entries, COALESCE(SUM(tokens),0) AS tokens FROM cost_entries GROUP BY model ORDER BY tokens DESC, model",
			)
			.all() as { model: string; entries: number; tokens: number }[];
		return { schemaVersion: userVersion(db), eventsByType, runsByTier, frictionByResponsibility, costByModel };
	} finally {
		db.close();
	}
}

export interface PresetResult {
	schemaVersion: number;
	/** Recovery-outcome distribution over orient runs. */
	recoveryOutcomes: { outcome: string; n: number }[];
	/** How often an orient run carried at least one stale-revision warning. */
	staleWarnings: { totalRuns: number; runsWithStale: number };
	/** Task transitions that carried no canonical task context (an activation-path gap signal). */
	transitionsMissingTask: { total: number; missing: number };
	/** Verification-bearing transitions per task (a count > 1 indicates re-runs). */
	verificationRuns: { taskId: string; runs: number }[];
}

/**
 * The Phase-7 measurement presets over the append log's advisory events (`orient_run`,
 * `task_transition`). Read-only, static aggregates (json_extract on canonical event data — no
 * user-supplied SQL). Answers: recovery-outcome distribution, stale-warning frequency, transitions
 * missing task context, and verification re-run counts.
 */
export function queryPresets(claudeDir: string): PresetResult {
	const target = dbPath(claudeDir);
	if (!fs.existsSync(target)) throw new Error("no index — run `mewkit index` first");
	const db = new DatabaseSync(target, { readOnly: true });
	try {
		const recoveryOutcomes = db
			.prepare(
				"SELECT COALESCE(json_extract(data,'$.outcome'),'(unknown)') AS outcome, COUNT(*) AS n FROM trace_events WHERE event='orient_run' GROUP BY outcome ORDER BY n DESC, outcome",
			)
			.all() as { outcome: string; n: number }[];
		const stale = db
			.prepare(
				"SELECT COUNT(*) AS totalRuns, COALESCE(SUM(CASE WHEN CAST(json_extract(data,'$.staleWarnings') AS INTEGER) > 0 THEN 1 ELSE 0 END),0) AS runsWithStale FROM trace_events WHERE event='orient_run'",
			)
			.get() as { totalRuns: number; runsWithStale: number };
		const missing = db
			.prepare(
				"SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN task_id IS NULL OR task_id='' THEN 1 ELSE 0 END),0) AS missing FROM trace_events WHERE event='task_transition'",
			)
			.get() as { total: number; missing: number };
		const verificationRuns = db
			.prepare(
				"SELECT task_id AS taskId, COUNT(*) AS runs FROM trace_events WHERE event='task_transition' AND json_extract(data,'$.verifications') IS NOT NULL AND task_id IS NOT NULL AND task_id <> '' GROUP BY task_id ORDER BY runs DESC, task_id",
			)
			.all() as { taskId: string; runs: number }[];
		return {
			schemaVersion: userVersion(db),
			recoveryOutcomes,
			staleWarnings: stale,
			transitionsMissingTask: missing,
			verificationRuns,
		};
	} finally {
		db.close();
	}
}

export interface TaskQueryResult {
	schemaVersion: number;
	taskId: string;
	events: { ts: string | null; event: string | null; run_id: string | null; plan_path: string | null }[];
	/** Distinct plan paths this task's events linked to (its plan linkage). */
	plans: string[];
}

/**
 * Task-joined query: every trace event whose canonical `task_id` matches, ordered oldest-first,
 * plus the distinct plan paths those events reference. Parameterized (no SQL injection surface).
 * Returns an empty event list for an unknown task id — never throws for a missing task.
 */
export function queryByTask(claudeDir: string, taskId: string): TaskQueryResult {
	const target = dbPath(claudeDir);
	if (!fs.existsSync(target)) throw new Error("no index — run `mewkit index` first");
	const db = new DatabaseSync(target, { readOnly: true });
	try {
		const events = db
			.prepare("SELECT ts, event, run_id, plan_path FROM trace_events WHERE task_id = ? ORDER BY ts, id")
			.all(taskId) as TaskQueryResult["events"];
		const plans = db
			.prepare(
				"SELECT DISTINCT plan_path FROM trace_events WHERE task_id = ? AND plan_path IS NOT NULL ORDER BY plan_path",
			)
			.all(taskId)
			.map((r) => (r as { plan_path: string }).plan_path);
		return { schemaVersion: userVersion(db), taskId, events, plans };
	} finally {
		db.close();
	}
}
