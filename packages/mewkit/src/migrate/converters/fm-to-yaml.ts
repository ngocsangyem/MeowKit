// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/fm-to-yaml.ts
import type { ConversionResult, PortableItem } from "../types.js";

const TOOL_GROUP_MAP: Record<string, string> = {
	Read: "read",
	Glob: "read",
	Grep: "read",
	Edit: "edit",
	Write: "edit",
	MultiEdit: "edit",
	Bash: "command",
	WebFetch: "browser",
	WebSearch: "browser",
};

function mapToolsToGroups(toolsStr: string): string[] {
	const tools = toolsStr.split(",").map((t) => t.trim());
	const groups = new Set<string>();
	for (const tool of tools) {
		const group = TOOL_GROUP_MAP[tool];
		if (group) groups.add(group);
	}
	if (groups.size > 0) groups.add("mcp");
	return Array.from(groups);
}

function toSlug(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function yamlEscape(str: string): string {
	return str
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
}

export function convertFmToYaml(item: PortableItem): ConversionResult {
	const slug = toSlug(item.name);
	const displayName = item.frontmatter.name || item.name;
	const description = item.description || "";
	const groups = item.frontmatter.tools
		? mapToolsToGroups(item.frontmatter.tools)
		: ["read", "edit", "command", "browser", "mcp"];

	const lines: string[] = [];
	lines.push(`  - slug: "${slug}"`);
	lines.push(`    name: "${yamlEscape(displayName)}"`);
	if (description) lines.push(`    description: "${yamlEscape(description.slice(0, 200))}"`);
	lines.push("    roleDefinition: |");
	for (const line of item.body.split("\n")) lines.push(`      ${line}`);
	lines.push('    customInstructions: ""');
	lines.push("    groups:");
	for (const group of groups) lines.push(`      - ${group}`);

	return { content: lines.join("\n"), filename: slug, warnings: [] };
}

export function buildYamlModesFile(convertedEntries: string[]): string {
	const lines = ["customModes:"];
	for (const entry of convertedEntries) lines.push(entry);
	return `${lines.join("\n")}\n`;
}
