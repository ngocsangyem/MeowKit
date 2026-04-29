// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/index.ts
import type { ConversionFormat, ConversionResult, PortableItem, ProviderType } from "../types.js";
import { convertDirectCopy } from "./direct-copy.js";
import { convertFmStrip } from "./fm-strip.js";
import { convertFmToCodexToml } from "./fm-to-codex-toml.js";
import { convertFmToFm } from "./fm-to-fm.js";
import { convertFmToJson } from "./fm-to-json.js";
import { convertFmToYaml } from "./fm-to-yaml.js";
import { convertMdStrip } from "./md-strip.js";
import { convertMdToKiroSteering } from "./md-to-kiro-steering.js";
import { convertMdToMdc } from "./md-to-mdc.js";
import { convertMdToToml } from "./md-to-toml.js";
import { convertToSkillMd } from "./skill-md.js";

export function convertItem(
	item: PortableItem,
	format: ConversionFormat,
	provider: ProviderType,
): ConversionResult {
	try {
		switch (format) {
			case "direct-copy":
				return convertDirectCopy(item, provider);
			case "fm-to-fm":
				return convertFmToFm(item, provider);
			case "fm-to-yaml":
				return convertFmToYaml(item);
			case "fm-strip":
				return convertFmStrip(item, provider);
			case "fm-to-json":
				return convertFmToJson(item);
			case "md-to-toml":
				return convertMdToToml(item);
			case "skill-md":
				return convertToSkillMd(item);
			case "md-strip":
				return convertMdStrip(item, provider);
			case "md-to-mdc":
				return convertMdToMdc(item, provider);
			case "md-to-kiro-steering":
				return convertMdToKiroSteering(item, provider);
			case "fm-to-codex-toml":
				return convertFmToCodexToml(item);
			default: {
				const _exhaustive: never = format;
				return {
					content: item.body,
					filename: `${item.name}.md`,
					warnings: [`Unknown format: ${_exhaustive}`],
				};
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown conversion error";
		return {
			content: "",
			filename: `${item.name}.md`,
			warnings: [`Conversion failed for ${item.name} (format: ${format}): ${message}`],
			error: message,
		};
	}
}

// Re-exports for direct converter access (used by hook mergers in Phase 8)
export { convertClaudeHooksToCodex, rewriteCommandPath } from "./claude-to-codex-hooks.js";
export { mapEventName, rewriteMatcherToolNames, requiresHookMapping } from "./gemini-hook-event-map.js";
export type { HooksSection, HookGroup, HookEntry, PathRewriteMap } from "./claude-to-codex-hooks.js";
export { stripClaudeRefs, truncateAtCleanBoundary } from "./md-strip.js";
export { buildMergedAgentsMd } from "./fm-strip.js";
export { buildYamlModesFile } from "./fm-to-yaml.js";
export { buildClineModesJson, convertToClineRule, type ClineCustomMode } from "./fm-to-json.js";
export { toCodexSlug, buildCodexConfigEntry, type CodexAgentToml, type CodexConfigEntry } from "./fm-to-codex-toml.js";
export { escapeTomlMultiline } from "./md-to-toml.js";
