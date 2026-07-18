import { describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync, readdirSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { attachRecall, recallDecisionEvent } from "../compose.js";
import { probeWiki } from "../probe-wiki.js";
import type { HostResolveResult } from "../../../core/resolve-capabilities.js";
import type { RecallDeps } from "../recall-for-capability.js";
import type { WikiSearchHit } from "../../application/ports.js";

function result(status: HostResolveResult["status"], topId?: string): HostResolveResult {
	return {
		intent: "i",
		provider: "claude-code",
		ambiguous: status === "ambiguous",
		status,
		candidates: (topId ? [{ id: topId }] : []) as HostResolveResult["candidates"],
		acquisition: {} as HostResolveResult["acquisition"],
		adapterCitation: {} as HostResolveResult["adapterCitation"],
	};
}

const hit = (): WikiSearchHit => ({
	pageId: "p",
	slug: "s",
	title: "T",
	snippet: "…",
	tokenEstimate: 10,
	path: "tasks/wikis/s/pages/x.md",
});

describe("attachRecall — selection-behavior gate", () => {
	const dbFile = "/tmp/nope/wiki-index.db";

	it("selected+required → exactly one query, recall attached (ready)", () => {
		const search = vi.fn(() => [hit()]);
		const deps: RecallDeps = { dbFile, indexExists: () => true, search };
		const r = attachRecall(result("selected", "mk:cook"), "cook it", deps);
		expect(r.knowledgeRecall?.status).toBe("ready");
		expect(search).toHaveBeenCalledTimes(1);
	});

	it("selected+conditional → conditional, zero queries", () => {
		const search = vi.fn(() => []);
		const r = attachRecall(result("selected", "mk:docs-finder"), "spec", { dbFile, indexExists: () => true, search });
		expect(r.knowledgeRecall?.status).toBe("conditional");
		expect(search).not.toHaveBeenCalled();
	});

	it("selected+none → not-required, zero index access", () => {
		const search = vi.fn(() => []);
		const indexExists = vi.fn(() => true);
		const r = attachRecall(result("selected", "wiki-recall"), "recall", { dbFile, indexExists, search });
		expect(r.knowledgeRecall?.status).toBe("not-required");
		expect(indexExists).not.toHaveBeenCalled();
	});

	it.each(["ambiguous", "unavailable", "unsupported"] as const)("%s → no recall at all", (status) => {
		const search = vi.fn(() => []);
		const indexExists = vi.fn(() => true);
		const r = attachRecall(result(status, "mk:cook"), "x", { dbFile, indexExists, search });
		expect(r.knowledgeRecall).toBeUndefined();
		expect(search).not.toHaveBeenCalled();
		expect(indexExists).not.toHaveBeenCalled();
	});

	it("selected but zero candidates → passes through unchanged", () => {
		const r = attachRecall(result("selected"), "x", { dbFile, indexExists: () => true, search: () => [] });
		expect(r.knowledgeRecall).toBeUndefined();
	});
});

describe("probeWiki — default-run purity", () => {
	const dirs: string[] = [];
	afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

	it("a missing index DB is reported index-missing and is NOT created (read-only, no writable open)", () => {
		const root = mkdtempSync(join(tmpdir(), "recall-purity-"));
		dirs.push(root);
		const dbFile = join(root, "wiki-index.db");
		const r = probeWiki(dbFile, "anything relevant", { maxPages: 3, includeContent: false });
		expect(r.status).toBe("index-missing");
		expect(existsSync(dbFile)).toBe(false);
	});

	it("a probe over an EXISTING WAL-mode index writes nothing — no -wal/-shm sidecars, DB unmutated", () => {
		const root = mkdtempSync(join(tmpdir(), "recall-wal-purity-"));
		dirs.push(root);
		const dbFile = join(root, "wiki-index.db");
		// Build a WAL-mode DB with the wiki schema, then checkpoint sidecars away.
		const w = new DatabaseSync(dbFile);
		w.exec("PRAGMA journal_mode=WAL");
		w.exec("CREATE TABLE wiki_page(id TEXT, slug TEXT, title TEXT, path TEXT, content TEXT, state TEXT)");
		w.exec("CREATE VIRTUAL TABLE wiki_fts USING fts5(page_id, slug, title, body)");
		w.close();
		const chk = new DatabaseSync(dbFile);
		chk.exec("PRAGMA wal_checkpoint(TRUNCATE)");
		chk.close();
		for (const f of readdirSync(root)) if (f.endsWith("-wal") || f.endsWith("-shm")) rmSync(join(root, f));

		const before = statSync(dbFile).mtimeMs;
		const listBefore = readdirSync(root).sort();
		const r = probeWiki(dbFile, "some query terms", { maxPages: 3, includeContent: false });
		expect(r.status).toBe("empty"); // present, no match
		expect(r.wikiPageCount).toBe(0);
		expect(readdirSync(root).sort()).toEqual(listBefore); // no sidecar files created
		expect(statSync(dbFile).mtimeMs).toBe(before); // main DB byte-for-byte untouched
	});
});

describe("recallDecisionEvent — telemetry carries counts only, never content", () => {
	it("event data has exactly the count/status fields, no snippet/path/body", () => {
		const { event, data } = recallDecisionEvent({
			status: "ready",
			policy: "required",
			hits: [
				{ title: "A", path: "tasks/wikis/s/pages/a.md", snippet: "secret snippet", tokenEstimate: 10 },
				{ title: "B", path: "tasks/wikis/s/pages/b.md", snippet: "another", tokenEstimate: 5 },
			],
			metadata: { policy: "required", source: "mk:cook", query: "cook", maxPages: 3, includeContent: false },
		});
		expect(event).toBe("capability-recall-decision");
		expect(Object.keys(data).sort()).toEqual(["capabilityId", "hitCount", "policy", "status", "tokenEstimate"]);
		expect(data.hitCount).toBe(2);
		expect(data.tokenEstimate).toBe(15);
		expect(JSON.stringify(data)).not.toContain("snippet");
		expect(JSON.stringify(data)).not.toContain("pages/");
	});
});
