// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/index.ts
import type { ReferenceIntegrityIndex } from "../references/fence-aware-reference-rewriter.js";
import type { ConversionFormat, ConversionResult, PortableItem, ProviderType } from "../types.js";
import { convertDirectCopy } from "./direct-copy.js";
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

// Re-exports for direct converter access
export { stripClaudeRefs, truncateAtCleanBoundary } from "./md-strip.js";
export { buildMergedAgentsMd } from "./fm-strip.js";
