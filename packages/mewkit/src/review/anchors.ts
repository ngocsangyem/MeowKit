// Resolve inline-comment anchors by matching a quoted code SNIPPET against the
// captured diff — never trusting an agent-reported line number (Qwen resolve-anchors
// pattern). A comment anchors to an ADDED (+) line in the PR's new file. Ambiguous or
// absent snippets are rejected (the caller keeps the finding in the review body rather
// than pinning it to the wrong line). Pure — operates only on the immutable diff text.

export interface Anchor {
	file: string; // new-file path the finding is about
	snippet: string; // a verbatim (or whitespace-variant) slice of the added line
}

export interface ResolvedAnchor {
	file: string;
	line: number; // 1-based line in the PR's NEW file
	snippet: string;
}

export type AnchorResult = { ok: true; anchor: ResolvedAnchor } | { ok: false; reason: "not-found" | "ambiguous" };

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// Walk the unified diff, tracking the new-file line number, and collect the new-file
// line numbers of ADDED lines in `file` whose content matches `snippet` (exact first,
// then whitespace-normalized).
export function resolveAnchor(diffText: string, file: string, snippet: string): AnchorResult {
	const want = snippet.trim();
	const wantNorm = norm(snippet);
	if (!want) return { ok: false, reason: "not-found" };

	let curFile: string | null = null;
	let newLine = 0;
	let inTarget = false;
	const exact: number[] = [];
	const fuzzy: number[] = [];

	for (const raw of diffText.split("\n")) {
		const header = raw.match(/^diff --git a\/.+? b\/(.+)$/);
		if (header) {
			curFile = header[1];
			inTarget = curFile === file;
			newLine = 0;
			continue;
		}
		if (!inTarget) continue;
		const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
		if (hunk) {
			newLine = Number(hunk[1]);
			continue;
		}
		if (raw.startsWith("+++") || raw.startsWith("---")) continue;
		if (raw.startsWith("+")) {
			const content = raw.slice(1);
			if (content.trim() === want) exact.push(newLine);
			else if (norm(content) === wantNorm) fuzzy.push(newLine);
			newLine++;
		} else if (raw.startsWith("-")) {
			// removed line — does not advance the new-file counter
		} else if (raw.startsWith(" ") || raw === "") {
			newLine++; // context line advances the new-file counter
		}
	}

	const hits = exact.length > 0 ? exact : fuzzy;
	if (hits.length === 0) return { ok: false, reason: "not-found" };
	if (hits.length > 1) return { ok: false, reason: "ambiguous" };
	return { ok: true, anchor: { file, line: hits[0], snippet: want } };
}
