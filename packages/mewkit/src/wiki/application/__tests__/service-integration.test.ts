import { mkdtemp, mkdir, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WikiService } from "../service.js";
import { searchWiki } from "../queries.js";
import { MarkdownWikiRepository } from "../../infrastructure/markdown-repository.js";
import { ScannerAdapter } from "../../infrastructure/scanner-adapter.js";
import { SqliteWikiIndex } from "../../infrastructure/sqlite-index.js";
import { TraceAdapter } from "../../infrastructure/trace-adapter.js";
import { buildIndex, dbPath } from "../../../core/derived-index.js";
import { makeWikiSlug } from "../../domain/index.js";
import type { SalienceComponents } from "../../domain/index.js";

// End-to-end with REAL adapters (criterion #3): createWiki → proposeCandidate → approveCandidate
// must produce a canonical page file under tasks/wikis/<slug>/pages/ and an FTS-searchable row.

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const HIGH: SalienceComponents = {
	explicit_user_intent: 3,
	verified_outcome: 3,
	recurrence_or_friction: 2,
	novelty_vs_existing_wiki: 0,
	future_reuse_likelihood: 0,
	source_quality: 0,
	blast_radius: 0,
	security_risk_penalty: 0,
	staleness_penalty: 0,
};

describe("WikiService end-to-end (real adapters)", () => {
	it("creates → proposes → approves into a canonical page + FTS row", async () => {
		const root = await mkdtemp(join(tmpdir(), "wiki-e2e-"));
		tempDirs.push(root);
		const claudeDir = join(root, ".claude");
		await mkdir(join(claudeDir, "memory"), { recursive: true });
		buildIndex(claudeDir); // create the index schema

		const slug = makeWikiSlug("demo");
		const svc = new WikiService({
			repo: new MarkdownWikiRepository(root),
			scanner: new ScannerAdapter(),
			index: new SqliteWikiIndex(dbPath(claudeDir)),
			tracer: new TraceAdapter(claudeDir),
		});

		svc.createWiki(slug, "Demo Wiki");
		const { candidate } = svc.proposeCandidate({
			slug,
			title: "Salience Rubric",
			content: "The salience rubric scores candidates before any canonical write.",
			origin: "agent",
			whySave: "core defense",
			evidence: "review accepted",
			sourceIds: [],
			salience: HIGH,
		});
		expect(candidate).toBeDefined();
		// Candidate exists; NO canonical page yet (agent cannot self-commit).
		expect(existsSync(join(root, "tasks", "wikis", "demo", "pages", "salience-rubric.md"))).toBe(false);
		expect(existsSync(join(root, "tasks", "wikis", "demo", "candidates.jsonl"))).toBe(true);

		const page = svc.approveCandidate(slug, candidate!.id, "alice");
		const pagePath = join(root, "tasks", "wikis", "demo", "pages", "salience-rubric.md");
		expect(existsSync(pagePath)).toBe(true);
		expect(page.provenance.approvedBy).toBe("alice");
		const md = await readFile(pagePath, "utf-8");
		expect(md).toContain("salience rubric");
		expect(md).toContain("approvedBy: alice");

		// Indexed + searchable.
		const hits = searchWiki(new SqliteWikiIndex(dbPath(claudeDir)), "salience");
		expect(hits.length).toBe(1);
		expect(hits[0]!.slug).toBe("demo");
	});

	it("a secret in the proposed content is scrubbed out of the canonical page", async () => {
		const root = await mkdtemp(join(tmpdir(), "wiki-e2e-"));
		tempDirs.push(root);
		const claudeDir = join(root, ".claude");
		await mkdir(join(claudeDir, "memory"), { recursive: true });
		buildIndex(claudeDir);
		const slug = makeWikiSlug("demo");
		const svc = new WikiService({
			repo: new MarkdownWikiRepository(root),
			scanner: new ScannerAdapter(),
			index: new SqliteWikiIndex(dbPath(claudeDir)),
			tracer: new TraceAdapter(claudeDir),
		});
		svc.createWiki(slug, "Demo");
		const { candidate } = svc.proposeCandidate({
			slug,
			title: "Deploy Notes",
			content: "Use the deploy key AKIA1234567890ABCDEF to ship.",
			origin: "agent",
			whySave: "ops",
			evidence: "runbook",
			sourceIds: [],
			salience: HIGH,
		});
		const page = svc.approveCandidate(slug, candidate!.id, "alice");
		const md = await readFile(join(root, "tasks", "wikis", "demo", "pages", page.path.replace("pages/", "")), "utf-8");
		expect(md).toContain("[REDACTED-AWS-KEY]");
		expect(md).not.toContain("AKIA1234567890ABCDEF");
	});
});
