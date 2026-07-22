// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/fm-to-fm.ts
import { providers } from "../provider-registry.js";
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

function convertForCursor(item: PortableItem): ConversionResult {
	const fm: Record<string, unknown> = {};
	if (item.description) fm.description = item.description;
	fm.alwaysApply = false;

	const fmLines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		fmLines.push(`${key}: ${JSON.stringify(value)}`);
	}
	fmLines.push("---");

	const stripped = stripClaudeRefs(item.body, { provider: "cursor", targetName: providers.cursor.displayName });
	const content = `${fmLines.join("\n")}\n\n${stripped.content}\n`;
	return { content, filename: `${item.name}.mdc`, warnings: stripped.warnings, occurrences: stripped.occurrences };
}

export function convertFmToFm(item: PortableItem, provider: ProviderType): ConversionResult {
	switch (provider) {
		case "cursor":
			return convertForCursor(item);
		default:
			return {
				content: item.body,
				filename: `${item.name}.md`,
				warnings: [`No FM-to-FM converter for provider "${provider}", using body only`],
			};
	}
}
