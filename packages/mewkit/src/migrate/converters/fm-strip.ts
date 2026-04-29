// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/fm-strip.ts
// TODO(phase-9): truncation uses UTF-16 code units; emojis at boundary may produce malformed surrogates.
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

const PROVIDERS_WITH_BODY_REWRITING: ProviderType[] = ["gemini-cli"];

export function convertFmStrip(item: PortableItem, provider: ProviderType): ConversionResult {
	const warnings: string[] = [];
	const heading = item.frontmatter.name || item.name;
	const isMergeProvider = ["goose", "gemini-cli", "amp"].includes(provider);

	let body = item.body;
	if (PROVIDERS_WITH_BODY_REWRITING.includes(provider)) {
		const stripped = stripClaudeRefs(body, { provider });
		body = stripped.content;
		warnings.push(...stripped.warnings);
	}

	let content: string;
	if (isMergeProvider) {
		content = `## Agent: ${heading}\n\n${body}\n`;
	} else {
		content = `# ${heading}\n\n${body}\n`;
	}

	if (provider === "windsurf" && content.length > 12000) {
		const originalLen = content.length;
		const truncated = content.slice(0, 11950);
		content = `${truncated}\n\n[truncated — original ${originalLen} chars exceeded 12K limit]\n`;
		warnings.push(`Content truncated from ${originalLen} to 12K chars for Windsurf`);
	}

	return {
		content,
		filename: isMergeProvider ? "AGENTS.md" : `${item.name}.md`,
		warnings,
	};
}

export function buildMergedAgentsMd(sections: string[], providerName: string): string {
	const header = `# Agents\n\n> Ported from MeowKit agents via mewkit migrate\n> Target: ${providerName}\n\n`;
	return header + sections.join("\n---\n\n");
}
