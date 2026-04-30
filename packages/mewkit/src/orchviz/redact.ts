/**
 * Strict-prefix credential redaction for terminal/log output.
 *
 * Per Q3 validation + red-team #13, redact only strings with high-confidence
 * key prefixes (sk-, ghp_, AKIA, PEM blocks). Lexical "password=" / "token="
 * patterns are NOT scrubbed — false-positive rate on user prompts is too high.
 */

const PATTERNS: ReadonlyArray<{ re: RegExp; replacement: string }> = [
	{ re: /sk-[a-zA-Z0-9_-]{20,}/g, replacement: "sk-***REDACTED***" },
	{ re: /ghp_[a-zA-Z0-9]{36}/g, replacement: "ghp_***REDACTED***" },
	{ re: /AKIA[0-9A-Z]{16}/g, replacement: "AKIA***REDACTED***" },
	{
		re: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g,
		replacement: "-----REDACTED-PEM-BLOCK-----",
	},
];

export function scrubSecrets(input: string): string {
	let out = input;
	for (const { re, replacement } of PATTERNS) {
		out = out.replace(re, replacement);
	}
	return out;
}

export function scrubObject<T>(value: T): T {
	if (typeof value === "string") return scrubSecrets(value) as unknown as T;
	if (Array.isArray(value)) return value.map((v) => scrubObject(v)) as unknown as T;
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = scrubObject(v);
		}
		return out as unknown as T;
	}
	return value;
}
