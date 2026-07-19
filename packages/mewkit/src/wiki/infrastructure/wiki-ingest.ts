import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { DatabaseSync } from "node:sqlite";
import { WIKI_TABLES } from "./wiki-schema.js";

// Full-rebuild ingest of the canonical wiki tree at tasks/wikis/<slug>/ into the
// derived index. Deterministic: clear every wiki table, then re-read the files.
// wiki_fts is maintained by the wiki_page triggers, so it is never touched here.
// All writes use prepared, parameterized statements; table names in the clear
// loop are hard-coded constants from WIKI_TABLES (no user input).

export interface WikiIngestCounts {
	wikis: number;
	pages: number;
	sources: number;
	claims: number;
	candidates: number;
	seeds: number;
	interventions: number;
	links: number;
	handoffs: number;
	candidateSources: number;
}

function s(v: unknown): string | null {
	if (v === null || v === undefined) return null;
	return typeof v === "string" ? v : String(v);
}

function n(v: unknown): number | null {
	return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function readJsonl(file: string): Record<string, unknown>[] {
	if (!fs.existsSync(file)) return [];
	const out: Record<string, unknown>[] = [];
	for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const parsed: unknown = JSON.parse(trimmed);
			if (parsed && typeof parsed === "object") out.push(parsed as Record<string, unknown>);
		} catch {
			// tolerant: skip a malformed line, keep ingesting the rest
		}
	}
	return out;
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
	if (!raw.startsWith("---")) return { meta: {}, body: raw };
	const end = raw.indexOf("\n---", 3);
	if (end === -1) return { meta: {}, body: raw };
	const loaded: unknown = yaml.load(raw.slice(3, end).trim());
	const meta = loaded && typeof loaded === "object" ? (loaded as Record<string, unknown>) : {};
	return { meta, body: raw.slice(end + 4).replace(/^\r?\n/, "") };
}

