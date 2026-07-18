import type { HostResolveResult } from "../../core/resolve-capabilities.js";
import { recallForCapability, type RecallDeps } from "./recall-for-capability.js";
import type { KnowledgeRecall, ResolveWithRecall } from "./contract.js";

// The command-layer composition gate. Recall is attached ONLY when the resolver
// actually selected a capability — `ambiguous`/`unavailable`/`unsupported` and the
// empty-candidate case attach nothing (no query, no index access). The pure core
// resolver never imports this; the command layer wires it after `resolveWithHost`.

/**
 * Attach a bounded recall envelope to a `selected` resolve result. For every other
 * status the result passes through unchanged (no `knowledgeRecall` field), so
 * non-selection performs zero automatic wiki access.
 */
export function attachRecall(result: HostResolveResult, intent: string, deps: RecallDeps): ResolveWithRecall {
	if (result.status !== "selected") return result;
	const top = result.candidates[0];
	if (!top) return result;
	return { ...result, knowledgeRecall: recallForCapability(top.id, intent, deps) };
}

/**
 * The opt-in `--record` decision event. Carries COUNTS and status only — never a
 * snippet, path, or page body — so telemetry never leaks recalled content. Written
 * through the existing `TraceAdapter.recordWikiTrace` (schema_version rides on the adapter).
 */
export function recallDecisionEvent(recall: KnowledgeRecall): { event: string; data: Record<string, unknown> } {
	const tokenEstimate = recall.hits.reduce((n, h) => n + h.tokenEstimate, 0);
	return {
		event: "capability-recall-decision",
		data: {
			capabilityId: recall.metadata.source,
			policy: recall.policy,
			status: recall.status,
			hitCount: recall.hits.length,
			tokenEstimate,
		},
	};
}
