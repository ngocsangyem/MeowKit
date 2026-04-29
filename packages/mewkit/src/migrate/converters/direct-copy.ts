// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/direct-copy.ts
// Adapted: replaced gray-matter.stringify fallback with raw body (we never re-stringify).
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";

const PROVIDER_CONFIG_DIR: Partial<Record<ProviderType, string>> = {
	opencode: ".opencode/",
	droid: ".factory/",
	windsurf: ".windsurf/",
	antigravity: ".agent/",
	cursor: ".cursor/",
	roo: ".roo/",
	kilo: ".kilocode/",
	goose: ".goose/",
	"gemini-cli": ".gemini/",
	amp: ".agents/",
	cline: ".cline/",
	openhands: ".openhands/",
	codex: ".codex/",
	"github-copilot": ".github/",
};

export function convertDirectCopy(item: PortableItem, provider?: ProviderType): ConversionResult {
	let content: string;
	try {
		content = readFileSync(item.sourcePath, "utf-8");
	} catch {
		content = item.body;
	}

	if (provider && provider !== "claude-code") {
		const targetDir = PROVIDER_CONFIG_DIR[provider];
		if (targetDir) {
			content = content.replace(/\.claude\//g, targetDir);
		}
	}

	const namespacedName =
		item.name.includes("/") || item.name.includes("\\")
			? item.name.replace(/\\/g, "/")
			: item.segments && item.segments.length > 0
				? item.segments.join("/")
				: item.name;
	const sourceExtension = extname(item.sourcePath);
	let filename: string;
	if (sourceExtension) {
		filename = namespacedName.toLowerCase().endsWith(sourceExtension.toLowerCase())
			? namespacedName
			: `${namespacedName}${sourceExtension}`;
	} else {
		filename = namespacedName.includes(".") ? namespacedName : `${namespacedName}.md`;
	}
	return { content, filename, warnings: [] };
}
