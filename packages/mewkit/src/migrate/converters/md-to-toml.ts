// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/md-to-toml.ts
import { providers } from "../provider-registry.js";
import type { ConversionResult, PortableItem } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

export function escapeTomlMultiline(str: string): string {
	let escaped = str.replace(/\\/g, "\\\\");
	escaped = escaped.replace(/"""/g, '""\\"');
	if (escaped.endsWith('"')) escaped += "\n";
	return escaped;
}

function mapPlaceholders(body: string): string {
	return body.replace(/\$ARGUMENTS/g, "{{args}}");
}

export function convertMdToToml(item: PortableItem): ConversionResult {
	const description = item.description || item.frontmatter.description || "";
	const stripped = stripClaudeRefs(item.body, {
		provider: "gemini-cli",
		targetName: providers["gemini-cli"].displayName,
	});
	const prompt = mapPlaceholders(stripped.content);

	const lines: string[] = [];
	if (description) lines.push(`description = ${JSON.stringify(description)}`);
	lines.push(`prompt = """\n${escapeTomlMultiline(prompt)}\n"""`);

	const namespacedName =
		item.name.includes("/") || item.name.includes("\\")
			? item.name.replace(/\\/g, "/")
			: item.segments && item.segments.length > 0
				? item.segments.join("/")
				: item.name;

	return { content: lines.join("\n"), filename: `${namespacedName}.toml`, warnings: stripped.warnings, occurrences: stripped.occurrences };
}
