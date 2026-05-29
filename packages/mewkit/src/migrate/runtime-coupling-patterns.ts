export interface RuntimeCouplingMatch {
	message: string;
}

export const RUNTIME_COUPLING_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
	{ pattern: /\.claude\//i, message: "contains a .claude/ path reference" },
	{ pattern: /\bCLAUDE\.md\b/, message: "contains a CLAUDE.md reference" },
	{ pattern: /\$CLAUDE_[A-Z0-9_]+\b/, message: "contains a Claude-specific environment variable" },
	{ pattern: /\$ANTHROPIC_[A-Z0-9_]+\b/, message: "contains an Anthropic-specific environment variable" },
	{ pattern: /\bnpx\s+claude\b/i, message: "contains a Claude Code command assumption" },
	{ pattern: /\bclaude\s+(?:--|mcp|doctor|update)\b/i, message: "contains a Claude Code command assumption" },
];

export function findRuntimeCouplingMatches(content: string): RuntimeCouplingMatch[] {
	const matches: RuntimeCouplingMatch[] = [];
	for (const rule of RUNTIME_COUPLING_PATTERNS) {
		if (rule.pattern.test(content)) matches.push({ message: rule.message });
	}
	return matches;
}
