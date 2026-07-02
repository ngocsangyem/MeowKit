// Markdown span tokenizer + citation detection for source-reference rewriting.
// Span resolution is line-based (frontmatter / fenced) with per-line inline-code
// detection. Ambiguous structures (unclosed fences) resolve to "fenced" so the
// rewriter stays conservative — never rewrite on uncertainty.

import type { ReferenceSpan } from "./reference-types.js";

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FRONTMATTER_DELIMITER = /^---\s*$/;

// A line is a citation when it leads with an attribution verb, or is a
// blockquote carrying an external URL or a repo slug next to an attribution dash.
const CITATION_LEAD = /^(?:>\s*)*(?:source|from|ported\s+from)\b/i;
const BLOCKQUOTE = /^\s*>/;
const EXTERNAL_URL = /https?:\/\//i;
// Repo slug like "org/repo"; the lookbehind rejects path segments (".claude/rules", "a/b/c").
const REPO_SLUG = /(?<![\w./])[a-z0-9][\w.-]*\/[a-z0-9][\w.-]*(?![\w/])/i;
const ATTRIBUTION_DASH = /[—–]/;

export function isCitationLine(line: string): boolean {
	const trimmed = line.trim();
	if (CITATION_LEAD.test(trimmed)) return true;
	if (!BLOCKQUOTE.test(trimmed)) return false;
	return EXTERNAL_URL.test(trimmed) || (REPO_SLUG.test(trimmed) && ATTRIBUTION_DASH.test(trimmed));
}

type LineKind = "frontmatter" | "fenced" | "other";

export interface MarkdownSpanMap {
	/** Span type at a byte offset in the original content */
	spanAt(offset: number): ReferenceSpan;
	/** 1-based line number at a byte offset */
	lineNumberAt(offset: number): number;
	/** Whether the line containing the offset is a citation/attribution line */
	isCitationAt(offset: number): boolean;
}

function buildLineStarts(content: string): number[] {
	const starts = [0];
	for (let i = 0; i < content.length; i++) {
		if (content[i] === "\n") starts.push(i + 1);
	}
	return starts;
}

function lineIndexAt(lineStarts: number[], offset: number): number {
	let lo = 0;
	let hi = lineStarts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (lineStarts[mid] <= offset) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

function classifyLines(lines: string[]): LineKind[] {
	const kinds: LineKind[] = new Array(lines.length).fill("other");

	let i = 0;
	if (lines.length > 0 && FRONTMATTER_DELIMITER.test(lines[0])) {
		const close = lines.findIndex((line, idx) => idx > 0 && FRONTMATTER_DELIMITER.test(line));
		if (close > 0) {
			for (let j = 0; j <= close; j++) kinds[j] = "frontmatter";
			i = close + 1;
		}
	}

	let fenceMarker: { char: string; length: number } | null = null;
	for (; i < lines.length; i++) {
		const line = lines[i];
		if (fenceMarker) {
			kinds[i] = "fenced";
			const close = line.match(FENCE_OPEN);
			if (close && close[1][0] === fenceMarker.char && close[1].length >= fenceMarker.length && !line.trim().slice(close[1].length)) {
				fenceMarker = null;
			}
			continue;
		}
		const open = line.match(FENCE_OPEN);
		if (open) {
			kinds[i] = "fenced";
			fenceMarker = { char: open[1][0], length: open[1].length };
		}
	}
	// An unclosed fence leaves fenceMarker set — remaining lines were already
	// marked fenced inside the loop, which is the conservative resolution.
	return kinds;
}

/** Inline code span ranges (column offsets, delimiters included) for one line. */
function inlineCodeRanges(line: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	let i = 0;
	while (i < line.length) {
		if (line[i] !== "`") {
			i++;
			continue;
		}
		let openLen = 0;
		while (line[i + openLen] === "`") openLen++;
		const openEnd = i + openLen;
		// Find a closing run of the same length.
		let j = openEnd;
		while (j < line.length) {
			if (line[j] !== "`") {
				j++;
				continue;
			}
			let runLen = 0;
			while (line[j + runLen] === "`") runLen++;
			if (runLen === openLen) {
				ranges.push([i, j + runLen]);
				break;
			}
			j += runLen;
		}
		i = j < line.length ? j + openLen : openEnd;
	}
	return ranges;
}

export function buildMarkdownSpanMap(content: string): MarkdownSpanMap {
	const lines = content.split("\n");
	const lineStarts = buildLineStarts(content);
	const lineKinds = classifyLines(lines);
	const citationCache = new Map<number, boolean>();
	const inlineCache = new Map<number, Array<[number, number]>>();

	return {
		spanAt(offset: number): ReferenceSpan {
			const lineIdx = lineIndexAt(lineStarts, offset);
			const kind = lineKinds[lineIdx];
			if (kind === "frontmatter") return "frontmatter";
			if (kind === "fenced") return "fenced";
			let ranges = inlineCache.get(lineIdx);
			if (!ranges) {
				ranges = inlineCodeRanges(lines[lineIdx]);
				inlineCache.set(lineIdx, ranges);
			}
			const column = offset - lineStarts[lineIdx];
			return ranges.some(([start, end]) => column >= start && column < end) ? "inline-code" : "prose";
		},
		lineNumberAt(offset: number): number {
			return lineIndexAt(lineStarts, offset) + 1;
		},
		isCitationAt(offset: number): boolean {
			const lineIdx = lineIndexAt(lineStarts, offset);
			let cached = citationCache.get(lineIdx);
			if (cached === undefined) {
				cached = isCitationLine(lines[lineIdx]);
				citationCache.set(lineIdx, cached);
			}
			return cached;
		},
	};
}
