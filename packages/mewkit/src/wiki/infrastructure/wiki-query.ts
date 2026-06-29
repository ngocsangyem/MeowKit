import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { WikiSearchHit } from "../application/ports.js";

// Read-only wiki query helpers over the derived index. The DB is opened read-only
// and only parameterized SELECTs run — the FTS match string is bound, never
// interpolated, so a query like '" OR 1=1' is treated as search text, not SQL.

export type { WikiSearchHit };

export type WikiPageRow = {
	id: string;
	slug: string;
	title: string;
	path: string;
	state: string;
};

/** ~4 chars per token — a cheap budget hint, not an exact tokenizer. */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/** Full-text search over page title + body. Returns provenance (slug/path via the
 * page id) and a snippet with a token-budget estimate. */
export function searchWiki(dbFile: string, query: string, limit = 10): WikiSearchHit[] {
	if (!fs.existsSync(dbFile)) return [];
	const db = new DatabaseSync(dbFile, { readOnly: true });
	try {
		const rows = db
			.prepare(
				"SELECT f.page_id AS pageId, f.slug AS slug, f.title AS title, snippet(wiki_fts, 3, '[', ']', '…', 12) AS snippet, p.content AS content FROM wiki_fts f JOIN wiki_page p ON p.id = f.page_id WHERE wiki_fts MATCH ? ORDER BY rank LIMIT ?",
			)
			.all(query, limit) as { pageId: string; slug: string; title: string; snippet: string; content: string }[];
		return rows.map((r) => ({
			pageId: r.pageId,
			slug: r.slug,
			title: r.title,
			snippet: r.snippet,
			tokenEstimate: estimateTokens(r.content ?? ""),
		}));
	} finally {
		db.close();
	}
}

/** List committed/approved pages for a slug (or all slugs when omitted). */
export function listWikiPages(dbFile: string, slug?: string): WikiPageRow[] {
	if (!fs.existsSync(dbFile)) return [];
	const db = new DatabaseSync(dbFile, { readOnly: true });
	try {
		const sql =
			"SELECT id, slug, title, path, state FROM wiki_page" +
			(slug ? " WHERE slug = ?" : "") +
			" ORDER BY slug, title";
		const stmt = db.prepare(sql);
		const rows = (slug ? stmt.all(slug) : stmt.all()) as WikiPageRow[];
		return rows;
	} finally {
		db.close();
	}
}