function listDirs(root: string): string[] {
	if (!fs.existsSync(root)) return [];
	return fs
		.readdirSync(root, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort();
}

function ingestSlug(db: DatabaseSync, root: string, slug: string, c: WikiIngestCounts): void {
	const dir = path.join(root, slug);

	const wikiMeta = ((): Record<string, unknown> => {
		const f = path.join(dir, "wiki.json");
		if (!fs.existsSync(f)) return { slug };
		try {
			const parsed: unknown = JSON.parse(fs.readFileSync(f, "utf-8"));
			return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : { slug };
		} catch {
			return { slug };
		}
	})();
	db.prepare("INSERT OR REPLACE INTO wiki (slug, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
		slug,
		s(wikiMeta["title"]) ?? slug,
		s(wikiMeta["createdAt"]),
		s(wikiMeta["updatedAt"]),
	);
	c.wikis += 1;

	// OR IGNORE (not OR REPLACE): two files claiming the same id is malformed input;
	// ignoring the later one keeps ingest crash-free AND keeps wiki_fts consistent —
	// REPLACE's implicit delete does NOT fire the AFTER DELETE trigger under the default
	// recursive_triggers=off, which would strand a duplicate FTS row. First file wins
	// (files are read in sorted order, so the choice is deterministic).
	const pageStmt = db.prepare(
		"INSERT OR IGNORE INTO wiki_page (id, slug, title, path, content, state, origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	const linkStmt = db.prepare("INSERT OR IGNORE INTO wiki_link (from_page_id, to_page_id) VALUES (?, ?)");
	const pagesDir = path.join(dir, "pages");
	if (fs.existsSync(pagesDir)) {
		for (const file of fs
			.readdirSync(pagesDir)
			.filter((f) => f.endsWith(".md"))
			.sort()) {
			const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(pagesDir, file), "utf-8"));
			const id = s(meta["id"]) ?? `${slug}/${file}`;
			const inserted =
				pageStmt.run(
					id,
					s(meta["slug"]) ?? slug,
					s(meta["title"]) ?? file.replace(/\.md$/, ""),
					`pages/${file}`,
					body,
					s(meta["state"]) ?? "committed",
					s(meta["origin"]) ?? "human",
					s(meta["createdAt"]),
					s(meta["updatedAt"]),
				).changes > 0;
			if (!inserted) continue; // duplicate id ignored — skip the page and its links
			c.pages += 1;
			const links = Array.isArray(meta["links"]) ? (meta["links"] as unknown[]) : [];
			for (const to of links) {
				const toId = s(to);
				if (toId) {
					linkStmt.run(id, toId);
					c.links += 1;
				}
			}
		}
	}

	const srcStmt = db.prepare(
		"INSERT OR REPLACE INTO wiki_source (id, kind, url, title, fetched_at, content_hash) VALUES (?, ?, ?, ?, ?, ?)",
	);
	for (const o of readJsonl(path.join(dir, "sources.jsonl"))) {
		srcStmt.run(s(o["id"]), s(o["kind"]), s(o["url"]), s(o["title"]), s(o["fetchedAt"]), s(o["contentHash"]));
		c.sources += 1;
	}

	const claimStmt = db.prepare(
		"INSERT OR REPLACE INTO wiki_claim (id, text, external, source_id, page_id) VALUES (?, ?, ?, ?, ?)",
	);
	for (const o of readJsonl(path.join(dir, "claims.jsonl"))) {
		claimStmt.run(s(o["id"]), s(o["text"]), o["external"] ? 1 : 0, s(o["sourceId"]), s(o["pageId"]));
		c.claims += 1;
	}

	const seedStmt = db.prepare(
		"INSERT OR REPLACE INTO wiki_seed (id, query, kind, status, created_at) VALUES (?, ?, ?, ?, ?)",
	);
	for (const o of readJsonl(path.join(dir, "seeds.jsonl"))) {
		seedStmt.run(s(o["id"]), s(o["query"]), s(o["kind"]), s(o["status"]), s(o["createdAt"]));
		c.seeds += 1;
	}

	const candStmt = db.prepare(
		"INSERT OR REPLACE INTO wiki_candidate (id, slug, origin, title, content, why_save, evidence, novelty_delta, reuse_scope, verification_state, risk_score, salience_total, state, created_at, review_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	const salStmt = db.prepare(
		"INSERT OR REPLACE INTO wiki_salience (candidate_id, explicit_user_intent, verified_outcome, recurrence_or_friction, novelty_vs_existing_wiki, future_reuse_likelihood, source_quality, blast_radius, security_risk_penalty, staleness_penalty, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	// v3 relation: candidate↔source, backfilled from each candidate's sourceIds array.
	// OR IGNORE + gate on .changes keeps re-ingest idempotent; an empty/missing sourceIds
	// list yields zero rows and is NOT an error (the Aspire-shaped data has no sources).
	const candSrcStmt = db.prepare("INSERT OR IGNORE INTO wiki_candidate_source (candidate_id, source_id) VALUES (?, ?)");
	for (const o of readJsonl(path.join(dir, "candidates.jsonl"))) {
		const id = s(o["id"]);
		const sal = (o["salience"] && typeof o["salience"] === "object" ? o["salience"] : {}) as Record<string, unknown>;
		const comp = (sal["components"] && typeof sal["components"] === "object" ? sal["components"] : {}) as Record<
			string,
			unknown
		>;
		candStmt.run(
			id,
			s(o["slug"]) ?? slug,
			s(o["origin"]) ?? "agent",
			s(o["title"]) ?? "",
			s(o["content"]) ?? "",
			s(o["whySave"]),
			s(o["evidence"]),
			n(o["noveltyDelta"]),
			s(o["reuseScope"]),
			s(o["verificationState"]),
			n(o["riskScore"]),
			n(sal["total"]),
			s(o["state"]) ?? "proposed",
			s(o["createdAt"]),
			s(o["reviewAfter"]),
		);
		if (id) {
			salStmt.run(
				id,
				n(comp["explicit_user_intent"]),
				n(comp["verified_outcome"]),
				n(comp["recurrence_or_friction"]),
				n(comp["novelty_vs_existing_wiki"]),
				n(comp["future_reuse_likelihood"]),
				n(comp["source_quality"]),
				n(comp["blast_radius"]),
				n(comp["security_risk_penalty"]),
				n(comp["staleness_penalty"]),
				n(sal["total"]),
			);
			const sourceIds = Array.isArray(o["sourceIds"]) ? (o["sourceIds"] as unknown[]) : [];
			for (const src of sourceIds) {
				const srcId = s(src);
				if (srcId && candSrcStmt.run(id, srcId).changes > 0) c.candidateSources += 1;
			}
		}
		c.candidates += 1;
	}

	const intStmt = db.prepare(
		"INSERT OR REPLACE INTO wiki_intervention (id, kind, candidate_id, reason, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)",
	);
	for (const o of readJsonl(path.join(dir, "interventions.jsonl"))) {
		intStmt.run(s(o["id"]), s(o["kind"]), s(o["candidateId"]), s(o["reason"]), s(o["actor"]), s(o["createdAt"]));
		c.interventions += 1;
	}

	// v3: handoff outcome records. salience is flattened to a total column + a
	// JSON blob (red-team S1 — no per-component child table). OR IGNORE + .changes
	// gate keeps re-ingest idempotent. Absent handoffs.jsonl yields zero rows.
	const hoStmt = db.prepare(
		"INSERT OR IGNORE INTO wiki_handoff (id, slug, skill_name, skill_owner, handoff_class, profile, artifact_path, artifact_hash, title, why_save, evidence, reuse_scope, verification_state, risk_score, salience_total, salience_json, decision_kind, candidate_id, page_id, status, created_at, review_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	for (const o of readJsonl(path.join(dir, "handoffs.jsonl"))) {
		const sal = (o["salience"] && typeof o["salience"] === "object" ? o["salience"] : {}) as Record<string, unknown>;
		const inserted =
			hoStmt.run(
				s(o["id"]),
				s(o["slug"]) ?? slug,
				s(o["skillName"]) ?? "",
				s(o["skillOwner"]),
				s(o["handoffClass"]) ?? "none",
				s(o["profile"]) ?? "none",
				s(o["artifactPath"]) ?? "",
				s(o["artifactHash"]) ?? "",
				s(o["title"]) ?? "",
				s(o["whySave"]),
				s(o["evidence"]),
				s(o["reuseScope"]),
				s(o["verificationState"]),
				n(o["riskScore"]),
				n(sal["total"]),
				JSON.stringify(o["salience"] ?? {}),
				s(o["decisionKind"]),
				s(o["candidateId"]),
				s(o["pageId"]),
				s(o["status"]) ?? "suggested",
				s(o["createdAt"]),
				s(o["reviewAfter"]),
			).changes > 0;
		if (inserted) c.handoffs += 1;
	}
}

/** One canonical wiki page as ingest sees it: the same id/path/body the index stores. */
export interface CanonicalPage {
	id: string;
	slug: string;
	path: string;
	body: string;
}

/**
 * Read the canonical wiki pages exactly as `ingestSlug` ingests them — same frontmatter parse,
 * same id derivation (`meta.id` else `<slug>/<file>`), same first-file-wins dedup on duplicate
 * ids (mirrors the INSERT OR IGNORE). Exported so `wiki verify` compares canonical vs indexed
 * bodies through ONE parsing path (no drift between ingest and verify).
 */
export function readCanonicalPages(projectRoot: string): CanonicalPage[] {
	const root = path.join(projectRoot, "tasks", "wikis");
	const out: CanonicalPage[] = [];
	for (const slug of listDirs(root)) {
		const pagesDir = path.join(root, slug, "pages");
		if (!fs.existsSync(pagesDir)) continue;
		const seen = new Set<string>();
		for (const file of fs
			.readdirSync(pagesDir)
			.filter((f) => f.endsWith(".md"))
			.sort()) {
			const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(pagesDir, file), "utf-8"));
			const id = s(meta["id"]) ?? `${slug}/${file}`;
			if (seen.has(id)) continue; // duplicate id — first file wins, mirroring INSERT OR IGNORE
			seen.add(id);
			out.push({ id, slug: s(meta["slug"]) ?? slug, path: `pages/${file}`, body });
		}
	}
	return out;
}

/** Clear and rebuild every wiki table from the canonical tree. Returns row counts. */
export function ingestWiki(db: DatabaseSync, projectRoot: string): WikiIngestCounts {
	const counts: WikiIngestCounts = {
		wikis: 0,
		pages: 0,
		sources: 0,
		claims: 0,
		candidates: 0,
		seeds: 0,
		interventions: 0,
		links: 0,
		handoffs: 0,
		candidateSources: 0,
	};
	for (const table of WIKI_TABLES) {
		db.exec("DELETE FROM " + table); // table is a constant from WIKI_TABLES, never user input
	}
	const root = path.join(projectRoot, "tasks", "wikis");
	for (const slug of listDirs(root)) {
		ingestSlug(db, root, slug, counts);
	}
	return counts;
}
