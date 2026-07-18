import { randomUUID } from "node:crypto";
import { canTransition, decideWrite, makeWikiPageId, scoreSalience } from "../domain/index.js";
import type {
	SalienceComponents,
	SalienceScore,
	WikiCandidate,
	WikiIntervention,
	WikiPage,
	WikiSeed,
	WikiSlug,
	WikiOrigin,
} from "../domain/index.js";
import { buildIndex, type IndexResult } from "../../core/derived-index.js";
import { ApprovedWrite } from "./ports.js";
import type { ProposeInput, ProposeResult, ScanOutput, WikiServiceDeps } from "./ports.js";
import { runResearchStep as runResearch, type ResearchOutcome } from "./research.js";

// Re-export the application-boundary types so callers can import them from the service.
export type { ProposeInput, ProposeResult, WikiServiceDeps } from "./ports.js";

// The application service: orchestrates domain + adapters with strict command/query
// separation. The write-transaction order is the spine — scrub+scan precede every
// canonical write, and `commitWrite` is the ONLY caller of repo.writePage (the
// "writePage" step). approveCandidate is the sole canonical-page minting path; agent-origin
// content has no code path to a canonical page. Reads live in queries.ts (no write port).

function slugifyTitle(title: string): string {
	const s = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return s || "page";
}

export class WikiService {
	constructor(private readonly deps: WikiServiceDeps) {}

	createWiki(slug: WikiSlug, title: string): void {
		this.deps.repo.createWiki(slug, title);
		this.deps.tracer.recordWikiTrace("wiki_create", { slug, title });
	}

	scoreCandidate(components: SalienceComponents): SalienceScore {
		return scoreSalience(components);
	}

	/** Agent/system entry point. NEVER writes a canonical page — at most a candidate. */
	proposeCandidate(input: ProposeInput): ProposeResult {
		const scan = this.deps.scanner.scan({ content: input.content, origin: input.origin, sourceUrl: input.sourceUrl });
		const score = scoreSalience(input.salience);
		const decision = decideWrite(score, scan.verdict, input.dup ?? { isHighDuplicate: false });
		const now = new Date().toISOString();

		if (decision.kind === "quarantine") {
			const p = this.deps.repo.quarantine(input.slug, input.content, scan.verdict);
			this.recordIntervention(input.slug, "quarantine", undefined, decision.reason, input.origin, scan);
			this.deps.tracer.recordWikiTrace("wiki_quarantine", { slug: input.slug, reason: decision.reason, path: p });
			return { decision };
		}
		if (decision.kind === "link-existing") {
			this.recordIntervention(input.slug, "link", undefined, decision.reason, input.origin);
			this.deps.tracer.recordWikiTrace("wiki_link", { slug: input.slug, existing: decision.existingPageId });
			return { decision };
		}
		if (decision.kind === "discard") {
			this.deps.tracer.recordWikiTrace("wiki_discard", { slug: input.slug, reason: decision.reason });
			return { decision };
		}

		// propose-candidate | append-candidate → persist a candidate carrying SCRUBBED content.
		const candidate: WikiCandidate = {
			id: input.slug + "/cand-" + randomUUID().slice(0, 8),
			slug: input.slug,
			origin: input.origin,
			title: input.title,
			content: scan.scrubbed,
			whySave: input.whySave,
			evidence: input.evidence,
			sourceIds: input.sourceIds,
			noveltyDelta: input.noveltyDelta ?? 0,
			reuseScope: input.reuseScope ?? "",
			verificationState: input.verificationState ?? "unverified",
			riskScore: input.riskScore ?? 0,
			salience: score,
			state: "proposed",
			createdAt: now,
			reviewAfter: input.reviewAfter,
		};
		this.deps.repo.appendCandidate(candidate);
		this.deps.tracer.recordWikiTrace("wiki_candidate", { id: candidate.id, kind: decision.kind, total: score.total });
		return { decision, candidate };
	}

