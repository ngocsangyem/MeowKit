// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/index.ts
import type { ReferenceIntegrityIndex } from "../references/fence-aware-reference-rewriter.js";
import type { ConversionFormat, ConversionResult, PortableItem, ProviderType } from "../types.js";
import { convertCommandToCodexSkill } from "./command-to-codex-skill.js";
import { convertDirectCopy } from "./direct-copy.js";
import { convertFmToCodexToml } from "./fm-to-codex-toml.js";
import { convertFmToFm } from "./fm-to-fm.js";
import { convertMdStrip } from "./md-strip.js";
import { convertMdToMdc } from "./md-to-mdc.js";

export interface ConversionContext {
	/** Migration-set membership for the fenced-reference integrity check */
	migratedRefs?: ReferenceIntegrityIndex | null;
}

export function convertItem(
	item: PortableItem,
	format: ConversionFormat,
	provider: ProviderType,
	context?: ConversionContext,
): ConversionResult {
	try {
		switch (format) {
			case "direct-copy":
				return convertDirectCopy(item, provider, context);
			case "fm-to-fm":
				return convertFmToFm(item, provider);
			case "md-strip":
				return convertMdStrip(item, provider, context);
			case "md-to-mdc":
				return convertMdToMdc(item, provider);
			case "fm-to-codex-toml":
				return convertFmToCodexToml(item, context);
			case "command-to-codex-skill":
				return convertCommandToCodexSkill(item, context);
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
export type { HooksSection, HookGroup, HookEntry, PathRewriteMap } from "./claude-to-codex-hooks.js";
export { stripClaudeRefs, truncateAtCleanBoundary } from "./md-strip.js";
export { buildMergedAgentsMd } from "./fm-strip.js";
export { toCodexSlug, buildCodexConfigEntry, type CodexAgentToml, type CodexConfigEntry } from "./fm-to-codex-toml.js";
export { escapeTomlMultiline } from "./md-to-toml.js";
export {
	codexCommandSkillDirName,
	codexCommandSkillRelativePath,
	convertCommandToCodexSkill,
	detectDynamicCommandSyntax,
} from "./command-to-codex-skill.js";
