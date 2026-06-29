import { makeWikiPageId } from "../domain/index.js";
import type { DupCheck, SalienceComponents, WikiSeed, WikiSlug, WikiSource, WikiWriteDecision } from "../domain/index.js";
import type { Fetcher, ProposeInput, ProposeResult, WikiIndex } from "./ports.js";

// runResearchStep: seed → fetch (DATA) → novelty (FTS dup) → proposeCandidate ONLY. Fetched
// content NEVER calls writePage/approveCandidate — the canonical write still needs a separate
// human approve step. The injection scan + secret scrub run inside proposeCandidate
// (the scan gate); a poisoned fetch is therefore quarantined there, producing zero candidates.
// Fetched content is tagged origin "agent" — the most-restricted origin (cannot self-commit).

export interface ResearchContext {
	fetcher: Fetcher;
	index: Pick<WikiIndex, "searchFts">;
	propose: (input: ProposeInput) => ProposeResult;
	appendSource: (slug: WikiSlug, source: WikiSource) => void;
	trace: (event: string, data: Record<string, unknown>) => void;
}

export interface ResearchOutcome {
	decision: WikiWriteDecision["kind"];
	candidateId?: string;
	sourceUrl: string;
}

function titleFor(seed: WikiSeed, content: string): string {
	const firstLine = content
		.split("\n")
		.map((l) => l.replace(/^#+\s*/, "").trim())
		.find((l) => l.length > 0);
	return (firstLine ?? seed.query).slice(0, 80);
}

function salienceFor(seed: WikiSeed, novel: boolean): SalienceComponents {
	const sourceQuality = seed.kind === "arxiv" || seed.kind === "github" ? 2 : 1;
	return {
		explicit_user_intent: 2, // the seed was enqueued — explicit intent to research this
		verified_outcome: 0, // fetched content is unverified until a human approves
		recurrence_or_friction: 0,
		novelty_vs_existing_wiki: novel ? 2 : 0,
		future_reuse_likelihood: 2,
		source_quality: sourceQuality,
		blast_radius: 1,
		security_risk_penalty: 0,
		staleness_penalty: 0,
	};
}

function computeDup(index: Pick<WikiIndex, "searchFts">, title: string): DupCheck {
	const hits = index.searchFts(title, 3);
	const match = hits.find((h) => h.title.toLowerCase() === title.toLowerCase());
	return match ? { isHighDuplicate: true, existingPageId: makeWikiPageId(match.pageId) } : { isHighDuplicate: false };
}

export async function runResearchStep(ctx: ResearchContext, slug: WikiSlug, seed: WikiSeed): Promise<ResearchOutcome> {
	const doc = await ctx.fetcher.fetch(seed); // url-guard + size-cap + redirect re-validation enforced in the fetcher
	ctx.appendSource(slug, doc.source);
	const title = titleFor(seed, doc.content);
	const dup = computeDup(ctx.index, title);
	const result = ctx.propose({
		slug,
		title,
		content: doc.content,
		origin: "agent",
		whySave: "research:" + seed.kind,
		evidence: doc.sourceUrl,
		sourceIds: [doc.source.id],
		salience: salienceFor(seed, !dup.isHighDuplicate),
		sourceUrl: doc.sourceUrl,
		dup,
	});
	ctx.trace("wiki_research_step", { slug, kind: seed.kind, url: doc.sourceUrl, decision: result.decision.kind });
	return { decision: result.decision.kind, candidateId: result.candidate?.id, sourceUrl: doc.sourceUrl };
}
