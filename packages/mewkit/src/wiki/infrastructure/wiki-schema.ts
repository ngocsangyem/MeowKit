// Wiki DDL for the consolidated derived index (report section 5). Applied as the
// derived-index migration v2. Columns mirror the domain types. Every
// statement here is a compile-time constant with no interpolation. wiki_fts is a
// standalone FTS5 table kept in sync with wiki_page by triggers; the full-rebuild
// ingest stays the source of truth.

// Tables cleared (FK-safe order) before a full wiki re-ingest. These names are
// hard-coded constants, never user input, so they are safe to use in a clear loop.
export const WIKI_TABLES: readonly string[] = [
	"wiki_fts",
	"wiki_link",
	"wiki_salience",
	"wiki_candidate",
	"wiki_seed",
	"wiki_claim",
	"wiki_source",
	"wiki_page_version",
	"wiki_page",
	"wiki_write_event",
	"wiki_intervention",
	"wiki",
];

// One DDL statement per element, joined into a single migration script. Plain
// string literals (no template strings) keep this provably interpolation-free.
const WIKI_DDL_STATEMENTS: readonly string[] = [
	"CREATE TABLE wiki (slug TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT, updated_at TEXT);",
	"CREATE TABLE wiki_page (id TEXT PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL, path TEXT NOT NULL, content TEXT NOT NULL, state TEXT NOT NULL, origin TEXT NOT NULL, created_at TEXT, updated_at TEXT);",
	"CREATE INDEX idx_wiki_page_slug ON wiki_page(slug);",
	"CREATE TABLE wiki_page_version (id INTEGER PRIMARY KEY, page_id TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT);",
	"CREATE TABLE wiki_source (id TEXT PRIMARY KEY, kind TEXT NOT NULL, url TEXT NOT NULL, title TEXT, fetched_at TEXT, content_hash TEXT);",
	"CREATE TABLE wiki_claim (id TEXT PRIMARY KEY, text TEXT NOT NULL, external INTEGER NOT NULL, source_id TEXT, page_id TEXT);",
	"CREATE TABLE wiki_seed (id TEXT PRIMARY KEY, query TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT);",
	"CREATE TABLE wiki_candidate (id TEXT PRIMARY KEY, slug TEXT NOT NULL, origin TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, why_save TEXT, evidence TEXT, novelty_delta REAL, reuse_scope TEXT, verification_state TEXT, risk_score REAL, salience_total REAL, state TEXT NOT NULL, created_at TEXT, review_after TEXT);",
	"CREATE TABLE wiki_salience (candidate_id TEXT PRIMARY KEY, explicit_user_intent REAL, verified_outcome REAL, recurrence_or_friction REAL, novelty_vs_existing_wiki REAL, future_reuse_likelihood REAL, source_quality REAL, blast_radius REAL, security_risk_penalty REAL, staleness_penalty REAL, total REAL);",
	"CREATE TABLE wiki_write_event (id INTEGER PRIMARY KEY, ts TEXT, decision_kind TEXT NOT NULL, candidate_id TEXT, page_id TEXT, reason TEXT);",
	"CREATE TABLE wiki_intervention (id TEXT PRIMARY KEY, kind TEXT NOT NULL, candidate_id TEXT, reason TEXT, actor TEXT, created_at TEXT);",
	"CREATE TABLE wiki_link (from_page_id TEXT NOT NULL, to_page_id TEXT NOT NULL, PRIMARY KEY (from_page_id, to_page_id));",
	"CREATE VIRTUAL TABLE wiki_fts USING fts5(page_id UNINDEXED, slug UNINDEXED, title, body);",
	"CREATE TRIGGER wiki_page_ai AFTER INSERT ON wiki_page BEGIN INSERT INTO wiki_fts(page_id, slug, title, body) VALUES (new.id, new.slug, new.title, new.content); END;",
	"CREATE TRIGGER wiki_page_ad AFTER DELETE ON wiki_page BEGIN DELETE FROM wiki_fts WHERE page_id = old.id; END;",
	"CREATE TRIGGER wiki_page_au AFTER UPDATE ON wiki_page BEGIN DELETE FROM wiki_fts WHERE page_id = old.id; INSERT INTO wiki_fts(page_id, slug, title, body) VALUES (new.id, new.slug, new.title, new.content); END;",
];

export const WIKI_MIGRATION_SQL: string = WIKI_DDL_STATEMENTS.join("\n");
