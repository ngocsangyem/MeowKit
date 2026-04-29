// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/fm-to-json.ts
import type { ConversionResult, PortableItem } from "../types.js";

const CLINE_GROUP_MAP: Record<string, string> = {
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
		const group = CLINE_GROUP_MAP[tool];
		if (group) groups.add(group);
	}
	if (groups.size > 0) groups.add("mcp");
	return Array.from(groups);
}

function toSlug(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface ClineCustomMode {
	slug: string;
	name: string;
	roleDefinition: string;
	groups: string[];
	customInstructions: string;
}

export function convertFmToJson(item: PortableItem): ConversionResult {
	const mode: ClineCustomMode = {
		slug: toSlug(item.name),
		name: item.frontmatter.name || item.name,
		roleDefinition: item.body,
		groups: item.frontmatter.tools
			? mapToolsToGroups(item.frontmatter.tools)
			: ["read", "edit", "command", "mcp"],
		customInstructions: "",
	};

	return {
		content: JSON.stringify(mode, null, 2),
		filename: `${toSlug(item.name)}.json`,
		warnings: [],
	};
}

export function buildClineModesJson(modes: ClineCustomMode[]): string {
	return JSON.stringify({ customModes: modes }, null, 2);
}

export function convertToClineRule(item: PortableItem): ConversionResult {
	const content = `# ${item.frontmatter.name || item.name}\n\n${item.body}\n`;
	const namespacedName =
		item.name.includes("/") || item.name.includes("\\")
			? item.name.replace(/\\/g, "/")
			: item.segments && item.segments.length > 0
				? item.segments.join("/")
				: item.name;
	return { content, filename: `${namespacedName}.md`, warnings: [] };
}
