// Codex adapter layer (Phase 5). An adapter is a per-provider transform table: it maps the
// Claude-Code-bound tokens the denied-token scanner flags (denied-token-scan.ts) to a Codex
// equivalent or a removal strategy, so a `runtime: claude-code` skill CAN be installed for Codex
// without leaving a construct Codex does not have.
//
// Two parts:
//   CODEX_TOKEN_ADAPTERS  — the token → replacement rules (applied to generated content).
//   CODEX_SKILL_ADAPTERS  — which skills have an AUTHORED, tested adapter (⇒ install transformed).
//
// This phase ships the token rules + an EMPTY skill-adapter table on purpose: cohort-1 is ported
// to `runtime: portable` (it needs no adapter), and every other claude-code skill is default-denied.
// The scaffold + its projection test are ready for later cohorts that adapt rather than port.
// A rule marked `degraded` produces a semantically weaker fallback (e.g. "ask in chat" for a typed
// prompt tool) — such installs count separately in the parity score (adapted-degraded ≠ full parity).

export interface AdapterTokenRule {
	label: string;
	/** Global regex over generated content. */
	pattern: RegExp;
	/** Codex equivalent, or a removal/neutralization phrasing. MUST NOT reintroduce a denied token. */
	replacement: string;
	/** True when the mapping loses fidelity (no real Codex primitive; a prose fallback). */
	degraded?: boolean;
	/**
	 * "tool" = a Claude tool/invocation token with NO legitimate preserve case on Codex (always safe
	 * to rewrite). "path" = a filesystem/config path — rewriting these blindly FABRICATES targets
	 * (e.g. `.claude/scripts/x` has no `.agents/scripts/x`), so the migration's ref-integrity layer
	 * (`stripClaudeRefs`) owns path handling; the path rules here are only for a fully-adapted skill.
	 */
	kind: "tool" | "path";
}

export const CODEX_TOKEN_ADAPTERS: readonly AdapterTokenRule[] = [
	{ label: "mk/meow slash command", pattern: /\/(?:mk|meow):([a-z0-9-]+)/gi, replacement: "the $1 skill", degraded: true, kind: "tool" },
	{ label: "AskUserQuestion tool", pattern: /\bAskUserQuestion\b/g, replacement: "stop and ask the user in chat", degraded: true, kind: "tool" },
	{ label: "Task( tool call", pattern: /\bTask\(/g, replacement: "delegate a sub-task (", degraded: true, kind: "tool" },
	{ label: "subagent primitive", pattern: /\bsubagents?\b/gi, replacement: "sub-task", degraded: true, kind: "tool" },
	{ label: "Claude env var", pattern: /\$\{?CLAUDE_[A-Z0-9_]+\}?/g, replacement: "the project environment", degraded: true, kind: "tool" },
	{ label: "Anthropic env var", pattern: /\$\{?ANTHROPIC_[A-Z0-9_]+\}?/g, replacement: "the provider API key", degraded: true, kind: "tool" },
	{ label: "CLAUDE.md reference", pattern: /\bCLAUDE\.md\b/g, replacement: "AGENTS.md", kind: "path" },
	{ label: ".claude path", pattern: /\.claude\//g, replacement: ".agents/", kind: "path" },
];

/**
 * Apply adapter token rules to `content`. By default applies ALL rules (for a fully-adapted skill).
 * Pass `{ kinds: ["tool"] }` to clean only tool/invocation tokens and leave path refs to the
 * migration's ref-integrity layer (which preserves genuinely out-of-set paths rather than fabricate).
 */
export function applyCodexAdapters(content: string, opts?: { kinds?: Array<AdapterTokenRule["kind"]> }): string {
	const kinds = opts?.kinds;
	let out = content;
	for (const rule of CODEX_TOKEN_ADAPTERS) {
		if (kinds && !kinds.includes(rule.kind)) continue;
		out = out.replace(rule.pattern, rule.replacement);
	}
	return out;
}

export interface CodexSkillAdapter {
	/** True when this skill's adapter uses one or more degraded token mappings. */
	degraded: boolean;
}

/**
 * Skills with an authored, projection-tested Codex adapter. EMPTY this phase by design (cohort-1
 * is ported to portable). A later cohort adds an entry here + a projection test proving the
 * transformed output is denied-token clean before it may install transformed.
 */
export const CODEX_SKILL_ADAPTERS: Readonly<Record<string, CodexSkillAdapter>> = {};

/** The authored adapter for a skill, or null (⇒ not adaptable ⇒ default-denied unless overridden). */
export function lookupCodexSkillAdapter(skillName: string): CodexSkillAdapter | null {
	return CODEX_SKILL_ADAPTERS[skillName] ?? null;
}
