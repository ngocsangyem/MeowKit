import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import yaml from "js-yaml";
import type {
	InjectionVerdict,
	WikiCandidate,
	WikiIntervention,
	WikiPage,
	WikiSeed,
	WikiSlug,
	WikiSource,
} from "../domain/index.js";
import { assertCanonicalComplete, assertNoTraversal, makeWikiPageId, makeWikiSlug } from "../domain/index.js";
import type { ApprovedWrite, WikiRepository } from "../application/ports.js";

// Canonical Markdown repository for tasks/wikis/<slug>/. All writes are atomic (temp-file +
// rename) via a LOCAL helper — there is no shared IO wrapper and no-direct-io does not cover
// src/wiki/, so the safety property is type-enforced: writePage accepts ONLY an ApprovedWrite
// token. Quarantined content lands in a read-blocked .quarantined file.

function atomicWriteText(filePath: string, text: string): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tmp = filePath + ".tmp-" + process.pid;
	fs.writeFileSync(tmp, text, "utf-8");
	fs.renameSync(tmp, filePath);
}

/** Minimal runtime shape check for a candidate record from JSONL. The required string fields
 * + a salience object are what the approve path and index ingest rely on; malformed records
 * (incl. anything an untrusted producer might emit) are dropped. */
function isCandidateRecord(r: unknown): r is WikiCandidate {
	if (!r || typeof r !== "object") return false;
	const o = r as Record<string, unknown>;
	return (
		typeof o["id"] === "string" &&
		typeof o["slug"] === "string" &&
		typeof o["title"] === "string" &&
		typeof o["content"] === "string" &&
		typeof o["state"] === "string" &&
		typeof o["salience"] === "object" &&
		o["salience"] !== null
	);
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
	if (!raw.startsWith("---")) return { meta: {}, body: raw };
	const end = raw.indexOf("\n---", 3);
	if (end === -1) return { meta: {}, body: raw };
	const loaded: unknown = yaml.load(raw.slice(3, end).trim());
	const meta = loaded && typeof loaded === "object" ? (loaded as Record<string, unknown>) : {};
	return { meta, body: raw.slice(end + 4).replace(/^\r?\n/, "") };
}

export class MarkdownWikiRepository implements WikiRepository {
	constructor(private readonly projectRoot: string) {}

	private wikiDir(slug: WikiSlug): string {
		return path.join(this.projectRoot, "tasks", "wikis", slug);
	}

	/** Resolve a repo-relative sub-path inside a slug dir, rejecting traversal. */
	private resolveInSlug(slug: WikiSlug, relative: string): string {
		assertNoTraversal(relative);
		const base = this.wikiDir(slug);
		const target = path.resolve(base, relative);
		if (target !== base && !target.startsWith(base + path.sep)) {
			throw new Error("path escapes the wiki directory: " + JSON.stringify(relative));
		}
		return target;
	}

