// Conservative detector for state-changing commands inside a migrated executable
// script. Used by the fail-closed script policy: a script that both (a) contains a
// state-changing command AND (b) carries a Claude-runtime coupling match stays
// FAIL-CLOSED — a rewrite path never downgrades it.
//
// SECURITY: this detector is deliberately over-inclusive within each language. A
// false positive keeps a harmless script fail-closed (safe, escalated with
// evidence); a false negative would let a destructive script downgrade to a
// warning (unsafe). It is scoped by language so a numeric comparison (`x > 100`) in
// a Python/JS file is not mistaken for a shell redirect — that scoping removes a
// large false-positive class WITHOUT weakening detection of real writes, which in
// those languages use explicit APIs (open('w'), writeFileSync, os.remove, ...).
// Content is DATA — pattern-matched here, never executed and never used to build
// any output.

import { extname } from "node:path";

export type ScriptLanguage = "shell" | "python" | "node" | "unknown";

/** Cross-language state-changing commands (invoked via a shell in any script). */
const COMMON_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
	// Destructive filesystem removal (word-boundary rm, with a flag or path arg).
	{ pattern: /(^|[;&|(]|\bsudo\s+|&&\s*|\|\|\s*)\brm\s+-|\brm\s+["'$]/m, reason: "runs rm (filesystem delete)" },
	{ pattern: /\brmdir\b/, reason: "runs rmdir" },
	// Remote-mutating git.
	{ pattern: /\bgit\s+push\b/, reason: "runs git push" },
	// Mutating HTTP verbs.
	{ pattern: /\bcurl\b[^\n]*\s-X\s*(POST|PUT|DELETE|PATCH)\b/i, reason: "issues a mutating HTTP request (curl -X)" },
	{ pattern: /\bcurl\b[^\n]*--request\s*(POST|PUT|DELETE|PATCH)\b/i, reason: "issues a mutating HTTP request (curl --request)" },
	{ pattern: /\bwget\b[^\n]*--method=(POST|PUT|DELETE|PATCH)\b/i, reason: "issues a mutating HTTP request (wget --method)" },
	// Security-sensitive env mutation: export/unset of a credential/secret var.
	{
		pattern: /\b(export|unset)\s+[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL|API)[A-Z0-9_]*/,
		reason: "exports/unsets a security-sensitive environment variable",
	},
];

// Shell file-write via redirection. This is line-based instead of a single regex
// so it can (a) skip comment lines and (b) ignore `>` that lives inside a quoted
// string (e.g. an embedded awk body `'if (x > 0)'`). A real redirect is `>`/`>>`
// followed by a filename target, excluding fd redirects (`2>&1`, `>&2`) and the
// comparison/arrow operators (`>=`, `->`, `=>`). Reduces the large false-positive
// class of usage-comment arrows and quoted comparisons WITHOUT missing real writes.
function shellWritesViaRedirection(content: string): boolean {
	for (const rawLine of content.split("\n")) {
		// Strip a leading-comment line entirely.
		const trimmed = rawLine.replace(/^\s+/, "");
		if (trimmed.startsWith("#")) continue;
		// Collapse quoted regions to a single placeholder token `Q` so a `>` INSIDE a
		// string (awk body `'if (x > 0)'`) disappears, but a quoted redirect TARGET
		// (`> "$file"` → `> Q`) is still recognized as a write target.
		const unquoted = rawLine.replace(/'[^']*'/g, "Q").replace(/"[^"]*"/g, "Q");
		// Drop an inline comment tail (best-effort — after quote collapse).
		const code = unquoted.replace(/#.*$/, "");
		// Remove `<placeholder>` angle-bracket tokens (usage text like `<rubric.md>`),
		// which are never real redirects; then discard non-file redirect targets
		// (`>/dev/null`, `>&2`, `> /dev/stderr`).
		const withoutDiscards = code
			.replace(/<[^<>\s][^<>]*>/g, "")
			.replace(/>>?\s*&?\s*\/?dev\/\w+/g, "")
			.replace(/>>?\s*&\s*\d/g, "");
		// A real file-writing redirect: `>`/`>>` not part of an fd/compare/arrow
		// operator, followed by a filename target (quote, $var, path, or word) — but
		// NOT a bare number (`> 0` is an awk/test comparison, not a redirect).
		if (/(^|[^0-9&<>=!$-])>>?(?![>=&])\s*(?![0-9]+\b)[$A-Za-z0-9_./~-]/.test(withoutDiscards)) return true;
	}
	return false;
}

const PYTHON_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
	{ pattern: /\bopen\s*\([^)]*,\s*["'][wax]\+?b?["']/, reason: "opens a file for writing (Python)" },
	{ pattern: /\.write_text\s*\(|\.write_bytes\s*\(/, reason: "writes a file (Python pathlib)" },
	{ pattern: /\bos\.remove\b|\bos\.unlink\b|\bshutil\.rmtree\b|\bos\.rmdir\b/, reason: "removes files (Python)" },
	{ pattern: /\bos\.makedirs\b|\bos\.mkdir\b|\.mkdir\s*\(/, reason: "creates directories (Python)" },
];

const NODE_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
	{
		pattern: /\b(writeFile|writeFileSync|appendFile|appendFileSync|rmSync|unlink|unlinkSync|mkdirSync)\s*\(/,
		reason: "writes/removes files (Node fs)",
	},
	{ pattern: /\bfs\.rm\s*\(/, reason: "removes files (Node fs)" },
];

export function languageFor(filePath: string): ScriptLanguage {
	switch (extname(filePath).toLowerCase()) {
		case ".sh":
			return "shell";
		case ".py":
			return "python";
		case ".js":
		case ".cjs":
		case ".mjs":
		case ".ts":
		case ".tsx":
			return "node";
		default:
			return "unknown";
	}
}

export interface StateChangingResult {
	stateChanging: boolean;
	/** Reason for the first matched state-changing command (for records/escalation). */
	reason?: string;
}

/** Strip comment lines + inline comments so a mention in a comment is not a match. */
function stripComments(content: string, language: ScriptLanguage): string {
	const lineComment = language === "node" ? "//" : "#";
	return content
		.split("\n")
		.map((raw) => {
			const trimmed = raw.replace(/^\s+/, "");
			if (trimmed.startsWith(lineComment)) return "";
			// Best-effort inline-comment strip after removing quoted regions so a `#`/`//`
			// inside a string is not treated as a comment start.
			const unquoted = raw.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
			const idx = unquoted.indexOf(lineComment);
			return idx >= 0 ? raw.slice(0, idx) : raw;
		})
		.join("\n");
}

/**
 * Report whether `content` contains a state-changing command. `language` scopes the
 * language-specific rules; omit it (or pass "unknown") to apply ALL rules — the
 * most conservative choice. Comment lines and (for shell command patterns) quoted
 * strings are excluded so a mention in a comment/string is not a false positive.
 * `content` is DATA: matched, never executed.
 */
export function detectStateChanging(content: string, language: ScriptLanguage = "unknown"): StateChangingResult {
	const code = stripComments(content, language);

	// Shell command patterns (rm/git/curl/export) — also strip quoted strings so a
	// command name mentioned inside a string literal is not a match.
	const shellCode = code.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
	for (const { pattern, reason } of COMMON_PATTERNS) {
		if (pattern.test(shellCode)) return { stateChanging: true, reason };
	}

	// Language file-write APIs — need argument quotes preserved (e.g. open(..,'w')).
	if (language === "python" || language === "unknown") {
		for (const { pattern, reason } of PYTHON_PATTERNS) if (pattern.test(code)) return { stateChanging: true, reason };
	}
	if (language === "node" || language === "unknown") {
		for (const { pattern, reason } of NODE_PATTERNS) if (pattern.test(code)) return { stateChanging: true, reason };
	}

	if ((language === "shell" || language === "unknown") && shellWritesViaRedirection(code)) {
		return { stateChanging: true, reason: "writes files via redirection" };
	}
	return { stateChanging: false };
}
