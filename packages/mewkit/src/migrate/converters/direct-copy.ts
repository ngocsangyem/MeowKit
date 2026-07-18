// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/direct-copy.ts
// Adapted: replaced gray-matter.stringify fallback with raw body (we never re-stringify).
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { rewriteConfiguredModelReferences } from "../model-taxonomy.js";
import { rewriteSourceReferences, type ReferenceIntegrityIndex } from "../references/fence-aware-reference-rewriter.js";
import type { ReferenceOccurrence } from "../references/reference-types.js";
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";

export function convertDirectCopy(
	item: PortableItem,
	provider?: ProviderType,
	context?: { migratedRefs?: ReferenceIntegrityIndex | null },
): ConversionResult {
	let content: string;
	try {
		content = readFileSync(item.sourcePath, "utf-8");
	} catch {
		content = item.body;
	}

	const warnings: string[] = [];
	let occurrences: ReferenceOccurrence[] = [];
	if (provider && provider !== "claude-code") {
		// Source references are resolved through the rewrite table instead of a
		// blanket source-root → provider-dir replace, which fabricated paths that
		// do not exist on the target (runnable content is only rewritten with
		// proof that the referenced asset migrates too).
		const isMarkdown = extname(item.sourcePath).toLowerCase() === ".md";
		const rewritten = rewriteSourceReferences(content, {
			provider,
			file: item.name,
			migratedRefs: context?.migratedRefs,
			contentKind: isMarkdown ? "markdown" : "code",
		});
		content = rewritten.content;
		warnings.push(...rewritten.warnings);
		occurrences = rewritten.occurrences;
		content = rewriteConfiguredModelReferences(content, provider);
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
	return { content, filename, warnings, occurrences };
}