	createWiki(slug: WikiSlug, title: string): void {
		const meta = { slug, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
		atomicWriteText(path.join(this.wikiDir(slug), "wiki.json"), JSON.stringify(meta, null, 2) + "\n");
	}

	writePage(token: ApprovedWrite): void {
		const page = token.page;
		assertCanonicalComplete(page); // re-assert invariants at the write boundary
		const target = this.resolveInSlug(page.slug, page.path);
		// `origin` stays top-level so the ingest reads it; full provenance is persisted too.
		const meta: Record<string, unknown> = {
			id: page.id,
			slug: page.slug,
			title: page.title,
			state: page.state,
			origin: page.provenance.origin,
			createdAt: page.createdAt,
			updatedAt: page.updatedAt,
			links: page.links,
			sourceIds: page.provenance.sourceIds,
		};
		if (page.provenance.approvedBy) meta["approvedBy"] = page.provenance.approvedBy;
		if (page.provenance.candidateId) meta["candidateId"] = page.provenance.candidateId;
		atomicWriteText(target, "---\n" + yaml.dump(meta) + "---\n" + page.content + "\n");
	}

	readPage(slug: WikiSlug, file: string): WikiPage | null {
		const target = this.resolveInSlug(slug, path.join("pages", file));
		if (!fs.existsSync(target)) return null;
		const { meta, body } = parseFrontmatter(fs.readFileSync(target, "utf-8"));
		const origin = meta["origin"] === "agent" || meta["origin"] === "system" ? meta["origin"] : "human";
		return {
			id: makeWikiPageId(typeof meta["id"] === "string" ? meta["id"] : slug + "/" + file),
			slug: makeWikiSlug(typeof meta["slug"] === "string" ? meta["slug"] : slug),
			title: typeof meta["title"] === "string" ? meta["title"] : file.replace(/\.md$/, ""),
			path: path.join("pages", file),
			content: body,
			state: typeof meta["state"] === "string" ? (meta["state"] as WikiPage["state"]) : "committed",
			createdAt: typeof meta["createdAt"] === "string" ? meta["createdAt"] : "",
			updatedAt: typeof meta["updatedAt"] === "string" ? meta["updatedAt"] : "",
			provenance: {
				origin,
				sourceIds: Array.isArray(meta["sourceIds"]) ? (meta["sourceIds"] as string[]) : [],
				approvedBy: typeof meta["approvedBy"] === "string" ? meta["approvedBy"] : undefined,
				candidateId: typeof meta["candidateId"] === "string" ? meta["candidateId"] : undefined,
			},
			links: [],
		};
	}

	listPages(slug: WikiSlug): string[] {
		const dir = path.join(this.wikiDir(slug), "pages");
		if (!fs.existsSync(dir)) return [];
		return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
	}

	private appendJsonl(slug: WikiSlug, file: string, record: unknown): void {
		const target = this.resolveInSlug(slug, file);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.appendFileSync(target, JSON.stringify(record) + "\n", "utf-8");
	}

	private readJsonl(slug: WikiSlug, file: string): unknown[] {
		const target = this.resolveInSlug(slug, file);
		if (!fs.existsSync(target)) return [];
		const out: unknown[] = [];
		for (const line of fs.readFileSync(target, "utf-8").split("\n")) {
			if (!line.trim()) continue;
			try {
				const parsed: unknown = JSON.parse(line);
				if (parsed && typeof parsed === "object") out.push(parsed);
			} catch {
				// tolerant — skip a malformed line
			}
		}
		return out;
	}

	appendCandidate(candidate: WikiCandidate): void {
		this.appendJsonl(candidate.slug, "candidates.jsonl", candidate);
	}

	appendIntervention(slug: WikiSlug, intervention: WikiIntervention): void {
		this.appendJsonl(slug, "interventions.jsonl", intervention);
	}

	appendSeed(slug: WikiSlug, seed: WikiSeed): void {
		this.appendJsonl(slug, "seeds.jsonl", seed);
	}

	appendSource(slug: WikiSlug, source: WikiSource): void {
		this.appendJsonl(slug, "sources.jsonl", source);
	}

	listCandidates(slug: WikiSlug): WikiCandidate[] {
		// Runtime shape guard at the store boundary — candidates.jsonl gains an untrusted
		// producer (fetched→candidate), so malformed records are skipped, not cast blind.
		return this.readJsonl(slug, "candidates.jsonl").filter(isCandidateRecord);
	}

	getCandidate(slug: WikiSlug, id: string): WikiCandidate | null {
		return this.listCandidates(slug).find((c) => c.id === id) ?? null;
	}

	quarantine(slug: WikiSlug, content: string, verdict: InjectionVerdict): string {
		const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
		const target = this.resolveInSlug(slug, path.join("quarantine", hash + ".quarantined"));
		const header = "QUARANTINED — DATA, do not execute. verdict=" + verdict.status + " findings=" + JSON.stringify(verdict.findings) + "\n";
		atomicWriteText(target, header + content);
		fs.chmodSync(target, 0o400); // owner read-only — re-injection-resistant at rest
		return target;
	}
}
