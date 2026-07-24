// Shared denied-token scanner. A "denied token" is a Claude-Code-bound construct that must
// NOT appear in content installed for a non-Claude provider (Codex, etc.): it names a host
// primitive the target does not have, so the generated skill would reference something that
// cannot exist there. This is the audit's MK-P0-02 scan set, made reusable so the Codex
// portability classifier (Phase 5) and the `validate --target` checker (Phase 6) share ONE
// definition of "not portable" — they can never drift.
//
// Pure + provider-neutral: the set describes Claude-Code coupling; a provider adapter decides
// how to REMOVE or MAP each token. This module only DETECTS.

export interface DeniedToken {
	label: string;
	pattern: RegExp;
}

// The audit's token set (260717) plus the runtime-bound signals from portability-policy.ts.
// Each pattern is anchored to a real host-coupling construct, not incidental prose.
export const DENIED_TOKENS: readonly DeniedToken[] = [
	{ label: "mk/meow slash command", pattern: /\/(?:mk|meow):[a-z]/i },
	{ label: "AskUserQuestion tool", pattern: /\bAskUserQuestion\b/ },
	{ label: ".claude path", pattern: /\.claude\// },
	{ label: "CLAUDE.md reference", pattern: /\bCLAUDE\.md\b/ },
	{ label: "Task( tool call", pattern: /\bTask\(/ },
	// NOTE: "subagent" is NOT denied — it is native Codex vocabulary (custom agents
	// live in .codex/agents/*.toml). Flagging it was a false positive.
	{ label: "Claude env var", pattern: /\$\{?CLAUDE_[A-Z0-9_]+/ },
	{ label: "Anthropic env var", pattern: /\$\{?ANTHROPIC_[A-Z0-9_]+/ },
];

export interface DeniedTokenMatch {
	label: string;
	/** The first matched substring — for the report line, not for execution. */
	sample: string;
}

/** All distinct denied-token classes present in `content` (one entry per class, not per hit). */
export function scanDeniedTokens(content: string): DeniedTokenMatch[] {
	const out: DeniedTokenMatch[] = [];
	for (const t of DENIED_TOKENS) {
		const m = t.pattern.exec(content);
		if (m) out.push({ label: t.label, sample: m[0] });
	}
	return out;
}

/** True when `content` carries any denied token (fast path for a boolean gate). */
export function hasDeniedTokens(content: string): boolean {
	return DENIED_TOKENS.some((t) => t.pattern.test(content));
}
