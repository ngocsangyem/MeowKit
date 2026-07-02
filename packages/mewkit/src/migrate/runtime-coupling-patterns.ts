import { isExplainedReference } from "./validation/unresolved-reference-scanner.js";
import { sourceConfigTokenPattern, sourceReferencePattern } from "./references/reference-target-registry.js";
import type { ReferenceOccurrence } from "./references/reference-types.js";

export interface RuntimeCouplingMatch {
	message: string;
}

export const RUNTIME_COUPLING_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
	{ pattern: /\$CLAUDE_[A-Z0-9_]+\b/, message: "contains a Claude-specific environment variable" },
	{ pattern: /\$ANTHROPIC_[A-Z0-9_]+\b/, message: "contains an Anthropic-specific environment variable" },
	{ pattern: /\bnpx\s+claude\b/i, message: "contains a Claude Code command assumption" },
	{ pattern: /\bclaude\s+(?:--|mcp|doctor|update)\b/i, message: "contains a Claude Code command assumption" },
];

// Source references are only coupling errors when the fence-aware classifier
// did NOT deliberately decide to keep them (citation, fenced runtime command,
// merged/non-directory target). Unexplained ones still hard-fail.
const SOURCE_REFERENCE_CHECKS: Array<{ makePattern: () => RegExp; message: string }> = [
	{ makePattern: sourceReferencePattern, message: "contains a .claude/ path reference" },
	{ makePattern: sourceConfigTokenPattern, message: "contains a CLAUDE.md reference" },
];

export function findRuntimeCouplingMatches(
	content: string,
	occurrences: ReferenceOccurrence[] = [],
): RuntimeCouplingMatch[] {
	const matches: RuntimeCouplingMatch[] = [];
	for (const rule of RUNTIME_COUPLING_PATTERNS) {
		if (rule.pattern.test(content)) matches.push({ message: rule.message });
	}
	for (const check of SOURCE_REFERENCE_CHECKS) {
		for (const match of content.matchAll(check.makePattern())) {
			if (!isExplainedReference(match[0], occurrences)) {
				matches.push({ message: check.message });
				break;
			}
		}
	}
	return matches;
}
