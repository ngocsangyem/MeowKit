import { isExplainedReference } from "./validation/unresolved-reference-scanner.js";
import { sourceConfigTokenPattern, sourceReferencePattern } from "./references/reference-target-registry.js";
import { envVarTokenPattern, resolveEnvVar } from "./references/env-var-rewrite-table.js";
import type { ReferenceOccurrence } from "./references/reference-types.js";

/**
 * Coarse pattern class of a runtime-coupling match. Downstream verdict logic keys
 * off this to decide rewrite vs downgrade vs fail — the class is metadata, it does
 * NOT itself relax the fail-closed default.
 */
export type RuntimeCouplingClass =
	| "claude-env-var" // $CLAUDE_* / $ANTHROPIC_* — table-rewriteable or neutralizable
	| "claude-cli" // `npx claude` / `claude --|mcp|doctor|update` command assumption
	| "claude-path" // unexplained .claude/ path reference
	| "claude-config-token"; // CLAUDE.md token

export interface RuntimeCouplingMatch {
	message: string;
	/** Pattern class, used by the audit to select severity/rewrite handling. */
	cls: RuntimeCouplingClass;
	/**
	 * When the match is a table-known env var, this is the disposition + static
	 * rewrite/annotation from env-var-rewrite-table.ts. Absent for other classes.
	 * The value is ALWAYS a literal-table lookup — never derived from `content`.
	 */
	rewrite?: { token: string; disposition: "rewrite" | "neutralize"; rewriteTo?: string; annotation: string };
}

interface CouplingRule {
	pattern: RegExp;
	message: string;
	cls: RuntimeCouplingClass;
}

/**
 * Literal command/env patterns. `$CLAUDE_*` / `$ANTHROPIC_*` are handled via the
 * env-var table below (so each occurrence carries a rewrite disposition); the two
 * CLI patterns stay detect-only (no safe portable rewrite exists for a command
 * assumption — it is neutralized or fails per file class).
 */
export const RUNTIME_COUPLING_PATTERNS: ReadonlyArray<CouplingRule> = [
	{ pattern: /\bnpx\s+claude\b/i, message: "contains a Claude Code command assumption", cls: "claude-cli" },
	{
		pattern: /\bclaude\s+(?:--|mcp|doctor|update)\b/i,
		message: "contains a Claude Code command assumption",
		cls: "claude-cli",
	},
];

// Source references are only coupling errors when the fence-aware classifier
// did NOT deliberately decide to keep them (citation, fenced runtime command,
// merged/non-directory target). Unexplained ones still hard-fail.
const SOURCE_REFERENCE_CHECKS: Array<{ makePattern: () => RegExp; message: string; cls: RuntimeCouplingClass }> = [
	{ makePattern: sourceReferencePattern, message: "contains a .claude/ path reference", cls: "claude-path" },
	{ makePattern: sourceConfigTokenPattern, message: "contains a CLAUDE.md reference", cls: "claude-config-token" },
];

export function findRuntimeCouplingMatches(
	content: string,
	occurrences: ReferenceOccurrence[] = [],
): RuntimeCouplingMatch[] {
	const matches: RuntimeCouplingMatch[] = [];

	// Env vars: one match per DISTINCT token so per-pattern verdicts stay granular.
	const seenTokens = new Set<string>();
	for (const found of content.matchAll(envVarTokenPattern())) {
		const token = found[0];
		if (seenTokens.has(token)) continue;
		seenTokens.add(token);
		const resolution = resolveEnvVar(token);
		if (!resolution) continue;
		const isAnthropic = /^\$\{?ANTHROPIC_/.test(token);
		matches.push({
			message: isAnthropic
				? "contains an Anthropic-specific environment variable"
				: "contains a Claude-specific environment variable",
			cls: "claude-env-var",
			rewrite: { token, ...resolution },
		});
	}

	for (const rule of RUNTIME_COUPLING_PATTERNS) {
		if (rule.pattern.test(content)) matches.push({ message: rule.message, cls: rule.cls });
	}
	for (const check of SOURCE_REFERENCE_CHECKS) {
		for (const match of content.matchAll(check.makePattern())) {
			if (!isExplainedReference(match[0], occurrences)) {
				matches.push({ message: check.message, cls: check.cls });
				break;
			}
		}
	}
	return matches;
}
