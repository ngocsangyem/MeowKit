// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/md-strip.ts
// MewKit additions: mewkit/meowkit CLI command rewrites; /meow: + /mk: slash refs
// already covered by the existing slash-command regex (matches /[a-z][a-z0-9/._:-]+).

import { providers } from "../provider-registry.js";
import { rewriteSourceReferences, type ReferenceIntegrityIndex } from "../references/fence-aware-reference-rewriter.js";
import { getReferenceTarget, sourceHooksLinePattern } from "../references/reference-target-registry.js";
import type { ReferenceOccurrence } from "../references/reference-types.js";
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";

const MAX_CONTENT_SIZE = 512_000;

export interface MdStripOptions {
	provider: ProviderType;
	charLimit?: number;
	targetName?: string;
	/** Filename recorded on reference occurrences */
	file?: string;
	/** Migration-set membership for the fenced-reference integrity check */
	migratedRefs?: ReferenceIntegrityIndex | null;
}

// Lines matching these markers are excluded from narrative-brand substitution.
// Preserves research citations ("Anthropic harness research", "dead-weight thesis").
// NOTE: "field report" is intentionally NOT a citation keyword — the rewrite regex
// `per Anthropic('s)? field report` rewrites that phrase as a non-citation appeal.
const CITATION_KEYWORDS = /\bresearch\b|\bthesis\b/i;
const CITATION_MARKER = /<!--\s*research-citation\s*-->/;
const BLOCKQUOTE_LINE = /^\s*>/;
const CITATION_WINDOW = 2;

function buildCitationLineSet(content: string): Set<number> {
	const lines = content.split("\n");
	const citationLines = new Set<number>();
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const isCitation =
			CITATION_MARKER.test(line) ||
			CITATION_KEYWORDS.test(line) ||
			(BLOCKQUOTE_LINE.test(line) && /Anthropic/.test(line));
		if (isCitation) {
			for (let j = Math.max(0, i - CITATION_WINDOW); j <= Math.min(lines.length - 1, i + CITATION_WINDOW); j++) {
				citationLines.add(j);
			}
		}
	}
	return citationLines;
}

function buildLineOffsetMap(content: string): number[] {
	// Returns a sorted array of byte offsets where each line starts (line 0 starts at 0).
	const starts: number[] = [0];
	for (let i = 0; i < content.length; i++) {
		if (content[i] === "\n") starts.push(i + 1);
	}
	return starts;
}

