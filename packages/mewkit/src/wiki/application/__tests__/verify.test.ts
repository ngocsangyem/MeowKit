// wiki verify — classifies the canonical↔index consistency fixtures (consistent / stale body /
// orphaned claim / missing FTS row / empty-provenance) and stays read-only (no WAL sidecars).
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { buildIndex, dbPath } from "../../../core/derived-index.js";
import { verifyWiki } from "../verify.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

interface PageSpec {
	file: string;
	id: string;
	title: string;
	body: string;
}

/** Create a project with a canonical wiki (one slug), optional claims/sources JSONL, and BUILD
 * the index. Returns paths so tests can then mutate canonical files or the DB to induce drift. */
function makeWiki(pages: PageSpec[], opts: { claims?: object[]; sources?: object[] } = {}): {
	claudeDir: string;
	projectRoot: string;
	pagePath: (file: string) => string;
} {
	const root = mkdtempSync(join(tmpdir(), "mewkit-wikiverify-"));
	roots.push(root);
	const slugDir = join(root, "tasks", "wikis", "demo");
	const pagesDir = join(slugDir, "pages");
	mkdirSync(pagesDir, { recursive: true });
	writeFileSync(join(slugDir, "wiki.json"), JSON.stringify({ slug: "demo", title: "Demo" }));
	for (const p of pages) {
		writeFileSync(join(pagesDir, p.file), `---\nid: ${p.id}\ntitle: ${p.title}\n---\n${p.body}\n`);
	}
	if (opts.sources) writeFileSync(join(slugDir, "sources.jsonl"), opts.sources.map((s) => JSON.stringify(s)).join("\n") + "\n");
	if (opts.claims) writeFileSync(join(slugDir, "claims.jsonl"), opts.claims.map((c) => JSON.stringify(c)).join("\n") + "\n");
	const claudeDir = join(root, ".claude");
	mkdirSync(join(claudeDir, "memory"), { recursive: true });
	buildIndex(claudeDir);
	return { claudeDir, projectRoot: root, pagePath: (file) => join(pagesDir, file) };
}

const PAGE: PageSpec = { file: "one.md", id: "demo/one", title: "One", body: "The body of page one." };

describe("verifyWiki", () => {
	it("consistent fixture → fresh, every section ok", () => {
		const { claudeDir } = makeWiki([PAGE]);
		const r = verifyWiki(claudeDir);
		expect(r.fresh).toBe(true);
		expect(r.sections.pages.canonicalCount).toBe(1);
		expect(r.sections.pages.indexedCount).toBe(1);
		expect(r.sections.hashes.checked).toBe(1);
	});

	it("empty-provenance (pages, no claims/sources) → PASSES (absent ≠ inconsistent)", () => {
		const { claudeDir } = makeWiki([PAGE]);
		const r = verifyWiki(claudeDir);
		expect(r.sections.provenance.ok).toBe(true);
		expect(r.fresh).toBe(true);
	});

	it("stale body edit (canonical changed, index not rebuilt) → hash mismatch, stale", () => {
		const { claudeDir, pagePath } = makeWiki([PAGE]);
		// Edit the canonical page body WITHOUT reindexing → index content now diverges.
		writeFileSync(pagePath("one.md"), `---\nid: demo/one\ntitle: One\n---\nEDITED body, not reindexed.\n`);
		const r = verifyWiki(claudeDir);
		expect(r.sections.hashes.ok).toBe(false);
		expect(r.sections.hashes.mismatched).toContain("demo/one");
		expect(r.fresh).toBe(false);
	});

	it("orphaned claim (references a missing source) → provenance fails, stale", () => {
		const { claudeDir } = makeWiki([PAGE], {
			claims: [{ id: "c1", text: "claim", external: 1, sourceId: "missing-src", pageId: "demo/one" }],
		});
		const r = verifyWiki(claudeDir);
		expect(r.sections.provenance.ok).toBe(false);
		expect(r.sections.provenance.claimsMissingSource).toContain("c1");
		expect(r.fresh).toBe(false);
	});

	it("missing FTS row → fts parity fails, stale", () => {
		const { claudeDir } = makeWiki([PAGE]);
		// Delete the FTS row directly to simulate a strand (recursive_triggers=off DELETE gap).
		const db = new DatabaseSync(dbPath(claudeDir));
		try {
			db.exec("DELETE FROM wiki_fts");
		} finally {
			db.close();
		}
		const r = verifyWiki(claudeDir);
		expect(r.sections.fts.ok).toBe(false);
		expect(r.sections.fts.pageRows).toBe(1);
		expect(r.sections.fts.ftsRows).toBe(0);
		expect(r.fresh).toBe(false);
	});

	it("is read-only — leaves no WAL/SHM sidecars after verifying", () => {
		const { claudeDir } = makeWiki([PAGE]);
		const db = dbPath(claudeDir);
		// Clear any sidecars left by the build, then verify and assert none reappear.
		for (const suffix of ["-wal", "-shm"]) rmSync(db + suffix, { force: true });
		verifyWiki(claudeDir);
		expect(existsSync(db + "-wal")).toBe(false);
		expect(existsSync(db + "-shm")).toBe(false);
	});

	it("canonical pages present but no index built → stale (needs reindex)", () => {
		const root = mkdtempSync(join(tmpdir(), "mewkit-wikiverify-noidx-"));
		roots.push(root);
		const pagesDir = join(root, "tasks", "wikis", "demo", "pages");
		mkdirSync(pagesDir, { recursive: true });
		writeFileSync(join(pagesDir, "one.md"), `---\nid: demo/one\ntitle: One\n---\nbody\n`);
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		const r = verifyWiki(join(root, ".claude"));
		expect(r.sections.pages.ok).toBe(false);
		expect(r.fresh).toBe(false);
	});
});
