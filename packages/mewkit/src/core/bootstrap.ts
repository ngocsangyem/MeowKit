// The always-visible capability-resolution bootstrap: a small, generic, functional block
// placed through each provider's native instruction surface. It tells the model WHEN to
// resolve a capability and HOW to request one — it does NOT explain toolkit architecture,
// dump a catalog, or reference any installed metadata. It is a TRUSTED CONSTANT owned by
// this file: nothing derived from installed frontmatter/metadata can alter it, so hostile
// installed content cannot rewrite the model's instructions. Human-approved wording
// (2026-07-11); changes to this text are a model-visible-context change and must be
// re-approved. Budget: <= BOOTSTRAP_MAX_LINES / BOOTSTRAP_MAX_TOKENS per provider (CI-gated).
export const BOOTSTRAP_MAX_LINES = 40;
export const BOOTSTRAP_MAX_TOKENS = 500;

/** Region markers for placing the bootstrap into a provider's instruction surface. */
export const BOOTSTRAP_START = "<!-- GENERATED:capability-bootstrap START -->";
export const BOOTSTRAP_END = "<!-- GENERATED:capability-bootstrap END -->";

/** `.claude/`-relative path of the committed, generated bootstrap file the SessionStart
 * hook emits. Regenerate with `mewkit capabilities bootstrap --write`; a drift test guards
 * it against the source constant. */
export const BOOTSTRAP_FILENAME = "capability-bootstrap.md";

/** Providers with an authored bootstrap projection. The bootstrap TEXT is identical across
 * them — the resolver invocation (`mewkit capabilities resolve`) is CLI-universal; only the
 * PLACEMENT differs (see provider-projection.ts). Other providers are report-only. */
export type BootstrapProvider = "claude-code" | "claude-plugin" | "codex";

const CLAUDE_CODE_BOOTSTRAP = `## Capability resolution

Some tasks need a capability that isn't already in front of you — an external or specialized tool, repository-wide discovery, delegation to a sub-agent, or a verification you can't perform inline. When that happens, resolve the capability first instead of guessing or hand-rolling it.

Resolve when the task needs: an external/specialized tool, integration, or service; discovery or search across the repository beyond the files in context; delegation to a specialized sub-agent; or a verification you don't already have.

Don't resolve for ordinary in-context work — reading, editing, or running a file you already have is not a capability lookup. If nothing specialized is required, proceed directly.

How: run \`mewkit capabilities resolve --intent "<what you're trying to do>"\`. It returns a ranked, evidence-based result:
- \`selected\` — one capability fits and is available; use the returned invocation.
- \`ambiguous\` — several fit; choose by the reasons given, or ask the user.
- \`unavailable\` — it exists but a requirement (binary, integration, permission) is missing; fall back or escalate — do not retry blindly.
- \`unsupported\` — this host can't provide it; state the limitation.

Trust the availability verdict: an \`unavailable\` capability will not become available by calling it again.`;

/** Return the approved bootstrap text for a provider (a trusted constant). The text is the
 * same for every projected provider — the resolver invocation is CLI-universal. */
export function renderBootstrap(_provider: BootstrapProvider = "claude-code"): string {
	return CLAUDE_CODE_BOOTSTRAP;
}

/** Cheap token estimate (chars/4) — matches the Phase-1 context-surface measurement. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}
