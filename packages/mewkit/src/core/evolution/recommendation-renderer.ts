import pc from "picocolors";
import type { EvolutionSuggestion } from "./suggestions.js";

function pct(n: number): string {
	return `${Math.round(n * 100)}%`;
}

export function renderSuggestions(suggestions: EvolutionSuggestion[]): void {
	console.log(pc.bold(pc.cyan("MeowKit evolve — proposal-only suggestions")));
	console.log(pc.dim("No rules, skills, hooks, packs, or policies were changed."));
	console.log();
	if (suggestions.length === 0) {
		console.log(pc.yellow("No suggestions met the evidence threshold."));
		return;
	}
	for (const [i, suggestion] of suggestions.entries()) {
		console.log(`${pc.bold(`${i + 1}. ${suggestion.title}`)} ${pc.dim(`[${suggestion.kind}]`)}`);
		console.log(`   confidence ${pc.cyan(pct(suggestion.confidence))} · impact ${suggestion.impact} · risk ${suggestion.risk}`);
		for (const evidence of suggestion.evidence) {
			const count = evidence.count === undefined ? "" : ` (${evidence.count})`;
			console.log(`   - ${evidence.source}: ${evidence.detail}${count}`);
		}
		console.log(`   proposed: ${suggestion.proposedAction}`);
		console.log();
	}
}
