export type SuggestionKind =
	| "hook-test"
	| "review-promotion"
	| "policy"
	| "trace-hardening"
	| "regression-scenario"
	| "pack-pruning"
	| "memory-conflict"
	| "memory-archive";

export type EvidenceStatus = "available" | "insufficient" | "na";

export interface SuggestionEvidence {
	source: string;
	detail: string;
	count?: number;
	status?: EvidenceStatus;
}

export interface EvolutionSuggestion {
	kind: SuggestionKind;
	title: string;
	evidence: SuggestionEvidence[];
	confidence: number;
	impact: "low" | "medium" | "high";
	risk: "low" | "medium" | "high";
	proposedAction: string;
	neverAutoApply: true;
}

export function makeSuggestion(args: Omit<EvolutionSuggestion, "neverAutoApply">): EvolutionSuggestion {
	return { ...args, neverAutoApply: true };
}

export function filterSuggestions(
	suggestions: EvolutionSuggestion[],
	opts: { minConfidence?: number; kind?: string },
): EvolutionSuggestion[] {
	const min = opts.minConfidence ?? 0;
	return suggestions
		.filter((s) => s.confidence >= min)
		.filter((s) => !opts.kind || s.kind === opts.kind)
		.sort((a, b) => b.confidence - a.confidence || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}
