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

/** The derived index file can exist but be empty — created by a raw open before its first
 * build (e.g. an older mewkit that opened the DB on a failed first `approve`). A read-only
 * connection cannot migrate, so treat a missing wiki schema as "no results" rather than
 * letting the query throw `no such table: wiki_page`. */
function wikiSchemaPresent(db: DatabaseSync): boolean {
	const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'wiki_page'").get();
	return row !== undefined;
}

/** Compose the project-root-readable page path from a slug + the DB slug-relative path.
 * The DB stores `wiki_page.path` slug-relative ("pages/x.md"); agents need a path readable
 * from the project root. Always POSIX-joined (repo-relative), never an absolute path. */
function readablePagePath(slug: string, pagePath: string): string {
	return "tasks/wikis/" + slug + "/" + pagePath;
}

/** Full-text search over page title + body. Returns provenance (slug + slug-relative
 * `pagePath` + a project-root-readable `path`) and a snippet with a token-budget estimate.
 * Page bodies are returned ONLY when `includeContent` is true (context-budget discipline). */
export function searchWiki(dbFile: string, query: string, limit = 10, includeContent = false): WikiSearchHit[] {
	if (!fs.existsSync(dbFile)) return [];
	const db = new DatabaseSync(dbFile, { readOnly: true });
	try {
		if (!wikiSchemaPresent(db)) return [];
		const rows = db
			.prepare(
				"SELECT f.page_id AS pageId, f.slug AS slug, f.title AS title, snippet(wiki_fts, 3, '[', ']', '…', 12) AS snippet, p.path AS pagePath, p.content AS content FROM wiki_fts f JOIN wiki_page p ON p.id = f.page_id WHERE wiki_fts MATCH ? ORDER BY rank LIMIT ?",
			)
			.all(query, limit) as {
			pageId: string;
			slug: string;
			title: string;
			snippet: string;
			pagePath: string;
			content: string;
		}[];
		return rows.map((r) => {
			const pagePath = r.pagePath ?? "";
			const hit: WikiSearchHit = {
				pageId: r.pageId,
				slug: r.slug,
				title: r.title,
				snippet: r.snippet,
				tokenEstimate: estimateTokens(r.content ?? ""),
				pagePath,
				path: readablePagePath(r.slug, pagePath),
			};
			if (includeContent) hit.content = r.content ?? "";
			return hit;
		});
	} finally {
		db.close();
	}
}

/** List committed/approved pages for a slug (or all slugs when omitted). */
export function listWikiPages(dbFile: string, slug?: string): WikiPageRow[] {
	if (!fs.existsSync(dbFile)) return [];
	const db = new DatabaseSync(dbFile, { readOnly: true });
	try {
		if (!wikiSchemaPresent(db)) return [];
		const sql =
			"SELECT id, slug, title, path, state FROM wiki_page" + (slug ? " WHERE slug = ?" : "") + " ORDER BY slug, title";
		const stmt = db.prepare(sql);
		const rows = (slug ? stmt.all(slug) : stmt.all()) as WikiPageRow[];
		return rows;
	} finally {
		db.close();
	}
}
