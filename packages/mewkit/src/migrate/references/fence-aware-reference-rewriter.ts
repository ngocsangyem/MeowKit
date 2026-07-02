// Fence-aware source-reference rewriter. Replaces the old binary rule
// ("fence = preserve everything" / "direct-copy = replace everything") with a
// span-based decision matrix:
//
//   span            mapped asset                  unmapped runtime      citation
//   prose/inline    rewrite to target             neutralize + record   preserve
//   frontmatter     rewrite to target             neutralize + record   preserve
//   fenced/code     rewrite ONLY when the asset   preserve + warn       preserve
//                   is in the migration set,
//                   else preserve + warn
//
// Runnable content is never given a fabricated path: a fenced reference is only
// rewritten when the referenced asset is provably part of the migration set.

import { buildMarkdownSpanMap } from "./reference-classifier.js";
import {
	SOURCE_ROOT,
	buildReferenceRewriteTable,
	resolveReferenceTarget,
	sourceConfigTokenPattern,
	sourceReferencePattern,
	type ReferenceRewriteRule,
	type ReferenceScope,
} from "./reference-target-registry.js";
import type { ReferenceOccurrence, ReferenceSpan } from "./reference-types.js";
import type { ProviderType } from "../types.js";

/** Membership test over the set of source assets included in the current migration */
export interface ReferenceIntegrityIndex {
	has(sourceRelativePath: string): boolean;
}

/**
 * Build an integrity index from source-relative entries. Entries ending with
 * "/" match as directory prefixes (e.g. ".claude/skills/demo-skill/").
 */
export function createReferenceIntegrityIndex(entries: Iterable<string>): ReferenceIntegrityIndex {
	const files = new Set<string>();
	const prefixes: string[] = [];
	for (const entry of entries) {
		const normalized = entry.replace(/\\/g, "/");
		if (normalized.endsWith("/")) prefixes.push(normalized.toLowerCase());
		else files.add(normalized.toLowerCase());
	}
	return {
		has(sourceRelativePath: string): boolean {
			const normalized = sourceRelativePath.replace(/\\/g, "/").toLowerCase();
			if (files.has(normalized)) return true;
			return prefixes.some((prefix) => normalized.startsWith(prefix));
		},
	};
}

export function combineIntegrityIndexes(
	...indexes: Array<ReferenceIntegrityIndex | null | undefined>
): ReferenceIntegrityIndex {
	const present = indexes.filter((index): index is ReferenceIntegrityIndex => Boolean(index));
	return { has: (path) => present.some((index) => index.has(path)) };
}

export interface SourceReferenceRewriteOptions {
	provider?: ProviderType;
	scope?: ReferenceScope;
	/** Filename recorded on occurrences (for report output) */
	file?: string;
	/** Migration-set membership; absent = unknown → fenced refs are preserved + warned */
	migratedRefs?: ReferenceIntegrityIndex | null;
	/** "code" treats the whole content as runnable (fenced semantics, no prose spans) */
	contentKind?: "markdown" | "code";
}

export interface SourceReferenceRewriteResult {
	content: string;
	occurrences: ReferenceOccurrence[];
	warnings: string[];
}

const TYPE_DIRS = ["agents", "commands", "skills", "rules", "hooks"] as const;

// Provider-neutral phrases used when a reference has no provider target.
const NEUTRAL_TYPE_PHRASE: Record<(typeof TYPE_DIRS)[number], string> = {
	rules: "project rules directory/",
	agents: "project subagents directory/",
	commands: "project commands directory/",
	skills: "project skills directory/",
	hooks: "project hooks directory/",
};
const NEUTRAL_ROOT_PHRASE = "project runtime data/";
const NEUTRAL_CONFIG_PHRASE = "project configuration file";

interface PathClassification {
	kind: "mapped-asset" | "unmapped-runtime";
	target: string | null;
	/** True when the target keeps the item suffix (directory-style target) */
	preservesSuffix: boolean;
	neutral: string;
	reason: string;
}

function classifySourcePath(path: string, table: ReferenceRewriteRule[]): PathClassification {
	const suffix = path.slice(SOURCE_ROOT.length);
	const typeDir = TYPE_DIRS.find((dir) => suffix.toLowerCase().startsWith(`${dir}/`));
	const target = resolveReferenceTarget(table, path);
	if (target !== null) {
		const rule = table.find((r) => path.toLowerCase().startsWith(r.sourcePrefix.toLowerCase()));
		return {
			kind: "mapped-asset",
			target,
			preservesSuffix: rule?.target?.isDirectory ?? false,
			neutral: "",
			reason: "",
		};
	}
	if (typeDir) {
		return {
			kind: "unmapped-runtime",
			target: null,
			preservesSuffix: false,
			neutral: `${NEUTRAL_TYPE_PHRASE[typeDir]}${suffix.slice(typeDir.length + 1)}`,
			reason: `provider has no ${typeDir} surface`,
		};
	}
	return {
		kind: "unmapped-runtime",
		target: null,
		preservesSuffix: false,
		neutral: `${NEUTRAL_ROOT_PHRASE}${suffix}`,
		reason: "no provider equivalent for this source runtime path",
	};
}