function lineIndexAtOffset(lineStarts: number[], offset: number): number {
	// Binary search for the line that contains `offset`.
	let lo = 0;
	let hi = lineStarts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (lineStarts[mid] <= offset) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

interface TruncationResult {
	result: string;
	originalLength: number;
	removedSections: string[];
}

export function truncateAtCleanBoundary(content: string, limit: number): TruncationResult {
	const originalLength = content.length;
	if (limit <= 0) return { result: "", originalLength, removedSections: [] };
	if (content.length <= limit) return { result: content, originalLength, removedSections: [] };

	const sectionRegex = /^(#{2,3})\s+(.+)$/gm;
	const sectionStarts: Array<{ index: number; title: string }> = [];
	for (const match of content.matchAll(sectionRegex)) {
		if (match.index !== undefined) {
			sectionStarts.push({ index: match.index, title: match[2].trim() });
		}
	}

	if (sectionStarts.length === 0) {
		return truncateAtParagraphBoundary(content, limit, originalLength);
	}

	const sections: Array<{ title: string; start: number; end: number }> = [];
	for (let i = 0; i < sectionStarts.length; i++) {
		const start = sectionStarts[i].index;
		const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].index : content.length;
		sections.push({ title: sectionStarts[i].title, start, end });
	}

	const preamble = content.slice(0, sections[0]?.start ?? content.length);
	const removedSections: string[] = [];
	const keptSections = [...sections];

	while (keptSections.length > 0) {
		const candidate = preamble + keptSections.map((s) => content.slice(s.start, s.end)).join("");
		if (candidate.trim().length <= limit) {
			return { result: candidate.trim(), originalLength, removedSections };
		}
		const removed = keptSections.pop();
		if (removed) removedSections.push(removed.title);
	}

	if (preamble.trim().length > limit) {
		return truncateAtParagraphBoundary(preamble, limit, originalLength);
	}
	return { result: preamble.trim(), originalLength, removedSections };
}

function truncateAtParagraphBoundary(content: string, limit: number, originalLength: number): TruncationResult {
	const truncated = content.slice(0, limit);
	const lastParagraphBreak = truncated.lastIndexOf("\n\n");
	if (lastParagraphBreak >= limit * 0.5) {
		return {
			result: truncated.slice(0, lastParagraphBreak).trimEnd(),
			originalLength,
			removedSections: [],
		};
	}
	const lastNewline = truncated.lastIndexOf("\n");
	if (lastNewline >= limit * 0.3) {
		return { result: truncated.slice(0, lastNewline).trimEnd(), originalLength, removedSections: [] };
	}
	return { result: truncated.trimEnd(), originalLength, removedSections: [] };
}

export function stripClaudeRefs(
	content: string,
	options?: MdStripOptions,
): { content: string; warnings: string[]; removedSections: string[]; occurrences: ReferenceOccurrence[] } {
	const warnings: string[] = [];
	const removedSections: string[] = [];
	const occurrences: ReferenceOccurrence[] = [];
	let result = content;

	if (content.length > MAX_CONTENT_SIZE) {
		warnings.push(`Content exceeds ${MAX_CONTENT_SIZE} chars; stripping skipped for safety`);
		return { content, warnings, removedSections: [], occurrences };
	}

	const codeBlockRanges: Array<[number, number]> = [];
	for (const match of content.matchAll(/```[\s\S]*?```/g)) {
		if (match.index !== undefined) {
			codeBlockRanges.push([match.index, match.index + match[0].length]);
		}
	}

	const isInCodeBlock = (pos: number): boolean => {
		return codeBlockRanges.some(([start, end]) => pos >= start && pos < end);
	};

	const toolReplacements: Array<[RegExp, string]> = [
		[/\b(the\s+)?Read\s+tool\b/gi, "file reading"],
		[/\buse\s+Read\b/gi, "use file reading"],
		[/\b(the\s+)?Write\s+tool\b/gi, "file writing"],
		[/\buse\s+Write\b/gi, "use file writing"],
		[/\b(the\s+)?Edit\s+tool\b/gi, "file editing"],
		[/\buse\s+Edit\b/gi, "use file editing"],
		[/\b(the\s+)?Bash\s+tool\b/gi, "terminal/shell"],
		[/\buse\s+Bash\b/gi, "use terminal/shell"],
		[/\b(the\s+)?Grep\s+tool\b/gi, "code search"],
		[/\buse\s+Grep\b/gi, "use code search"],
		[/\b(the\s+)?Glob\s+tool\b/gi, "file search"],
		[/\buse\s+Glob\b/gi, "use file search"],
		[/\b(the\s+)?Task\s+tool\b/gi, "subtask delegation"],
		[/\buse\s+Task\b/gi, "use subtask delegation"],
		[/\bWebFetch\b/g, "web access"],
		[/\bWebSearch\b/g, "web access"],
		[/\bNotebookEdit\b/g, "notebook editing"],
	];

	// MewKit additions: rewrite mewkit/meowkit CLI verbs to provider-neutral phrasing.
	const mewkitCliReplacements: Array<[RegExp, string]> = [
		[/\b(?:npx\s+)?mewkit\s+init\b/gi, "scaffold the kit"],
		[/\b(?:npx\s+)?mewkit\s+migrate\b/gi, "migrate the kit"],
		[/\b(?:npx\s+)?mewkit\s+upgrade\b/gi, "upgrade the kit"],
		[/\b(?:npx\s+)?mewkit\s+doctor\b/gi, "kit diagnostic"],
		[/\b(?:npx\s+)?mewkit\s+setup\b/gi, "kit setup"],
		[/\b(?:npx\s+)?meowkit\s+(\w+)\b/gi, "kit $1"],
	];

	// Narrative brand-prose substitutions run BEFORE CLI replacements so `MeowKit`
	// (PascalCase brand) does not collide with the case-insensitive `meowkit <verb>`
	// CLI regex. Skipped inside code blocks AND inside citation-context line windows.
	const target = options?.targetName ?? "the host runtime";
	const narrativeBrandReplacements: Array<[RegExp, string]> = [
		[/\bMeowKit\b/g, "the toolkit"],
		[/\bClaude Code\b/g, target],
		[/\bper Anthropic'?s?\s+(documented behavior|field report|spec)\b/gi, "per the runtime's plugin contract"],
	];

	const citationLines = buildCitationLineSet(result);
	const lineStarts = buildLineOffsetMap(result);
	for (const [regex, replacement] of narrativeBrandReplacements) {
		result = result.replace(regex, (matched, ...args) => {
			const offset = args[args.length - 2] as number;
			if (isInCodeBlock(offset)) return matched;
			const lineIdx = lineIndexAtOffset(lineStarts, offset);
			if (citationLines.has(lineIdx)) return matched;
			return replacement;
		});
	}

	const allReplacements = [...toolReplacements, ...mewkitCliReplacements];

	for (const [regex, replacement] of allReplacements) {
		result = result.replace(regex, (matched, ...args) => {
			const offset = args[args.length - 2] as number;
			if (isInCodeBlock(offset)) return matched;
			// Manually substitute $1, $2... when present (callback form doesn't auto-expand).
			if (replacement.includes("$")) {
				const captures = args.slice(0, args.length - 2) as string[];
				return replacement.replace(/\$(\d+)/g, (_, n) => captures[Number.parseInt(n, 10) - 1] ?? "");
			}
			return replacement;
		});
	}

	result = result.replace(/(?<!\w)(\/[a-z][a-z0-9/._:-]+)/g, (matched, ...args) => {
		const offset = args[args.length - 2] as number;
		if (isInCodeBlock(offset)) return matched;

		const slashCmd = matched;
		const trailingPunctuationMatch = slashCmd.match(/[.,!?;:]$/);
		const trailingPunctuation = trailingPunctuationMatch?.[0] ?? "";
		const normalizedSlashCmd = trailingPunctuation ? slashCmd.slice(0, -trailingPunctuation.length) : slashCmd;

		const beforeMatch = result.slice(Math.max(0, offset - 10), offset);
		if (/https?:\/\/$/.test(beforeMatch)) return slashCmd;

		if (
			normalizedSlashCmd.startsWith("/api/") ||
			normalizedSlashCmd.startsWith("/src/") ||
			normalizedSlashCmd.startsWith("/home/") ||
			normalizedSlashCmd.startsWith("/Users/") ||
			normalizedSlashCmd.startsWith("/var/") ||
			normalizedSlashCmd.startsWith("/etc/") ||
			normalizedSlashCmd.startsWith("/opt/") ||
			normalizedSlashCmd.startsWith("/tmp/")
		) {
			return slashCmd;
		}

		if (/\.\w+$/.test(normalizedSlashCmd)) return slashCmd;

		if ((normalizedSlashCmd.match(/\//g) || []).length >= 3) return slashCmd;

		return trailingPunctuation;
	});

	const envVarReplacements: Array<[RegExp, string]> = [
		[/\$CLAUDE_PROJECT_DIR\b/g, "the project root"],
		[/\$CLAUDE_MODEL\b/g, "the runtime-selected model"],
		[/\$CLAUDE_[A-Z0-9_]+\b/g, "runtime-specific environment"],
		[/\$ANTHROPIC_API_KEY\b/g, "your provider API key"],
		[/\$ANTHROPIC_[A-Z0-9_]+\b/g, "provider-specific environment"],
	];

	for (const [regex, replacement] of envVarReplacements) {
		result = result.replace(regex, (matched, ...args) => {
			const offset = args[args.length - 2] as number;
			return isInCodeBlock(offset) ? matched : replacement;
		});
	}

	// Providers without a hooks surface keep the historical line-drop for hook
	// references — a hook that cannot run anywhere is noise, not a warning.
	const hookTarget = getReferenceTarget(options?.provider, "hooks");
	if (!hookTarget) {
		const hooksLinePattern = sourceHooksLinePattern();
		result = result
			.split("\n")
			.filter((line) => !hooksLinePattern.test(line))
			.join("\n");
	}

	const refResult = rewriteSourceReferences(result, {
		provider: options?.provider,
		file: options?.file,
		migratedRefs: options?.migratedRefs,
	});
	result = refResult.content;
	warnings.push(...refResult.warnings);
	occurrences.push(...refResult.occurrences);

	const subagentSupport = options?.provider ? providers[options.provider].subagents : "none";
	const preserveDelegation = subagentSupport !== "none";
	const preserveHookSections = options?.provider ? Boolean(providers[options.provider].hooks) : false;

	if (!preserveDelegation) {
		const delegationPatterns = [
			/^.*\bdelegate\s+to\s+`[^`]+`\s+agent.*$/gim,
			/^.*\bspawn.*agent.*$/gim,
			/^.*\buse.*subagent.*$/gim,
			/^.*\bactivate.*skill.*$/gim,
		];
		for (const pattern of delegationPatterns) result = result.replace(pattern, "");
	}

	const lines = result.split("\n");
	const filteredLines: string[] = [];
	let skipUntilHeading = false;
	let skipHeadingLevel = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

		if (headingMatch) {
			const level = headingMatch[1].length;
			const title = headingMatch[2];

			const isHookSection = /hook/i.test(title);
			const isClaudeApiSection = /SendMessage|TaskCreate|TaskUpdate/i.test(title);
			const isAgentTeamSection = /agent\s+team/i.test(title);

			if (
				(!preserveHookSections && isHookSection) ||
				isClaudeApiSection ||
				(!preserveDelegation && isAgentTeamSection)
			) {
				skipUntilHeading = true;
				skipHeadingLevel = level;
				removedSections.push(title.trim());
				continue;
			}

			if (skipUntilHeading && level <= skipHeadingLevel) skipUntilHeading = false;
		}

		if (skipUntilHeading || /SendMessage|TaskCreate|TaskUpdate/.test(line)) continue;
		filteredLines.push(line);
	}

	result = filteredLines.join("\n");

	result = result.replace(/\n{3,}/g, "\n\n");
	result = result
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
	result = result.trim();

	if (options?.charLimit && result.length > options.charLimit) {
		const truncated = truncateAtCleanBoundary(result, options.charLimit);
		result = truncated.result;
		const overBy = truncated.originalLength - options.charLimit;
		const pct = Math.round((overBy / options.charLimit) * 100);
		let msg = `Content truncated from ${truncated.originalLength} to ${result.length} chars (${pct}% over ${options.charLimit} limit)`;
		if (truncated.removedSections.length > 0) {
			msg += `; removed sections: ${truncated.removedSections.join(", ")}`;
		}
		if (options.provider) msg += ` [${options.provider}]`;
		warnings.push(msg);
	}

	if (!result || result.length === 0) {
		const providerTag = options?.provider ? ` [${options.provider}]` : "";
		warnings.push(`All content was Claude-specific${providerTag}`);
	}

	return { content: result, warnings, removedSections, occurrences };
}

export function convertMdStrip(
	item: PortableItem,
	provider: ProviderType,
	context?: { migratedRefs?: ReferenceIntegrityIndex | null },
): ConversionResult {
	const providerConfig = providers[provider];
	const pathConfig = providerConfig.config ?? providerConfig.rules;
	const charLimit = pathConfig?.charLimit;
	const targetName = providerConfig.displayName;

	const result = stripClaudeRefs(item.body, {
		provider,
		charLimit,
		targetName,
		file: `${item.name}.md`,
		migratedRefs: context?.migratedRefs,
	});

	return {
		content: result.content,
		filename: `${item.name}.md`,
		warnings: result.warnings,
		occurrences: result.occurrences,
	};
}
