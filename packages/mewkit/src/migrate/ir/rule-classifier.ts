import type { PortableItem } from "../types.js";
import type { RuleSemanticKind } from "./types.js";

export interface ClassifiedRule {
	kind: RuleSemanticKind;
	signals: string[];
}

interface RuleSignal {
	kind: RuleSemanticKind;
	label: string;
	pattern: RegExp;
}

const RULE_SIGNALS: RuleSignal[] = [
	{ kind: "orchestration", label: "phase workflow", pattern: /\bPhase\s+[0-9]+\b/i },
	{ kind: "orchestration", label: "gate workflow", pattern: /\bGate\s+[0-9]+\b/i },
	{ kind: "orchestration", label: "orchestrator role", pattern: /\borchestrator\b/i },
	{
		kind: "runtime-automation",
		label: "Claude hook lifecycle",
		pattern: /\bPreToolUse|PostToolUse|SessionStart|Stop\b/,
	},
	{ kind: "runtime-automation", label: "Claude settings hook path", pattern: /\.claude\/hooks\//i },
	{ kind: "runtime-automation", label: "Claude runtime variable", pattern: /\$CLAUDE_[A-Z0-9_]+\b/ },
	{ kind: "memory-policy", label: "Claude memory path", pattern: /\.claude\/memory\//i },
	{ kind: "memory-policy", label: "memory ledger", pattern: /\bcost-log|memory\b/i },
	{
		kind: "procedure",
		label: "stepwise procedure",
		pattern: /^\s*(?:#{1,6}\s*)?(?:Steps?|Procedure|Checklist|Workflow)\b/im,
	},
	{ kind: "procedure", label: "ordered steps", pattern: /^\s*1\.\s+/m },
];

export function classifyRuleSemantic(item: Pick<PortableItem, "name" | "body" | "sourcePath">): ClassifiedRule {
	const signals = RULE_SIGNALS.filter((signal) =>
		signal.pattern.test(`${item.name}\n${item.sourcePath}\n${item.body}`),
	);

	for (const kind of [
		"orchestration",
		"runtime-automation",
		"memory-policy",
		"procedure",
	] satisfies RuleSemanticKind[]) {
		const matching = signals.filter((signal) => signal.kind === kind);
		if (matching.length > 0) {
			return { kind, signals: matching.map((signal) => signal.label) };
		}
	}

	return { kind: "policy", signals: [] };
}
