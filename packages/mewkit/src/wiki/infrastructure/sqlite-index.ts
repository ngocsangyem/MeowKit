import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { WikiPage } from "../domain/index.js";
import type { WikiIndex, WikiSearchHit } from "../application/ports.js";
import { searchWiki } from "./wiki-query.js";
import { ensureIndexSchema } from "../../core/derived-index.js";

// Live read/upsert adapter over the consolidated wiki-index.db. Reads go
// through the read-only searchWiki helper; the single live mutation is page upsert. Upsert is
// an explicit DELETE then INSERT (not INSERT OR REPLACE): the explicit DELETE always fires the
// wiki_page AFTER DELETE trigger, keeping wiki_fts in sync — REPLACE's implicit delete would
// not fire it under the default recursive_triggers=off and would strand a duplicate FTS row.

export class SqliteWikiIndex implements WikiIndex {
	constructor(private readonly dbFile: string) {}

	upsertPage(page: WikiPage): void {
		// The index lives in the `.meowkit/` cache class, which need not exist yet on a fresh
		// project. DatabaseSync creates the file but never the directory, so ensure it here —
		// otherwise the first `approve` fails with "unable to open database file".
		mkdirSync(dirname(this.dbFile), { recursive: true });
		const db = new DatabaseSync(this.dbFile);
		try {
			db.exec("PRAGMA journal_mode = WAL");
			// The derived index is opt-in: nothing builds it before the first canonical write.
			// Opening it here with a raw DatabaseSync also CREATES an empty file, so without this
			// the very first `approve` on a fresh wiki throws `no such table: wiki_page`. Migrate
			// (idempotent) so upsert self-heals a never-built index instead of requiring a prior
			// `mewkit index` / `wiki reindex`.
			ensureIndexSchema(db);
			db.exec("BEGIN IMMEDIATE");
			try {
				db.prepare("DELETE FROM wiki_page WHERE id = ?").run(page.id);
				db.prepare(
					"INSERT INTO wiki_page (id, slug, title, path, content, state, origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
				).run(
					page.id,
					page.slug,
					page.title,
					page.path,
					page.content,
					page.state,
					page.provenance.origin,
					page.createdAt,
					page.updatedAt,
				);
				db.exec("COMMIT");
			} catch (err) {
				db.exec("ROLLBACK");
				throw err;
			}
		} finally {
			db.close();
		}
	}

	searchFts(query: string, limit = 10): WikiSearchHit[] {
		return searchWiki(this.dbFile, query, limit);
	}
}
