// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/md-strip.ts
// MewKit additions: mewkit/meowkit CLI command rewrites; /meow: + /mk: slash refs
// already covered by the existing slash-command regex (matches /[a-z][a-z0-9/._:-]+).

import { homedir } from "node:os";
import { providers } from "../provider-registry.js";
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";

const MAX_CONTENT_SIZE = 512_000;

export interface MdStripOptions {
	provider: ProviderType;
	charLimit?: number;
}

type ProviderPathKind = "agents" | "commands" | "skills" | "rules" | "config" | "hooks";

interface ProviderPathTarget {
	path: string;
	isDirectory: boolean;
}

function normalizeProjectPath(path: string): string {
	const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
	const home = homedir().replace(/\\/g, "/");
	return normalized.startsWith(home) ? normalized.replace(home, "~") : normalized;
}

function getProviderPathTarget(
	provider: ProviderType | undefined,
	type: ProviderPathKind,
): ProviderPathTarget | null {
	if (!provider) return null;
	const pathConfig = providers[provider][type];
	if (!pathConfig) return null;
	const resolvedPath = pathConfig?.projectPath ?? pathConfig?.globalPath;
	if (!resolvedPath) return null;

	const normalized = normalizeProjectPath(resolvedPath);
	const isDirectory =
		pathConfig.writeStrategy === "per-file" ||
		pathConfig.writeStrategy === "yaml-merge" ||
		pathConfig.writeStrategy === "json-merge";

	return {
		path: isDirectory && !normalized.endsWith("/") ? `${normalized}/` : normalized,
		isDirectory,
	};
}

function rewriteClaudeDirectoryRefs(
	input: string,
	sourceDir: "agents" | "commands" | "skills" | "rules" | "hooks",
	target: ProviderPathTarget | null,
	fallbackPrefix: string,
	isInCodeBlock: (pos: number) => boolean,
): string {
	const withItemsRegex = new RegExp(`\\.claude\\/${sourceDir}\\/([a-zA-Z0-9_./-]+)`, "gi");
	const withPrefixRegex = new RegExp(`\\.claude\\/${sourceDir}\\/`, "gi");

	let output = input.replace(withItemsRegex, (matched, suffix: string, ...args) => {
		const offset = args[args.length - 2] as number;
		if (isInCodeBlock(offset)) return matched;
		if (!target) return `${fallbackPrefix}${suffix}`;
		return target.isDirectory ? `${target.path}${suffix}` : target.path;
	});

	output = output.replace(withPrefixRegex, (matched, ...args) => {
		const offset = args[args.length - 2] as number;
		if (isInCodeBlock(offset)) return matched;
		return target ? target.path : fallbackPrefix;
	});

	return output;
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

function truncateAtParagraphBoundary(
	content: string,
	limit: number,
	originalLength: number,
): TruncationResult {
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
): { content: string; warnings: string[]; removedSections: string[] } {
	const warnings: string[] = [];
	const removedSections: string[] = [];
	let result = content;

	if (content.length > MAX_CONTENT_SIZE) {
		warnings.push(`Content exceeds ${MAX_CONTENT_SIZE} chars; stripping skipped for safety`);
		return { content, warnings, removedSections: [] };
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
		const normalizedSlashCmd = trailingPunctuation
			? slashCmd.slice(0, -trailingPunctuation.length)
			: slashCmd;

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

	const agentTarget = getProviderPathTarget(options?.provider, "agents");
	const commandTarget = getProviderPathTarget(options?.provider, "commands");
	const skillTarget = getProviderPathTarget(options?.provider, "skills");
	const ruleTarget = getProviderPathTarget(options?.provider, "rules");
	const configTarget = getProviderPathTarget(options?.provider, "config");
	const hookTarget = getProviderPathTarget(options?.provider, "hooks");

	result = rewriteClaudeDirectoryRefs(result, "rules", ruleTarget, "project rules directory/", isInCodeBlock);
	result = rewriteClaudeDirectoryRefs(result, "agents", agentTarget, "project subagents directory/", isInCodeBlock);
	result = rewriteClaudeDirectoryRefs(result, "commands", commandTarget, "project commands directory/", isInCodeBlock);
	result = rewriteClaudeDirectoryRefs(result, "skills", skillTarget, "project skills directory/", isInCodeBlock);
	if (hookTarget) {
		result = rewriteClaudeDirectoryRefs(result, "hooks", hookTarget, "project hooks directory/", isInCodeBlock);
	} else {
		result = result.split("\n").filter((line) => !/\.claude\/hooks\//i.test(line)).join("\n");
	}

	const configReplacement = configTarget?.path ?? "project configuration file";
	result = result.replace(/\bCLAUDE\.md\b/g, (matched, ...args) => {
		const offset = args[args.length - 2] as number;
		return isInCodeBlock(offset) ? matched : configReplacement;
	});

	const subagentSupport = options?.provider ? providers[options.provider].subagents : "none";
	const preserveDelegation = subagentSupport !== "none";
	const preserveHookSections = options?.provider
		? Boolean(providers[options.provider].hooks)
		: false;

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
	result = result.split("\n").map((line) => line.trimEnd()).join("\n");
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

	return { content: result, warnings, removedSections };
}

export function convertMdStrip(item: PortableItem, provider: ProviderType): ConversionResult {
	const providerConfig = providers[provider];
	const pathConfig = providerConfig.config ?? providerConfig.rules;
	const charLimit = pathConfig?.charLimit;

	const result = stripClaudeRefs(item.body, { provider, charLimit });

	return {
		content: result.content,
		filename: `${item.name}.md`,
		warnings: result.warnings,
	};
}
