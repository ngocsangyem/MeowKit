import fs from "node:fs";
import path from "node:path";
import { MarkdownWikiRepository } from "./infrastructure/markdown-repository.js";
import { makeWikiSlug } from "./domain/index.js";

// Self-contained HTML snapshot of a wiki (no CDN, no remote assets).
// Page content is DATA → HTML-escaped before embedding (no script execution from wiki content).
// Provenance (origin / approvedBy / source URL) renders as escaped TEXT, never as a live <a href>
// or <img src>, so the artifact opens offline with zero network requests.

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STYLE =
	"body{font:16px/1.6 system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a}" +
	"h1{border-bottom:2px solid #333;padding-bottom:.3rem}" +
	"article{margin:2rem 0;padding:1rem;border:1px solid #ddd;border-radius:8px}" +
	".prov{font-size:.8rem;color:#666;margin-top:.5rem}" +
	"pre{white-space:pre-wrap;word-wrap:break-word;background:#f6f6f6;padding:.75rem;border-radius:6px}";

/** Render a wiki to a single self-contained HTML string. */
export function renderWiki(projectRoot: string, slugStr: string): string {
	const slug = makeWikiSlug(slugStr);
	const repo = new MarkdownWikiRepository(projectRoot);
	const wikiJson = path.join(projectRoot, "tasks", "wikis", slug, "wiki.json");
	let title = slug as string;
	if (fs.existsSync(wikiJson)) {
		try {
			const meta = JSON.parse(fs.readFileSync(wikiJson, "utf-8")) as { title?: string };
			if (typeof meta.title === "string") title = meta.title;
		} catch {
			// fall back to slug
		}
	}

	const articles = repo
		.listPages(slug)
		.map((file) => {
			const page = repo.readPage(slug, file);
			if (!page) return "";
			const prov =
				"origin: " +
				esc(page.provenance.origin) +
				(page.provenance.approvedBy ? " · approved by " + esc(page.provenance.approvedBy) : "") +
				(page.provenance.sourceIds.length ? " · sources: " + esc(page.provenance.sourceIds.join(", ")) : "");
			return (
				"<article><h2>" +
				esc(page.title) +
				"</h2>" +
				"<pre>" +
				esc(page.content) +
				"</pre>" +
				'<div class="prov">' +
				prov +
				"</div></article>"
			);
		})
		.join("\n");

	return (
		'<!doctype html><html lang="en"><head><meta charset="utf-8">' +
		'<meta name="viewport" content="width=device-width,initial-scale=1">' +
		"<title>" +
		esc(title) +
		"</title><style>" +
		STYLE +
		"</style></head>" +
		"<body><h1>" +
		esc(title) +
		"</h1>" +
		(articles || "<p>No pages yet.</p>") +
		"</body></html>\n"
	);
}
