// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/fm-to-fm.ts
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";

const COPILOT_TOOL_MAP: Record<string, string> = {
	Read: "read",
	Glob: "search",
	Grep: "search",
	Edit: "edit",
	Write: "edit",
	MultiEdit: "edit",
	Bash: "run_in_terminal",
	WebFetch: "fetch",
	WebSearch: "fetch",
};

function convertForCopilot(item: PortableItem): ConversionResult {
	const warnings: string[] = [];
	const fm: Record<string, unknown> = {};

	fm.name = item.frontmatter.name || item.name;
	if (item.description) fm.description = item.description;
	if (item.frontmatter.model) fm.model = item.frontmatter.model;

	if (item.frontmatter.tools) {
		const sourceTools = item.frontmatter.tools.split(",").map((t) => t.trim());
		const mappedTools = new Set<string>();
		for (const tool of sourceTools) {
			const mapped = COPILOT_TOOL_MAP[tool];
			if (mapped) mappedTools.add(mapped);
		}
		if (mappedTools.size > 0) fm.tools = Array.from(mappedTools);
	}

	const fmLines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		if (Array.isArray(value)) {
			fmLines.push(`${key}:`);
			for (const v of value) fmLines.push(`  - ${v}`);
		} else {
			fmLines.push(`${key}: ${JSON.stringify(value)}`);
		}
	}
	fmLines.push("---");

	const content = `${fmLines.join("\n")}\n\n${item.body}\n`;

	if (content.length > 30000) {
		warnings.push(`Content exceeds Copilot 30K char limit (${content.length} chars)`);
	}

	return { content, filename: `${item.name}.agent.md`, warnings };
}

function convertForCursor(item: PortableItem): ConversionResult {
	const fm: Record<string, unknown> = {};
	if (item.description) fm.description = item.description;
	fm.alwaysApply = false;

	const fmLines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		fmLines.push(`${key}: ${JSON.stringify(value)}`);
	}
	fmLines.push("---");

	const content = `${fmLines.join("\n")}\n\n${item.body}\n`;
	return { content, filename: `${item.name}.mdc`, warnings: [] };
}

const OPENCODE_TOOL_MAP: Record<string, string> = {
	Read: "read",
	Glob: "glob",
	Grep: "grep",
	Edit: "edit",
	Write: "write",
	MultiEdit: "patch",
	Bash: "bash",
	WebFetch: "webfetch",
	WebSearch: "websearch",
	NotebookEdit: "edit",
};

function replaceClaudePathsForOpenCode(content: string): string {
	return content.replace(/\.claude\//g, ".opencode/");
}

function convertOpenCodeAgent(item: PortableItem): ConversionResult {
	const agentName = item.frontmatter.name || item.name;
	const mode = agentName === "brainstormer" ? "primary" : "subagent";

	let toolsObj: Record<string, boolean> | null = null;
	if (item.frontmatter.tools) {
		const sourceTools = item.frontmatter.tools.split(",").map((t) => t.trim());
		const mapped = new Set<string>();
		for (const tool of sourceTools) {
			const key = OPENCODE_TOOL_MAP[tool];
			if (key) mapped.add(key);
		}
		if (mapped.size > 0) {
			toolsObj = {};
			for (const key of mapped) toolsObj[key] = true;
		}
	}

	const fmLines = ["---"];
	const desc = (item.description || `Agent: ${agentName}`).replace(/\n/g, " ").trim();
	const truncatedDesc = desc.length > 200 ? `${desc.slice(0, 197)}...` : desc;
	fmLines.push(`description: ${JSON.stringify(truncatedDesc)}`);
	fmLines.push(`mode: ${mode}`);

	if (toolsObj) {
		fmLines.push("tools:");
		for (const [key, val] of Object.entries(toolsObj)) {
			fmLines.push(`  ${key}: ${val}`);
		}
	}
	fmLines.push("---");

	const body = replaceClaudePathsForOpenCode(item.body);
	const content = `${fmLines.join("\n")}\n\n${body}\n`;
	return { content, filename: `${item.name}.md`, warnings: [] };
}

function convertOpenCodeCommand(item: PortableItem): ConversionResult {
	const fmLines = ["---"];
	const desc = (item.description || `Command: ${item.name}`).replace(/\n/g, " ").trim();
	const truncatedDesc = desc.length > 200 ? `${desc.slice(0, 197)}...` : desc;
	fmLines.push(`description: ${JSON.stringify(truncatedDesc)}`);

	if (item.frontmatter.agent) {
		fmLines.push(`agent: ${JSON.stringify(item.frontmatter.agent)}`);
	}
	fmLines.push("---");

	const body = replaceClaudePathsForOpenCode(item.body);
	const content = `${fmLines.join("\n")}\n\n${body}\n`;
	return { content, filename: `${item.name}.md`, warnings: [] };
}

export function convertFmToFm(item: PortableItem, provider: ProviderType): ConversionResult {
	switch (provider) {
		case "github-copilot":
			return convertForCopilot(item);
		case "cursor":
			return convertForCursor(item);
		case "opencode":
			if (item.type === "command") return convertOpenCodeCommand(item);
			return convertOpenCodeAgent(item);
		default:
			return {
				content: item.body,
				filename: `${item.name}.md`,
				warnings: [`No FM-to-FM converter for provider "${provider}", using body only`],
			};
	}
}
