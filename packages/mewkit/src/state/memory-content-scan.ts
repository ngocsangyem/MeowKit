// The ONE content scan for the committed team-memory store. `validate --memory` runs it over
// every file in the store; `mewkit note` runs it over a single entry before appending. Both
// must agree, or a write the lint would reject could still land.
//
// Scan order is cost-ordered and fail-closed: byte cap → flood → per-line (bounded) →
// whole-body. The whole-body pass exists because a multi-line secret (a PEM block) is
// unmatchable by construction in a per-line scan, and the per-line pass exists because a
// finding without a line number is not actionable.
//
// A finding NEVER carries the matched text for a secret: the lint output is read in CI logs
// and in a terminal, so echoing the credential would turn the guard into a leak.
import { SECRET_PATTERNS, normalizeForScan, validateContent } from "./injection-scanner.js";
import { MAX_CONTENT_BYTES, MAX_SCAN_LINE_BYTES, decodePasses, isFlood } from "./obfuscation-passes.js";

export type MemoryFindingKind = "size" | "byte-cap" | "long-line" | "flood" | "injection" | "secret" | "unreadable";

export interface ContentFinding {
	/** 1-based line number; 0 when the finding is about the content as a whole. */
	line: number;
	kind: MemoryFindingKind;
	detail: string;
}

/** Split on any newline convention. A CR-only file is many lines, not one giant line. */
export function splitLines(body: string): string[] {
	return body.split(/\r\n|\r|\n/);
}

/** Count lines the way a reviewer does: a trailing newline does not add a line. */
export function countLines(body: string): number {
	if (body === "") return 0;
	const lines = splitLines(body);
	return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

/** First injection hit across every decode pass (Rule 8), or null. Returns the PATTERN
 *  source rather than the match when the hit came from a decoded view — the decoded text is
 *  attacker-controlled and does not belong verbatim in a log line. */
function firstInjection(text: string): string | null {
	const normalized = normalizeForScan(text);
	const plain = validateContent(normalized);
	if (!plain.valid) return plain.match ?? plain.pattern ?? "instruction-like text";
	for (const view of decodePasses(normalized).slice(1)) {
		const result = validateContent(view);
		if (!result.valid) return `obfuscated: ${result.pattern ?? "instruction-like text"}`;
	}
	return null;
}

/** True when any secret pattern matches. The match itself is deliberately discarded. */
function hasSecret(text: string): boolean {
	for (const [pattern] of SECRET_PATTERNS) {
		// SECRET_PATTERNS are global; reset lastIndex so a shared regex cannot skip a match.
		pattern.lastIndex = 0;
		if (pattern.test(text)) return true;
	}
	return false;
}

export interface ScanOptions {
	/** Byte ceiling for this content. Defaults to the per-file cap. */
	maxBytes?: number;
}

/**
 * Scan one body of memory content. An empty array means clean.
 *
 * Over the byte cap the scan STOPS: the content is reported and nothing is scanned, so an
 * oversized payload can neither pass silently nor cost unbounded CPU.
 */
export function scanMemoryContent(body: string, opts: ScanOptions = {}): ContentFinding[] {
	const maxBytes = opts.maxBytes ?? MAX_CONTENT_BYTES;
	const bytes = Buffer.byteLength(body, "utf-8");
	if (bytes > maxBytes) {
		return [
			{
				line: 0,
				kind: "byte-cap",
				detail: `${bytes} bytes exceeds the ${maxBytes}-byte cap — not scanned; split or prune the content`,
			},
		];
	}

	const findings: ContentFinding[] = [];
	if (isFlood(body)) {
		findings.push({
			line: 0,
			kind: "flood",
			detail: "large and highly repetitive — reads as context-window padding, not recall",
		});
	}

	const lines = splitLines(body);
	let sawLineInjection = false;
	let sawLineSecret = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (Buffer.byteLength(line, "utf-8") > MAX_SCAN_LINE_BYTES) {
			// Bounded cost: report and skip rather than run every pattern over a pasted blob.
			findings.push({
				line: i + 1,
				kind: "long-line",
				detail: `line is over ${MAX_SCAN_LINE_BYTES} bytes and was not scanned — wrap it or link to the source`,
			});
			continue;
		}
		const injection = firstInjection(line);
		if (injection) {
			findings.push({ line: i + 1, kind: "injection", detail: `instruction-like text: ${injection}` });
			sawLineInjection = true;
		}
		if (hasSecret(line)) {
			findings.push({ line: i + 1, kind: "secret", detail: "matches a secret pattern" });
			sawLineSecret = true;
		}
	}

	// Whole-body pass: catches what spans lines (a PEM block, a payload split across an HTML
	// comment). Suppressed when the per-line pass already reported the same kind, so the same
	// problem is not counted twice.
	if (!sawLineInjection) {
		const injection = firstInjection(body);
		if (injection) {
			findings.push({ line: 0, kind: "injection", detail: `instruction-like text spanning lines: ${injection}` });
		}
	}
	if (!sawLineSecret && hasSecret(body)) {
		findings.push({ line: 0, kind: "secret", detail: "matches a secret pattern spanning lines" });
	}

	return findings;
}
