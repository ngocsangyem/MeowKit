import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderWiki } from "../render.js";
import { MarkdownWikiRepository } from "../infrastructure/markdown-repository.js";
import { ApprovedWrite } from "../application/ports.js";
import { makeWikiPageId, makeWikiSlug } from "../domain/index.js";
import type { InjectionVerdict, WikiPage } from "../domain/index.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const CLEAN: InjectionVerdict = { status: "clean", passes: 4, findings: [] };

async function buildWiki(content: string): Promise<{ root: string; slug: string }> {
	const root = await mkdtemp(join(tmpdir(), "wiki-render-"));
	tempDirs.push(root);
	await mkdir(join(root, "tasks", "wikis", "demo", "pages"), { recursive: true });
	const repo = new MarkdownWikiRepository(root);
	repo.createWiki(makeWikiSlug("demo"), "Demo Wiki");
	const page: WikiPage = {
		id: makeWikiPageId("demo/intro"),
		slug: makeWikiSlug("demo"),
		title: "Salience Rubric",
		path: "pages/intro.md",
		content,
		state: "committed",
		createdAt: "2026-06-29T00:00:00.000Z",
		updatedAt: "2026-06-29T00:00:00.000Z",
		provenance: { origin: "human", sourceIds: ["src-1"], approvedBy: "alice" },
		links: [],
	};
	repo.writePage(ApprovedWrite.issue(page, { verdict: CLEAN, scrubbed: content, secretsFound: false }));
	return { root, slug: "demo" };
}

describe("renderWiki", () => {
	it("produces a self-contained HTML page with the wiki + page titles", async () => {
		const { root, slug } = await buildWiki("The salience rubric scores candidates.");
		const html = renderWiki(root, slug);
		expect(html).toContain("<!doctype html>");
		expect(html).toContain("Demo Wiki");
		expect(html).toContain("Salience Rubric");
		expect(html).toContain("salience rubric scores");
		expect(html).toContain("approved by alice");
	});

	it("has NO remote asset references (offline-openable, no CDN)", async () => {
		const { root, slug } = await buildWiki("body");
		const html = renderWiki(root, slug);
		expect(/(?:src|href)\s*=\s*["']https?:/i.test(html)).toBe(false);
		expect(/<script/i.test(html)).toBe(false);
		expect(/@import/i.test(html)).toBe(false);
		expect(/url\(\s*["']?https?:/i.test(html)).toBe(false);
	});

	it("HTML-escapes page content (DATA cannot inject markup/script)", async () => {
		const { root, slug } = await buildWiki("<script>alert(1)</script> & <b>x</b>");
		const html = renderWiki(root, slug);
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
		expect(html).not.toContain("<script>alert(1)</script>");
	});
});
