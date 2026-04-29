// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/md-to-mdc.ts
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

export function convertMdToMdc(item: PortableItem, provider: ProviderType): ConversionResult {
	const stripped = stripClaudeRefs(item.body, { provider });
	const description = item.description || formatDescription(item.name);
	const escapedDesc = description.replace(/"/g, '\\"');

	const content = [
		"---",
		`description: "${escapedDesc}"`,
		"alwaysApply: true",
		"---",
		"",
		stripped.content,
	].join("\n");

	return { content, filename: `${item.name}.mdc`, warnings: stripped.warnings };
}

function formatDescription(name: string): string {
	return `${name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} rules`;
}
