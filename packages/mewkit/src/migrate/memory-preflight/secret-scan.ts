// Conservative secret detector for legacy memory content on its way into `.meowkit/`.
// A memory note can accidentally carry a pasted credential; when it does we FLAG and
// QUARANTINE (redirect to memory/legacy/, report a count) rather than publish it as a
// canonical store — and never delete or redact it (the user resolves). Patterns are
// deliberately high-confidence to keep the false-positive rate low; a miss is safer here
// than swamping every migration with false alarms. Findings never carry the secret value,
// only its type + line, so reports and manifests do not re-leak it.

/** One secret-like hit: the pattern that matched and the 1-based line it sits on. */
export interface SecretFinding {
	type: string;
	line: number;
}

interface SecretPattern {
	type: string;
	re: RegExp;
}

// High-confidence, provider-anchored patterns first; one conservative generic assignment
// rule last. Each is global+multiline so every occurrence is located for line numbers.
const PATTERNS: SecretPattern[] = [
	{ type: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/g },
	{ type: "aws-access-key-id", re: /\bAKIA[0-9A-Z]{16}\b/g },
	{ type: "github-token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },
	{ type: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
	{ type: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
	{ type: "stripe-secret-key", re: /\b(?:sk|rk)_live_[0-9a-zA-Z]{24,}\b/g },
	{ type: "openai-key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
	// Conservative generic: an assignment of a named credential to a long, space-free,
	// quoted-or-bare high-entropy value. Requires a `key = value` shape so prose that merely
	// mentions "password" does not trip it.
	{
		type: "credential-assignment",
		re: /\b(?:api[_-]?key|secret|token|access[_-]?key|client[_-]?secret|password|passwd|pwd)\b["']?\s*[:=]\s*["']?[A-Za-z0-9/+._-]{20,}["']?/gi,
	},
];

// Skip files this large (bytes of UTF-8) — memory content is small; a huge blob is almost
// certainly not a hand-written note and scanning it wastes time. Exported so callers can
// guard BEFORE reading the file into memory, not just after.
export const MAX_SCAN_BYTES = 2 * 1024 * 1024;
// Bound findings per file so a pathological input cannot bloat the manifest/report.
const MAX_FINDINGS = 20;

/** True when the content is likely binary (NUL byte in the first slice) — not scanned. */
export function looksBinary(content: string): boolean {
	const limit = Math.min(content.length, 8192);
	for (let i = 0; i < limit; i++) {
		if (content.charCodeAt(i) === 0) return true; // NUL byte ⇒ treat as binary
	}
	return false;
}

/** Whether a file of this size/content is eligible for a text secret scan. */
export function isScannable(byteSize: number, content: string): boolean {
	return byteSize <= MAX_SCAN_BYTES && !looksBinary(content);
}

/** Scan text for secret-like content. Returns deduped findings (type+line), capped. */
export function scanTextForSecrets(content: string): SecretFinding[] {
	if (!content) return [];
	// Precompute line-start offsets once so each match maps to a line without rescanning.
	const lineStarts = buildLineStarts(content);
	const seen = new Set<string>();
	const findings: SecretFinding[] = [];

	for (const { type, re } of PATTERNS) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(content)) !== null) {
			const line = offsetToLine(m.index, lineStarts);
			const key = `${type}:${line}`;
			if (!seen.has(key)) {
				seen.add(key);
				findings.push({ type, line });
				if (findings.length >= MAX_FINDINGS) return findings.sort(byLineThenType);
			}
			if (m.index === re.lastIndex) re.lastIndex++; // guard zero-width match loops
		}
	}
	return findings.sort(byLineThenType);
}

function byLineThenType(a: SecretFinding, b: SecretFinding): number {
	return a.line - b.line || a.type.localeCompare(b.type);
}

function buildLineStarts(content: string): number[] {
	const starts = [0];
	for (let i = 0; i < content.length; i++) {
		if (content.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
	}
	return starts;
}

function offsetToLine(offset: number, lineStarts: number[]): number {
	// Binary search for the greatest lineStart <= offset.
	let lo = 0;
	let hi = lineStarts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (lineStarts[mid] <= offset) lo = mid;
		else hi = mid - 1;
	}
	return lo + 1; // 1-based
}
