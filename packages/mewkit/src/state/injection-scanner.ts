// Canonical TS port of the MeowKit content scanners, owned by the runtime-neutral
// state layer so every writer (memory, wiki, migrate, hooks) shares ONE source —
// never a hand-synced copy. `wiki/infrastructure/scan-patterns.ts` re-exports this
// module for backward compatibility; the installed hook `validate-content.cjs` is
// generated from this source (no dynamic require of a project-controlled file).
//
// MIRROR these sources pattern-for-pattern when they change:
//   - hooks/lib/validate-content.cjs   → INJECTION_PATTERNS + validateContent
//   - hooks/lib/secret-scrub.cjs       → SECRET_PATTERNS + scrubSecrets
// Local additions cite web-to-markdown security.md Layer 5 (injection) / Layer 7 (secrets).

/** Injection patterns. First 8 are verbatim from validate-content.cjs; the rest are the
 * web-to-markdown Layer 5 local additions (tool-call hijack, memory poisoning, role-play). */
export const INJECTION_PATTERNS: readonly RegExp[] = [
	/ignore\s+(?:previous|all)\s+instructions/i,
	/disregard\s+(?:rules|instructions|safety)/i,
	/you\s+are\s+now/i,
	/forget\s+your/i,
	/new\s+system\s+prompt/i,
	/<\/?memory-data[^>]*>/i,
	/pretend\s+you\s+are/i,
	/act\s+as\s+if/i,
	// web-to-markdown Layer 5 local additions:
	/your\s+(?:previous\s+)?instructions\s+(?:have\s+been\s+)?updated/i,
	/call\s+the\s+\w+\s+tool/i,
	/use\s+the\s+(?:bash|write|edit|read)\s+tool/i,
	/add\s+this\s+to\s+your\s+memory/i,
	/\bDAN\s+mode\b/i,
	/you'?re\s+an?\s+uncensored/i,
	// Security-audit additions (instruction-override / exfil / jailbreak / role-play):
	/\bjailbreak\b/i,
	/(?:reveal|print|repeat|show)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions)/i,
	/(?:override|bypass|ignore)\s+(?:the\s+)?(?:safety|security|content)\s+(?:filter|policy|guidelines)/i,
	/without\s+(?:any\s+)?restrictions?/i,
	/exfiltrat/i,
	/(?:send|post|upload|leak)\s+(?:the\s+)?(?:secret|token|password|api[_-]?key|env|credentials?)/i,
	/do\s+not\s+(?:tell|inform|alert|warn)\s+(?:the\s+)?(?:user|human)/i,
	/system\s*:\s*you\s+(?:are|must)/i,
	/developer\s+mode\s+(?:enabled|on)/i,
	// Expansion toward web-to-markdown Layer-5 parity. Scoped to ASSISTANT-DIRECTED
	// phrasings only — generic shell/code terms (curl, rm -rf, execute) are intentionally NOT
	// here, since a dev-knowledge wiki carries legitimate shell examples (avoid false-positive
	// quarantine of real content).
	/from\s+now\s+on[, ]+you\s+(?:are|will|must|should)/i,
	/stay\s+in\s+character/i,
	/roleplay\s+as/i,
	/act\s+as\s+(?:an?\s+)?(?:dan|jailbroken|unfiltered|uncensored)/i,
	/this\s+is\s+(?:just\s+)?a\s+test\s+of\s+your/i,
	/decode\s+the\s+following\s+(?:base64|rot13|text|string)/i,
	/\bsudo\s+mode\b/i,
	/disable\s+(?:your\s+)?(?:safety|guardrails?|filters?)/i,
	/turn\s+off\s+(?:your\s+)?safety/i,
	/send\s+(?:it|this|them|the\s+\w+)\s+to\s+https?:\/\//i,
	/(?:post|upload)\s+(?:the\s+)?(?:secret|token|key|data|env|file)\s+to\b/i,
	/what\s+(?:is|are)\s+your\s+(?:initial\s+|original\s+)?instructions/i,
	/repeat\s+the\s+(?:words|text|content)\s+above/i,
	/ignore\s+(?:the\s+)?(?:above|preceding|prior)\b/i,
	/override\s+(?:your\s+)?(?:prior|previous)\s+(?:directives|rules|instructions)/i,
	/new\s+persona\b/i,
];

