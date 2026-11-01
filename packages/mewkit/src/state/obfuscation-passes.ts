// Obfuscation decode passes + the context-flood heuristic — the implementations of
// `injection-rules.md` Rule 8 (encoding obfuscation) and Rule 9 (context-window flooding).
//
// A single-pass plaintext scan is trivially evaded: the same payload survives base64,
// ROT13, percent-encoding, or an HTML comment that renders invisibly in markdown. Rule 8
// names base64 and ROT13 explicitly, and `dead-weight-audit-rules.md` Rule 4 makes every
// `injection-rules.md` defense never-prune — so these passes live in the shared state layer
// where every content gate (`validate --memory`, `mewkit note`) reuses ONE copy.
//
// Pure string→string(s) transforms: no IO, no pattern list of their own. The pattern list
// stays in `injection-scanner.ts`; these only produce additional views of the same text.

/** Per-file / per-document byte ceiling. Content above this is rejected, never scanned. */
export const MAX_CONTENT_BYTES = 1_000_000;

/**
 * Per-line byte ceiling for the regex scan. The secret patterns are linear-ish but not free,
 * and a pasted stack trace or minified blob on one line turns a cheap lint into a CI stall.
 * A line above this is reported rather than scanned — fail closed, bounded cost.
 */
export const MAX_SCAN_LINE_BYTES = 4096;

/** ROT13 — a letter-only substitution, so it is its own inverse. */
export function rot13(text: string): string {
	return text.replace(/[a-zA-Z]/g, (c) => {
		const base = c <= "Z" ? 65 : 97;
		return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
	});
}

/** Percent-decode; a malformed `%`-sequence falls back to the raw form rather than throwing. */
export function percentDecode(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
}

/** Extract HTML-comment bodies so a payload hidden in `<!-- ... -->` is scanned, not skipped.
 *  The approved memory entry format puts its own date stamp in an HTML comment, which makes
 *  that slot the most attractive hiding place in the store. */
export function extractHtmlComments(text: string): string[] {
	return [...text.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
}

/** Decode base64 blocks (≥16 chars, so short payloads are caught too) for re-scanning. */
export function decodeBase64Blocks(text: string): string[] {
	const out: string[] = [];
	for (const m of text.matchAll(/[A-Za-z0-9+/]{16,}={0,2}/g)) {
		try {
			const decoded = Buffer.from(m[0], "base64").toString("utf-8");
			if (decoded && /[ -~]/.test(decoded)) out.push(decoded);
		} catch {
			// not valid base64 — nothing to re-scan
		}
	}
	return out;
}

/** Entry fields that several entries legitimately share (one Source file, one trigger). */
const SHARED_FIELDS = ["Source:", "Apply when:"] as const;
const SHARED_FIELD_MAX_CHARS = 200;

/** The lines repetition is measured over. The entry format repeats some lines by design, and
 *  counting them made a healthy ~40-entry store read as padding and blocked every commit at the
 *  pre-ship hook. So blank separators are skipped, and so is ONE short `Source:` and ONE short
 *  `Apply when:` line per `## ` heading. Headings and `Why:` lines are meant to be unique and
 *  always count, and shared-field lines beyond one per heading count too, so padding built
 *  from entry-shaped lines is still measured. */
function measuredLines(text: string): string[] {
	const lines = text.split("\n");
	const headings = lines.filter((line) => line.startsWith("## ")).length;
	const skipped = new Map<string, number>(SHARED_FIELDS.map((field) => [field, 0]));
	return lines.filter((line) => {
		if (line.trim() === "") return false;
		const field = SHARED_FIELDS.find((f) => line.trimStart().startsWith(f));
		if (!field || line.length > SHARED_FIELD_MAX_CHARS) return true;
		const used = skipped.get(field) ?? 0;
		if (used >= headings) return true;
		skipped.set(field, used + 1);
		return false;
	});
}

/** Context-flooding heuristic (Rule 9): large AND highly repetitive content. Padding text
 *  exists to push the safety instructions out of context, so volume alone is not the signal —
 *  low entropy at volume is. Volume is the whole text; repetition is over `measuredLines`. */
export function isFlood(text: string): boolean {
	if (text.length <= 5000) return false;
	const lines = measuredLines(text);
	if (lines.length >= 10) return 1 - new Set(lines).size / lines.length > 0.3;
	const content = lines.join("\n");
	return content.length > 0 && new Set(content).size / content.length < 0.05;
}

/**
 * Every view of `text` that the injection patterns should run against: the text itself plus
 * one decoded form per obfuscation Rule 8 names. The caller is responsible for normalizing
 * (homoglyph / zero-width) first — that is pass 1 and lives in `injection-scanner.ts`.
 */
export function decodePasses(text: string): string[] {
	return [text, percentDecode(text), rot13(text), ...decodeBase64Blocks(text), ...extractHtmlComments(text)];
}
