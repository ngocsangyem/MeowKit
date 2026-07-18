import { lookupProfile } from "../handoff/profiles.js";
import type { SkillHandoffProfile } from "../handoff/domain.js";
import { probeWiki, type WikiProbeDeps } from "./probe-wiki.js";
import { DEFAULT_RECALL_MAX_PAGES, type KnowledgeRecall, type RecallHit, type RecallStatus } from "./contract.js";

// Maps a selected capability id → a bounded knowledge-recall envelope. Composes the
// handoff registry's per-skill class (required | conditional | none) with the shared
// wiki probe. Non-printing, read-only, fail-open: recall never blocks selection and
// its status never flips a capability to unavailable. Bounds (≤3 snippets, no bodies)
// are enforced here, not trusted from callers.

export interface RecallDeps extends WikiProbeDeps {
	/** Path to the derived wiki-index DB (e.g. dbPath(claudeDir)). */
	dbFile: string;
}

/** A concrete follow-up signal for a `conditional` capability: what kind of task
 * warrants a manual `wiki context` probe. Derived from the profile — no automatic query. */
function conditionalHint(profile: SkillHandoffProfile): string {
	const scope = profile.defaultReuseScope || "project";
	return (
		`Recall available on demand for ${profile.profile} knowledge — run ` +
		`\`mewkit wiki context "<keywords>"\` only if this task references a known artifact ` +
		`(module, ticket, or prior report; reuse scope: ${scope}).`
	);
}

function envelope(
	status: RecallStatus,
	policy: KnowledgeRecall["policy"],
	hits: RecallHit[],
	meta: Partial<KnowledgeRecall["metadata"]> & { source: string; query: string },
): KnowledgeRecall {
	return {
		status,
		policy,
		hits,
		metadata: {
			policy,
			source: meta.source,
			query: meta.query,
			maxPages: DEFAULT_RECALL_MAX_PAGES,
			includeContent: false,
			...(meta.wikiPageCount !== undefined ? { wikiPageCount: meta.wikiPageCount } : {}),
			...(meta.conditionalHint !== undefined ? { conditionalHint: meta.conditionalHint } : {}),
		},
	};
}

/**
 * Compose bounded recall for a selected capability. Skill-kind capability ids equal
 * skill names, so `lookupProfile(id)` resolves directly; service/authored capabilities
 * are unregistered → `none` default (intentional — they carry no handoff profile).
 */
export function recallForCapability(capabilityId: string, intent: string, deps: RecallDeps): KnowledgeRecall {
	const profile = lookupProfile(capabilityId);
	const policy = profile.handoffClass;

	if (policy === "none") {
		return envelope("not-required", policy, [], { source: capabilityId, query: "" });
	}

	if (policy === "conditional") {
		return envelope("conditional", policy, [], {
			source: capabilityId,
			query: "",
			conditionalHint: conditionalHint(profile),
		});
	}

	// required: run exactly one bounded, read-only probe.
	const probe = probeWiki(deps.dbFile, intent, {
		maxPages: DEFAULT_RECALL_MAX_PAGES,
		includeContent: false,
		deps,
	});

	if (probe.status === "index-missing") {
		return envelope("index-missing", policy, [], { source: capabilityId, query: probe.query });
	}
	if (probe.status === "query-failed") {
		return envelope("query-failed", policy, [], { source: capabilityId, query: probe.query });
	}
	if (probe.status === "empty") {
		return envelope("empty", policy, [], {
			source: capabilityId,
			query: probe.query,
			wikiPageCount: probe.wikiPageCount ?? 0,
		});
	}

	const hits: RecallHit[] = probe.hits.slice(0, DEFAULT_RECALL_MAX_PAGES).map((h) => ({
		title: h.title,
		path: h.path ?? h.pagePath ?? "",
		snippet: h.snippet,
		tokenEstimate: h.tokenEstimate,
	}));
	return envelope("ready", policy, hits, { source: capabilityId, query: probe.query });
}