	/** The ONLY canonical-page minting path. Human approval confirms intent but the scanner
	 * ALWAYS re-runs — approval can never bypass it. */
	approveCandidate(slug: WikiSlug, candidateId: string, approvedBy: string): WikiPage {
		const candidate = this.deps.repo.getCandidate(slug, candidateId);
		if (!candidate) throw new Error("candidate not found: " + candidateId);

		const scan = this.deps.scanner.scan({ content: candidate.content, origin: "human" });
		if (scan.verdict.status !== "clean") {
			const p = this.deps.repo.quarantine(slug, candidate.content, scan.verdict);
			this.recordIntervention(slug, "quarantine", candidateId, "approval re-scan failed", "human", scan);
			this.deps.tracer.recordWikiTrace("wiki_approve_blocked", { candidateId, verdict: scan.verdict.status, path: p });
			throw new Error("approval blocked: candidate failed re-scan (" + scan.verdict.status + ")");
		}

		const now = new Date().toISOString();
		const page: WikiPage = {
			id: makeWikiPageId(slug + "/" + slugifyTitle(candidate.title)),
			slug,
			title: candidate.title,
			path: "pages/" + slugifyTitle(candidate.title) + ".md",
			content: scan.scrubbed,
			state: "committed",
			createdAt: candidate.createdAt,
			updatedAt: now,
			provenance: { origin: "human", sourceIds: candidate.sourceIds, candidateId, approvedBy },
			links: [],
		};
		// Defense-in-depth: a human commit is allowed; an agent-origin commit would be barred.
		const t = canTransition("approved", "committed", { origin: page.provenance.origin });
		if (!t.ok) throw new Error(t.reason);

		this.commitWrite(page, scan, { candidateId, approvedBy });
		return page;
	}

	rejectCandidate(slug: WikiSlug, candidateId: string, reason: string): void {
		this.recordIntervention(slug, "reject", candidateId, reason, "human");
		this.deps.tracer.recordWikiTrace("wiki_reject", { candidateId, reason });
	}

	enqueueSeed(slug: WikiSlug, seed: WikiSeed): void {
		this.deps.repo.appendSeed(slug, seed);
		this.deps.tracer.recordWikiTrace("wiki_seed", { slug, query: seed.query });
	}

	reindexWiki(claudeDir: string): IndexResult {
		const result = buildIndex(claudeDir);
		this.deps.tracer.recordWikiTrace("wiki_reindex", { pages: result.wiki.pages });
		return result;
	}

	recordWikiTrace(event: string, data: Record<string, unknown>): void {
		this.deps.tracer.recordWikiTrace(event, data);
	}

	/** Fetched content → candidate ONLY (never a canonical page). Requires a Fetcher dep. */
	async runResearchStep(slug: WikiSlug, seed: WikiSeed): Promise<ResearchOutcome> {
		if (!this.deps.fetcher) throw new Error("research is not enabled: no Fetcher configured");
		return runResearch(
			{
				fetcher: this.deps.fetcher,
				index: this.deps.index,
				propose: (i) => this.proposeCandidate(i),
				appendSource: (s, src) => this.deps.repo.appendSource(s, src),
				trace: (e, d) => this.deps.tracer.recordWikiTrace(e, d),
			},
			slug,
			seed,
		);
	}

	private recordIntervention(
		slug: WikiSlug,
		kind: WikiIntervention["kind"],
		candidateId: string | undefined,
		reason: string,
		actor: WikiOrigin,
		scan?: ScanOutput,
	): void {
		const intervention: WikiIntervention = {
			id: "int-" + randomUUID().slice(0, 8),
			kind,
			candidateId,
			reason,
			verdict: scan?.verdict,
			actor,
			createdAt: new Date().toISOString(),
		};
		this.deps.repo.appendIntervention(slug, intervention);
	}

	/** The "writePage" step and the SOLE caller of repo.writePage. Write order: the caller
	 * has already scrubbed+scanned; here we mint the token (gate), write, index, then trace. */
	private commitWrite(page: WikiPage, scan: ScanOutput, traceData: Record<string, unknown>): void {
		const token = ApprovedWrite.issue(page, scan);
		this.deps.repo.writePage(token);
		this.deps.index.upsertPage(token.page);
		this.deps.tracer.recordWikiTrace("wiki_write", { slug: page.slug, id: page.id, ...traceData });
	}
}
