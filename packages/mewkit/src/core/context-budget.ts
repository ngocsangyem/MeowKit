// Lightweight per-profile context-budget estimator. Sums line counts and a cheap
// token estimate (chars/4) over a profile's *loadable* set — the rules, skill
// SKILL.md entrypoints, agents, and commands the model pulls into context — NOT
// every reference/script/asset file (those load on demand). Proves "core is small
// and auditable" and backs the CI guardrail. Read-only; no untrusted exec.
//
// Loadable files split across three tiers by HOW the harness loads them:
//   - always-on:  CLAUDE.md + rules/*.md           — auto-loaded every session
//   - conditional: rules-conditional/*.md           — loaded by agent-detector only
//                                                      when its trigger fires (e.g. Agile)
//   - on-demand:  agents, commands, SKILL.md        — loaded when the artifact activates
// All three count toward the budget total; the tier split makes the always-on
// floor visible separately so a conditional/on-demand file is not miscounted as
// permanently resident.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPackManifest } from "./pack-manifest.js";
import { resolveProfile } from "./pack-resolver.js";

export type ContextTier = "always-on" | "conditional" | "on-demand";

export interface TierAggregate {
	files: number;
	lines: number;
	tokens: number;
}

export interface ContextBudgetReport {
	profile: string;
	files: number;
	lines: number;
	tokens: number;
	/**
	 * Per-tier breakdown. Tier `files`/`lines` sum exactly to the top-level
	 * aggregates; tier `tokens` may differ from the top-level total by a few
	 * tokens because the total rounds chars/4 once while tiers round per file.
	 */
	tiers: Record<ContextTier, TierAggregate>;
}

/**
 * Classify a profile-relative path into the load tier the harness uses for it,
 * or `null` when the path is an on-demand reference/script/asset that never
 * enters context as a loadable entrypoint.
 */
export function classifyTier(relPath: string): ContextTier | null {
	if (relPath === "CLAUDE.md") return "always-on";
	if (/^rules\/.+\.md$/.test(relPath)) return "always-on";
	if (/^rules-conditional\/.+\.md$/.test(relPath)) return "conditional";
	if (/^agents\/(?!.*_INDEX\.md$).+\.md$/.test(relPath)) return "on-demand";
	if (/^commands\/mk\/.+\.md$/.test(relPath)) return "on-demand";
	if (/^skills\/[^/]+\/SKILL\.md$/.test(relPath)) return "on-demand";
	return null;
}

/** A path the model loads into context (vs. on-demand references/scripts/assets). */
function isLoadable(relPath: string): boolean {
	return classifyTier(relPath) !== null;
}

function emptyTier(): TierAggregate {
	return { files: 0, lines: 0, tokens: 0 };
}

/** Estimate the loadable context size for a profile, split by load tier. */
export function computeContextBudget(claudeDir: string, profile: string): ContextBudgetReport {
	const manifest = loadPackManifest(claudeDir);
	const paths = [...resolveProfile(claudeDir, manifest, profile)].filter(isLoadable);
	const tiers: Record<ContextTier, TierAggregate> = {
		"always-on": emptyTier(),
		conditional: emptyTier(),
		"on-demand": emptyTier(),
	};
	let lines = 0;
	let chars = 0;
	for (const rel of paths) {
		const tier = classifyTier(rel);
		if (tier === null) continue; // already filtered, but keeps the type narrow
		// CLAUDE.md lives at the project root, not inside .claude/.
		const abs = rel === "CLAUDE.md" ? join(claudeDir, "..", "CLAUDE.md") : join(claudeDir, rel);
		try {
			const body = readFileSync(abs, "utf-8");
			const fileLines = body.split("\n").length;
			lines += fileLines;
			chars += body.length;
			tiers[tier].files += 1;
			tiers[tier].lines += fileLines;
			tiers[tier].tokens += Math.ceil(body.length / 4);
		} catch {
			// unreadable/absent loadable file — skip; resolution already validated membership
		}
	}
	return { profile, files: paths.length, lines, tokens: Math.ceil(chars / 4), tiers };
}