export interface ContentValidation {
	valid: boolean;
	pattern?: string;
	match?: string;
}

/** Mirror of validate-content.cjs: {valid:true} on pass (no pattern/match);
 * {valid:false, pattern, match} on the first hit. */
export function validateContent(text: string): ContentValidation {
	if (!text) return { valid: true };
	for (const pattern of INJECTION_PATTERNS) {
		const match = text.match(pattern);
		if (match) return { valid: false, pattern: pattern.source, match: match[0] };
	}
	return { valid: true };
}

/** Secret patterns, ported verbatim from secret-scrub.cjs. Conservative: false positives
 * accepted, missed secrets are not. Each entry is [matcher, replacement]. */
export const SECRET_PATTERNS: readonly (readonly [RegExp, string])[] = [
	[/sk-ant-[A-Za-z0-9_-]{20,}/g, "[REDACTED-ANTHROPIC-KEY]"],
	[/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED-OPENAI-KEY]"],
	[/sk_(live|test)_[A-Za-z0-9]{16,}/g, "[REDACTED-STRIPE-KEY]"],
	[/rk_(live|test)_[A-Za-z0-9]{16,}/g, "[REDACTED-STRIPE-RESTRICTED-KEY]"],
	[/pk_(live|test)_[A-Za-z0-9]{16,}/g, "[REDACTED-STRIPE-PUB-KEY]"],
	[/AKIA[0-9A-Z]{16}/g, "[REDACTED-AWS-KEY]"],
	[/ghp_[A-Za-z0-9]{30,}/g, "[REDACTED-GH-TOKEN]"],
	[/gho_[A-Za-z0-9]{30,}/g, "[REDACTED-GH-OAUTH]"],
	[/glpat-[A-Za-z0-9_-]{20,}/g, "[REDACTED-GITLAB-PAT]"],
	[/xox[bpars]-[0-9]+-[0-9]+-[0-9]+-[A-Za-z0-9]{24,}/g, "[REDACTED-SLACK-TOKEN]"],
	[/https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]+/g, "[REDACTED-SLACK-WEBHOOK]"],
	[/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[REDACTED-JWT]"],
	[/-----BEGIN [A-Z ]*PRIVATE KEY-----[^-]*-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED-PRIVATE-KEY]"],
	[/(api[_-]?key|apikey|password|passwd|secret|token)(\s*[:=]\s*)["']?[A-Za-z0-9_/+=.-]{16,}["']?/gi, "$1$2[REDACTED]"],
	[/Bearer [A-Za-z0-9_/+=.-]{20,}/g, "Bearer [REDACTED]"],
	[/(mysql|postgres|postgresql|mongodb|redis):\/\/[^\s"']+/gi, "$1://[REDACTED-DB-URL]"],
	[/[A-Za-z0-9._%+-]{3,}@[A-Za-z0-9.-]{3,}\.[A-Za-z]{2,}/g, "[REDACTED-EMAIL]"],
	[/(MEOWKIT_[A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD))(\s*=\s*)\S{8,}/g, "$1$2[REDACTED]"],
];

/** Mirror of secret-scrub.cjs scrubSecrets. */
export function scrubSecrets(input: string): string {
	if (typeof input !== "string" || !input) return "";
	let out = input;
	for (const [re, replacement] of SECRET_PATTERNS) out = out.replace(re, replacement);
	return out;
}

/** Strip zero-width chars and apply NFKC (catches homoglyph/zero-width obfuscation),
 * per web-to-markdown Layer 5 pass 1. */
export function normalizeForScan(text: string): string {
	return text.replace(/[​‌‍﻿]/g, "").normalize("NFKC");
}
