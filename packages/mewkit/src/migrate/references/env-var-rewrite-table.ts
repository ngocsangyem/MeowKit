// Single source of truth for neutralizing / rewriting Claude-runtime environment
// variables when migrating a skill to a non-Claude provider.
//
// SECURITY CONTRACT (never-weaken):
//   Every entry here is a STATIC literal-table lookup. A rewrite value is NEVER
//   constructed from, interpolated with, or derived from file content. The
//   matched source token is discarded; only the fixed `rewriteTo` string (or a
//   fixed neutralization phrase) is emitted. Output is validated against
//   SAFE_REWRITE_OUTPUT before use so a table typo can never introduce a shell
//   metacharacter. This is the property that keeps the rewrite path from
//   becoming an injection vector (see the migration completeness plan, Phase 3
//   risk row "Rewrite output becomes an injection vector").
//
// MAPPING DECISIONS (recorded here because they are policy, not code):
//   - $CLAUDE_PROJECT_DIR  -> "$PROJECT_ROOT"
//       Codex exposes the working project root to hooks/skills; a provider-neutral
//       "$PROJECT_ROOT" placeholder is the documented convention. Downstream skills
//       that read it must define PROJECT_ROOT (Codex sets its own equivalent).
//   - $CLAUDE_PLUGIN_DATA / ${CLAUDE_PLUGIN_DATA}
//       UNMAPPED in Codex docs (verified against the Codex capability surface —
//       Codex has no documented plugin-scoped persistent-data variable). The
//       nearest documented state dir is $CODEX_HOME (default ~/.codex), so the
//       convention emitted here is "${CODEX_HOME:-$HOME/.codex}/plugin_data". This
//       is OUR convention, stated as such; REVISIT once Codex documents a
//       plugin-data equivalent.
//   - $CLAUDE_MODEL -> neutralized (no provider-portable literal). Annotated only.
//   - All other $CLAUDE_* / $ANTHROPIC_* -> neutralized + annotated, never rewritten
//       to a fabricated value. Neutralization means: the audit downgrades the match
//       to a warning and injects an annotation, but the literal token is preserved
//       so the migrated author can wire it to the provider manually.

/** Allowlist for any emitted rewrite value — mirrors the plan's injection guard. */
export const SAFE_REWRITE_OUTPUT = /^[A-Za-z0-9_/.${}:~-]+$/;

/** How a matched env-var token is handled by the audit/rewrite pass. */
export type EnvVarDisposition = "rewrite" | "neutralize";

export interface EnvVarRewriteEntry {
	/** Exact source token variants this entry matches (with and without braces). */
	readonly tokens: readonly string[];
	/** rewrite = replace with `rewriteTo`; neutralize = keep token, warn + annotate. */
	readonly disposition: EnvVarDisposition;
	/** Present only when disposition === "rewrite". Static literal — never content-derived. */
	readonly rewriteTo?: string;
	/** Human-readable annotation injected into the migrated file and the record. */
	readonly annotation: string;
}

/**
 * Ordered rewrite table. Specific tokens come before the catch-all classes so the
 * first matching entry wins. Every `rewriteTo` is a fixed literal validated below.
 */
export const ENV_VAR_REWRITE_TABLE: readonly EnvVarRewriteEntry[] = [
	{
		tokens: ["$CLAUDE_PROJECT_DIR", "${CLAUDE_PROJECT_DIR}"],
		disposition: "rewrite",
		rewriteTo: "$PROJECT_ROOT",
		annotation: "was $CLAUDE_PROJECT_DIR; rewritten to the provider-neutral $PROJECT_ROOT convention",
	},
	{
		tokens: ["$CLAUDE_PLUGIN_DATA", "${CLAUDE_PLUGIN_DATA}"],
		disposition: "rewrite",
		rewriteTo: "${CODEX_HOME:-$HOME/.codex}/plugin_data",
		annotation:
			"was ${CLAUDE_PLUGIN_DATA}; UNMAPPED in Codex docs — rewritten to the provider-neutral ${CODEX_HOME:-$HOME/.codex}/plugin_data convention (revisit if Codex documents a plugin-data variable)",
	},
	{
		tokens: ["$CLAUDE_MODEL", "${CLAUDE_MODEL}"],
		disposition: "neutralize",
		annotation: "references $CLAUDE_MODEL, which has no provider-portable value — wire it to the provider's model variable manually",
	},
];

/** Fallback classes for any Claude/Anthropic env var not named above. */
const CLAUDE_ENV_CLASS = /^\$\{?CLAUDE_[A-Z0-9_]+\}?$/;
const ANTHROPIC_ENV_CLASS = /^\$\{?ANTHROPIC_[A-Z0-9_]+\}?$/;

export interface EnvVarResolution {
	disposition: EnvVarDisposition;
	/** Present when disposition === "rewrite" — the validated static literal. */
	rewriteTo?: string;
	annotation: string;
}

/**
 * Resolve one matched env-var token to a disposition. Pure lookup: the input token
 * selects an entry but NEVER contributes to the output string.
 *
 * @throws if a table entry's `rewriteTo` fails the SAFE_REWRITE_OUTPUT allowlist —
 *         a fail-closed guard against a future unsafe table edit.
 */
export function resolveEnvVar(token: string): EnvVarResolution | null {
	for (const entry of ENV_VAR_REWRITE_TABLE) {
		if (!entry.tokens.includes(token)) continue;
		if (entry.disposition === "rewrite") {
			const value = entry.rewriteTo ?? "";
			if (!SAFE_REWRITE_OUTPUT.test(value)) {
				throw new Error(`env-var rewrite table produced an unsafe value for ${token}`);
			}
			return { disposition: "rewrite", rewriteTo: value, annotation: entry.annotation };
		}
		return { disposition: "neutralize", annotation: entry.annotation };
	}
	if (CLAUDE_ENV_CLASS.test(token)) {
		return {
			disposition: "neutralize",
			annotation: `references ${token}, a Claude-specific environment variable with no provider equivalent — wire it manually`,
		};
	}
	if (ANTHROPIC_ENV_CLASS.test(token)) {
		return {
			disposition: "neutralize",
			annotation: `references ${token}, an Anthropic-specific environment variable with no provider equivalent — wire it manually`,
		};
	}
	return null;
}

/** Match every Claude/Anthropic env-var token in a piece of content (fresh state). */
export function envVarTokenPattern(): RegExp {
	return /\$\{?(?:CLAUDE|ANTHROPIC)_[A-Z0-9_]+\}?/g;
}
