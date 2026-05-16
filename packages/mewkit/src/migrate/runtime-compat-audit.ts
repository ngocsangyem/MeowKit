import type { PortableItem, PortableType, ProviderType } from "./types.js";

export interface RuntimeCompatAuditResult {
	errors: string[];
}

const CLAUDE_ONLY_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
	{ pattern: /\.claude\//i, message: "contains a .claude/ path reference" },
	{ pattern: /\bCLAUDE\.md\b/, message: "contains a CLAUDE.md reference" },
	{ pattern: /\$CLAUDE_[A-Z0-9_]+\b/, message: "contains a Claude-specific environment variable" },
	{ pattern: /\$ANTHROPIC_[A-Z0-9_]+\b/, message: "contains an Anthropic-specific environment variable" },
];

const AUDITED_TYPES = new Set<PortableType>(["agent", "command", "config", "rules", "hooks"]);

export function auditRuntimeCompatibility(
	content: string,
	item: Pick<PortableItem, "name" | "type">,
	targetProvider: ProviderType,
): RuntimeCompatAuditResult {
	if (targetProvider === "claude-code") return { errors: [] };
	if (!AUDITED_TYPES.has(item.type)) return { errors: [] };

	const errors: string[] = [];
	for (const rule of CLAUDE_ONLY_PATTERNS) {
		if (rule.pattern.test(content)) {
			errors.push(`${item.type}/${item.name} ${rule.message}`);
		}
	}

	return { errors };
}
