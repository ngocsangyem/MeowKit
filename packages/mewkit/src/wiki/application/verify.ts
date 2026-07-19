// `wiki verify` — a read-only consistency check between the canonical wiki tree
// (tasks/wikis/<slug>/) and the derived index (wiki-index.db), BEFORE any research automation is
// trusted. It reports four sections: page-set parity, per-page body-hash match, provenance
// integrity, and FTS row parity. It never writes and never mutates the index — it opens the DB
// immutable (zero WAL sidecars) and recomputes both body hashes with the same algorithm, because
// wiki_page carries no persisted content hash. Empty provenance (0/0/0) is CONSISTENT, not stale:
// the gate blocks inconsistent state, never absent state.
import { existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { openReadOnlyImmutable } from "../infrastructure/wiki-query.js";
import { readCanonicalPages } from "../infrastructure/wiki-ingest.js";

const sha256 = (text: string): string => createHash("sha256").update(text, "utf-8").digest("hex");

export interface WikiVerifyReport {
	fresh: boolean;
	sections: {
		pages: { canonicalCount: number; indexedCount: number; ok: boolean; mismatches: string[] };
		hashes: { checked: number; mismatched: string[]; ok: boolean };
		provenance: { orphanedClaims: string[]; claimsMissingSource: string[]; ok: boolean };
		fts: { pageRows: number; ftsRows: number; ok: boolean };
	};
	remediation: "wiki reindex";
}

function dbFileFor(claudeDir: string): string {
	return path.join(claudeDir, "memory", "wiki-index.db");
}

function schemaPresent(db: DatabaseSync): boolean {
	return db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='wiki_page'").get() !== undefined;
}

/** Symmetric difference of two id sets, as a sorted, readable list of `only-in-X:id` markers. */
function setDiff(canonical: Set<string>, indexed: Set<string>): string[] {
	const diff: string[] = [];
	for (const id of canonical) if (!indexed.has(id)) diff.push(`canonical-only:${id}`);
	for (const id of indexed) if (!canonical.has(id)) diff.push(`index-only:${id}`);
	return diff.sort();
}

/**
 * Verify canonical ↔ index consistency. Read-only. A missing index is treated as zero indexed
 * rows: consistent only when there are also zero canonical pages (otherwise the index is stale
 * and needs a rebuild). Callers use `fresh` for the advisory exit code (0 fresh / 1 stale).
 */
export function verifyWiki(claudeDir: string): WikiVerifyReport {
	const projectRoot = path.dirname(claudeDir);
	const canonical = readCanonicalPages(projectRoot);
	const canonicalById = new Map(canonical.map((p) => [p.id, p]));

	let indexedPages: { id: string; content: string }[] = [];
	let ftsRows = 0;
	const sourceIds = new Set<string>();
	let claims: { id: string; source_id: string | null; page_id: string | null }[] = [];

	const dbFile = dbFileFor(claudeDir);
	if (existsSync(dbFile)) {
		const db = openReadOnlyImmutable(dbFile);
		try {
			if (schemaPresent(db)) {
				indexedPages = db.prepare("SELECT id, content FROM wiki_page").all() as typeof indexedPages;
				ftsRows = (db.prepare("SELECT COUNT(*) AS n FROM wiki_fts").get() as { n: number }).n;
				for (const r of db.prepare("SELECT id FROM wiki_source").all() as { id: string }[]) sourceIds.add(r.id);
				claims = db.prepare("SELECT id, source_id, page_id FROM wiki_claim").all() as typeof claims;
			}
		} finally {
			db.close();
		}
	}

	const indexedById = new Map(indexedPages.map((p) => [p.id, p.content]));
	const canonicalIds = new Set(canonicalById.keys());
	const indexedIds = new Set(indexedById.keys());

	// (a) page-set parity
	const pageMismatches = setDiff(canonicalIds, indexedIds);
	const pages = {
		canonicalCount: canonical.length,
		indexedCount: indexedPages.length,
		ok: pageMismatches.length === 0,
		mismatches: pageMismatches,
	};

	// (b) per-page body-hash match (only for ids present on BOTH sides)
	const hashMismatched: string[] = [];
	let checked = 0;
	for (const [id, page] of canonicalById) {
		const indexedContent = indexedById.get(id);
		if (indexedContent === undefined) continue;
		checked += 1;
		if (sha256(page.body) !== sha256(indexedContent)) hashMismatched.push(id);
	}
	const hashes = { checked, mismatched: hashMismatched.sort(), ok: hashMismatched.length === 0 };

	// (c) provenance integrity — claims referencing a missing source or a missing page
	const claimsMissingSource: string[] = [];
	const orphanedClaims: string[] = [];
	for (const c of claims) {
		if (c.source_id && !sourceIds.has(c.source_id)) claimsMissingSource.push(c.id);
		if (c.page_id && !indexedIds.has(c.page_id)) orphanedClaims.push(c.id);
	}
	const provenance = {
		orphanedClaims: orphanedClaims.sort(),
		claimsMissingSource: claimsMissingSource.sort(),
		ok: orphanedClaims.length === 0 && claimsMissingSource.length === 0,
	};

	// (d) FTS row parity
	const fts = { pageRows: indexedPages.length, ftsRows, ok: indexedPages.length === ftsRows };

	return {
		fresh: pages.ok && hashes.ok && provenance.ok && fts.ok,
		sections: { pages, hashes, provenance, fts },
		remediation: "wiki reindex",
	};
}

/** The failing section names, for a remediation-naming error message (empty when fresh). */
export function failingSections(report: WikiVerifyReport): string[] {
	const s = report.sections;
	return [
		s.pages.ok ? null : "pages",
		s.hashes.ok ? null : "hashes",
		s.provenance.ok ? null : "provenance",
		s.fts.ok ? null : "fts",
	].filter((x): x is string => x !== null);
}
