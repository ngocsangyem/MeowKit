import fs from "node:fs";
import { searchWiki, openReadOnlyImmutable } from "../infrastructure/wiki-query.js";
import type { WikiSearchHit } from "../application/ports.js";

// Shared, read-only wiki probe. It is the ONE place that discriminates the three
// failure modes the raw `searchWiki` collapses (`index-missing` vs `empty` vs
// `query-failed`) and sanitizes a free-text intent into a valid FTS query. Both the
// capability-recall composition and the `wiki context` CLI route through it so the
// discrimination logic never forks.

/** Free-text intent → a bare-token FTS query. Raw intent (colons, quotes, parens,
 * bare AND/OR/NOT) is parsed by FTS5 as query syntax and throws; a bare-token query
 * always matches literally. Mirrors the core resolver's `terms()` normalization. */
const STOPWORDS = new Set([
	"the",
	"a",
	"an",
	"to",
	"of",
	"in",
	"on",
	"this",
	"that",
	"for",
	"and",
	"or",
	"my",
	"me",
	"it",
]);

export function sanitizeIntentToFtsQuery(text: string): string {
	return text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length > 1 && !STOPWORDS.has(t))
		.join(" ");
}

/** Total wiki pages in the derived index. Read-only; a missing DB or missing wiki
 * schema (consolidated DB with only trace/cost tables) reads as 0 — never throws,
 * never creates the file (default open would). */
function countWikiPages(dbFile: string): number {
	if (!fs.existsSync(dbFile)) return 0;
	const db = openReadOnlyImmutable(dbFile);
	try {
		const present = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='wiki_page'").get();
		if (present === undefined) return 0;
		const row = db.prepare("SELECT COUNT(*) AS n FROM wiki_page").get() as { n: number } | undefined;
		return row?.n ?? 0;
	} catch {
		return 0;
	} finally {
		db.close();
	}
}

/** Injectable seams so the probe is deterministic in tests without a real SQLite DB. */
export interface WikiProbeDeps {
	indexExists?: (dbFile: string) => boolean;
	search?: (dbFile: string, query: string, limit: number, includeContent: boolean) => WikiSearchHit[];
	countPages?: (dbFile: string) => number;
	/** Optional canonical-tree page counter. When provided, the probe emits a one-line staleness
	 * warning if the canonical page count differs from the indexed page count. Omitted on the
	 * latency-sensitive recall path so `capabilities resolve` stays fast. */
	countCanonical?: () => number;
}

export type WikiProbeStatus = "ready" | "empty" | "index-missing" | "query-failed";

export interface WikiProbeResult {
	status: WikiProbeStatus;
	hits: WikiSearchHit[];
	/** The sanitized query actually executed (empty when no query ran). */
	query: string;
	/** Present only on `empty`: total wiki pages (0 = no pages vs >0 = no match). */
	wikiPageCount?: number;
	/** A one-line staleness warning when canonical vs indexed page counts diverge (cheap subset
	 * of `wiki verify`); present only when a canonical counter was injected. */
	staleness?: string;
}

export interface WikiProbeOptions {
	maxPages: number;
	includeContent: boolean;
	deps?: WikiProbeDeps;
}

/**
 * Probe the derived wiki index for a free-text intent, fail-open with discrimination:
 * - `index-missing` — no derived index DB on disk.
 * - `query-failed`  — the query itself errored (the injected/real search threw).
 * - `empty`         — index present, nothing matched (carries `wikiPageCount`).
 * - `ready`         — ≥1 match (bounded hits attached).
 * Never throws to the caller; never writes; never creates the DB file.
 */
export function probeWiki(dbFile: string, rawQuery: string, opts: WikiProbeOptions): WikiProbeResult {
	const deps = opts.deps ?? {};
	const indexExists = deps.indexExists ?? fs.existsSync;
	const search = deps.search ?? searchWiki;
	const countPages = deps.countPages ?? countWikiPages;

	const query = sanitizeIntentToFtsQuery(rawQuery);

	// Cheap staleness signal (canonical vs indexed page-count parity) — only when a canonical
	// counter is injected, so the latency-sensitive recall path is unaffected.
	const staleness = ((): string | undefined => {
		if (!deps.countCanonical) return undefined;
		const canonical = deps.countCanonical();
		const indexed = indexExists(dbFile) ? countPages(dbFile) : 0;
		return canonical !== indexed
			? `wiki index may be stale: ${canonical} canonical page(s) vs ${indexed} indexed — run 'mewkit wiki verify'`
			: undefined;
	})();

	if (!indexExists(dbFile)) return { status: "index-missing", hits: [], query, staleness };

	// No usable terms after sanitization: nothing to match, but the index IS present.
	if (query === "") return { status: "empty", hits: [], query, wikiPageCount: countPages(dbFile), staleness };

	let hits: WikiSearchHit[];
	try {
		hits = search(dbFile, query, opts.maxPages, opts.includeContent);
	} catch {
		return { status: "query-failed", hits: [], query, staleness };
	}

	if (hits.length === 0) return { status: "empty", hits: [], query, wikiPageCount: countPages(dbFile), staleness };
	return { status: "ready", hits, query, staleness };
}
