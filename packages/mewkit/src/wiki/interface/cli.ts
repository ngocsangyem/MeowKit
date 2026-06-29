import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MarkdownWikiRepository } from "../infrastructure/markdown-repository.js";
import { ScannerAdapter } from "../infrastructure/scanner-adapter.js";
import { SqliteWikiIndex } from "../infrastructure/sqlite-index.js";
import { TraceAdapter } from "../infrastructure/trace-adapter.js";
import { FetcherAdapter } from "../infrastructure/fetcher-adapter.js";
import { WikiService } from "../application/service.js";
import { listWikiPages, searchWiki } from "../application/queries.js";
import { renderWiki } from "../render.js";
import { buildIndex, dbPath } from "../../core/derived-index.js";
import { makeWikiSlug } from "../domain/index.js";
import type { SalienceComponents, WikiSeed, WikiSourceKind } from "../domain/index.js";

// The ONLY layer that constructs concrete adapters and injects them into the application
// service. Subcommands are advisory CLI surfaces: exit 0 on normal paths, non-zero only on a
// real error. Read paths (search/hint) never print full page content — hint emits title/score/
// path only (context discipline); full content loads only on explicit open.

export interface WikiCliOptions {
	subcommand?: string;
	rest: string[];
	flags: Record<string, unknown>;
}

function findClaudeDir(): string | null {
	let cur = process.cwd();
	for (;;) {
		const candidate = path.join(cur, ".claude");
		if (fs.existsSync(candidate)) return candidate;
		const parent = path.dirname(cur);
		if (parent === cur) return null;
		cur = parent;
	}
}

function buildService(claudeDir: string): WikiService {
	return new WikiService({
		repo: new MarkdownWikiRepository(path.dirname(claudeDir)),
		scanner: new ScannerAdapter(),
		index: new SqliteWikiIndex(dbPath(claudeDir)),
		tracer: new TraceAdapter(claudeDir),
		fetcher: new FetcherAdapter(),
	});
}

const CLI_SALIENCE: SalienceComponents = {
	explicit_user_intent: 3, // a human ran the command = explicit intent
	verified_outcome: 0,
	recurrence_or_friction: 0,
	novelty_vs_existing_wiki: 2,
	future_reuse_likelihood: 2,
	source_quality: 2,
	blast_radius: 1,
	security_risk_penalty: 0,
	staleness_penalty: 0,
};

function str(v: unknown): string | undefined {
	return typeof v === "string" ? v : undefined;
}

export async function wikiCommand(opts: WikiCliOptions): Promise<void> {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error("Could not find a .claude/ directory.");
		process.exit(0);
	}
	const projectRoot = path.dirname(claudeDir);
	const { subcommand, rest, flags } = opts;
	const svc = buildService(claudeDir);

	switch (subcommand) {
		case "init": {
			const slug = makeWikiSlug(rest[0] ?? "");
			svc.createWiki(slug, str(flags["title"]) ?? rest[1] ?? rest[0] ?? slug);
			console.log("created wiki: " + slug);
			return;
		}
		case "search": {
			const hits = searchWiki(new SqliteWikiIndex(dbPath(claudeDir)), rest.join(" "));
			if (flags["json"]) return void console.log(JSON.stringify(hits, null, 2));
			for (const h of hits) console.log(`${h.title} [${h.slug}] ~${h.tokenEstimate}tok\n  ${h.snippet}`);
			if (!hits.length) console.log("(no results)");
			return;
		}
		case "hint": {
			// Context-discipline surface: title + score + path ONLY, never content.
			const hits = searchWiki(new SqliteWikiIndex(dbPath(claudeDir)), rest.join(" "), 5);
			const hints = hits.map((h) => ({ title: h.title, score: h.tokenEstimate, path: h.pageId }));
			console.log(JSON.stringify(hints));
			return;
		}
		case "list": {
			for (const p of listWikiPages(new MarkdownWikiRepository(projectRoot), makeWikiSlug(rest[0] ?? ""))) console.log(p);
			return;
		}
		case "render": {
			const html = renderWiki(projectRoot, rest[0] ?? "");
			const out = str(flags["out"]);
			if (out) {
				fs.writeFileSync(out, html, "utf-8");
				console.log("wrote " + out);
			} else {
				console.log(html);
			}
			return;
		}
		case "reindex": {
			const r = svc.reindexWiki(claudeDir);
			console.log(`reindexed: ${r.wiki.pages} page(s)`);
			return;
		}
		case "enqueue": {
			const seed: WikiSeed = {
				id: "seed-" + randomUUID().slice(0, 8),
				query: rest.slice(1).join(" "),
				kind: (str(flags["kind"]) as WikiSourceKind) ?? "web",
				status: "queued",
				createdAt: new Date().toISOString(),
			};
			svc.enqueueSeed(makeWikiSlug(rest[0] ?? ""), seed);
			console.log("enqueued seed: " + seed.id);
			return;
		}
		case "research": {
			const slug = makeWikiSlug(rest[0] ?? "");
			const seed: WikiSeed = {
				id: "seed-" + randomUUID().slice(0, 8),
				query: rest.slice(1).join(" "),
				kind: (str(flags["kind"]) as WikiSourceKind) ?? "web",
				status: "queued",
				createdAt: new Date().toISOString(),
			};
			const outcome = await svc.runResearchStep(slug, seed);
			console.log(`research → ${outcome.decision}${outcome.candidateId ? " (" + outcome.candidateId + ")" : ""}`);
			return;
		}
		case "propose": {
			const file = str(flags["file"]);
			const content = file ? fs.readFileSync(file, "utf-8") : (str(flags["content"]) ?? "");
			const result = svc.proposeCandidate({
				slug: makeWikiSlug(rest[0] ?? ""),
				title: str(flags["title"]) ?? (rest.slice(1).join(" ") || "Untitled"),
				content,
				origin: "human",
				whySave: str(flags["why"]) ?? "cli propose",
				evidence: str(flags["evidence"]) ?? "",
				sourceIds: [],
				salience: CLI_SALIENCE,
			});
			console.log(`propose → ${result.decision.kind}${result.candidate ? " (" + result.candidate.id + ")" : ""}`);
			return;
		}
		case "approve": {
			const page = svc.approveCandidate(makeWikiSlug(rest[0] ?? ""), rest[1] ?? "", str(flags["by"]) ?? "cli-user");
			console.log("approved → " + page.path);
			return;
		}
		case "reject": {
			svc.rejectCandidate(makeWikiSlug(rest[0] ?? ""), rest[1] ?? "", str(flags["reason"]) ?? "rejected via cli");
			console.log("rejected: " + (rest[1] ?? ""));
			return;
		}
		default:
			console.log("usage: mewkit wiki <init|propose|approve|reject|search|hint|list|render|reindex|enqueue|research>");
			return;
	}
}
