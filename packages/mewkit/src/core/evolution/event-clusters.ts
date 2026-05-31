import type { EventRecord } from "../event-log.js";
import { clusterReviewFailures } from "./review-failure-clusters.js";
import { makeSuggestion, type EvolutionSuggestion } from "./suggestions.js";

function str(value: unknown, fallback = "unknown"): string {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function bump(map: Map<string, number>, key: string): void {
	map.set(key, (map.get(key) ?? 0) + 1);
}

function repeated(map: Map<string, number>, min = 2): Array<[string, number]> {
	return [...map.entries()].filter(([, count]) => count >= min).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function suggestionsFromEvents(events: EventRecord[], malformed: number): EvolutionSuggestion[] {
	const suggestions: EvolutionSuggestion[] = [];
	const hookFailures = new Map<string, number>();
	const gateBlocks = new Map<string, number>();

	for (const event of events) {
		if (event.event === "hook.failed") {
			bump(hookFailures, `${str(event.data.hook)} exit ${str(event.data.exit_code, "?")}`);
		}
		if (event.event === "gate.blocked") {
			bump(gateBlocks, `${str(event.data.gate)}: ${str(event.data.reason, "")}`);
		}
		if (event.event === "dead_weight_audit_needed") {
			suggestions.push(makeSuggestion({
				kind: "pack-pruning",
				title: "Run a dead-weight audit",
				evidence: [{ source: "event-log", detail: "dead_weight_audit_needed event observed", count: 1 }],
				confidence: 0.72,
				impact: "medium",
				risk: "low",
				proposedAction: "Run `mewkit evolve report` and review pack/skill pruning candidates.",
			}));
		}
	}

	for (const [label, count] of repeated(hookFailures)) {
		suggestions.push(makeSuggestion({
			kind: "hook-test",
			title: `Add regression coverage for ${label}`,
			evidence: [{ source: "event-log", detail: label, count }],
			confidence: Math.min(0.95, 0.55 + count * 0.1),
			impact: "high",
			risk: "low",
			proposedAction: "Add or extend a `mewkit simulate` scenario and a configured-hook regression test.",
		}));
	}

	for (const [label, count] of repeated(gateBlocks, 3)) {
		suggestions.push(makeSuggestion({
			kind: "policy",
			title: `Review gate policy for repeated ${label}`,
			evidence: [{ source: "event-log", detail: label, count }],
			confidence: Math.min(0.9, 0.45 + count * 0.08),
			impact: "medium",
			risk: "medium",
			proposedAction: "Run `mewkit policy explain`; consider a clearer policy profile or docs clarification.",
		}));
	}

	for (const cluster of clusterReviewFailures(events)) {
		const diversity = cluster.tasks.length > 1 ? " across multiple tasks" : "";
		suggestions.push(makeSuggestion({
			kind: "review-promotion",
			title: `Promote repeated review failure: ${cluster.key}`,
			evidence: [{ source: "verdict_written", detail: `${cluster.count} failure(s)${diversity}`, count: cluster.count }],
			confidence: Math.min(0.92, 0.5 + cluster.count * 0.12 + (cluster.tasks.length > 1 ? 0.1 : 0)),
			impact: "high",
			risk: "medium",
			proposedAction: "Generate a candidate checklist/rule via `mewkit memory promote --review-failures`.",
		}));
	}

	if (malformed > 0) {
		suggestions.push(makeSuggestion({
			kind: "trace-hardening",
			title: "Harden trace writer or reader against malformed rows",
			evidence: [{ source: "event-log", detail: "malformed or oversized rows skipped", count: malformed }],
			confidence: Math.min(0.9, 0.5 + malformed * 0.05),
			impact: "medium",
			risk: "low",
			proposedAction: "Add an emitter-output JSON validity test and inspect trace append paths.",
		}));
	}

	return suggestions;
}