export function rewriteSourceReferences(
	content: string,
	options: SourceReferenceRewriteOptions,
): SourceReferenceRewriteResult {
	const table = buildReferenceRewriteTable(options.provider, options.scope ?? "project");
	const occurrences: ReferenceOccurrence[] = [];
	const warnings: string[] = [];
	const file = options.file ?? "";

	const record = (occurrence: ReferenceOccurrence): void => {
		occurrences.push(occurrence);
		if (occurrence.decision === "preserve-warn") {
			warnings.push(
				`Unresolved reference preserved (line ${occurrence.line}): "${occurrence.original}" — ${occurrence.reason}`,
			);
		}
	};

	// Each replace pass shifts byte offsets, so the span map is rebuilt per pass.
	const buildSpanHelpers = (input: string) => {
		const spanMap = options.contentKind === "code" ? null : buildMarkdownSpanMap(input);
		return {
			spanAt: (offset: number): ReferenceSpan => spanMap?.spanAt(offset) ?? "fenced",
			lineAt: (offset: number): number => {
				if (spanMap) return spanMap.lineNumberAt(offset);
				let line = 1;
				for (let i = 0; i < offset && i < input.length; i++) if (input[i] === "\n") line++;
				return line;
			},
			isCitationAt: (offset: number): boolean => spanMap?.isCitationAt(offset) ?? false,
		};
	};

	let { spanAt, lineAt, isCitationAt } = buildSpanHelpers(content);

	let result = content.replace(sourceReferencePattern(), (matched, ...args) => {
		const offset = args[args.length - 2] as number;
		const span = spanAt(offset);
		const line = lineAt(offset);
		const base = { file, line, span, original: matched };

		if (isCitationAt(offset)) {
			record({ ...base, kind: "citation", decision: "preserve" });
			return matched;
		}

		const classified = classifySourcePath(matched, table);
		const runnable = span === "fenced";

		if (!runnable) {
			if (classified.kind === "mapped-asset" && classified.target !== null) {
				record({ ...base, kind: "mapped-asset", decision: "rewrite", rewrittenTo: classified.target });
				return classified.target;
			}
			record({
				...base,
				kind: "unmapped-runtime",
				decision: "rewrite",
				rewrittenTo: classified.neutral,
				reason: `${classified.reason}; neutralized`,
			});
			return classified.neutral;
		}

		// Runnable content: rewrite only with proof the referenced asset migrates
		// too AND the target keeps the file suffix — a merged/non-directory target
		// cannot express the file's real location, so rewriting would fabricate.
		if (classified.kind === "mapped-asset" && classified.target !== null) {
			if (classified.preservesSuffix && options.migratedRefs?.has(matched)) {
				record({ ...base, kind: "mapped-asset", decision: "rewrite", rewrittenTo: classified.target });
				return classified.target;
			}
			record({
				...base,
				kind: "mapped-asset",
				decision: "preserve-warn",
				reason: classified.preservesSuffix
					? "referenced asset is not part of this migration; left unchanged instead of guessing a target path"
					: "target surface is merged/non-directory; original path preserved to avoid a fabricated location",
			});
			return matched;
		}
		record({ ...base, kind: "unmapped-runtime", decision: "preserve-warn", reason: classified.reason });
		return matched;
	});

	({ spanAt, lineAt, isCitationAt } = buildSpanHelpers(result));
	const configTarget = resolveReferenceTarget(table, "CLAUDE.md");
	const configReplacement = configTarget ?? NEUTRAL_CONFIG_PHRASE;
	result = result.replace(sourceConfigTokenPattern(), (matched, ...args) => {
		const offset = args[args.length - 2] as number;
		const span = spanAt(offset);
		const line = lineAt(offset);
		const base = { file, line, span, original: matched };

		if (isCitationAt(offset)) {
			record({ ...base, kind: "citation", decision: "preserve" });
			return matched;
		}
		if (span === "fenced") {
			// Command examples keep the literal token — a rename would break the example.
			record({ ...base, kind: "mapped-asset", decision: "preserve" });
			return matched;
		}
		record({ ...base, kind: "mapped-asset", decision: "rewrite", rewrittenTo: configReplacement });
		return configReplacement;
	});

	return { content: result, occurrences, warnings };
}
