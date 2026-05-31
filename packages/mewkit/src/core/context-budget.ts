// Lightweight per-profile context-budget estimator. Sums line counts and a cheap
// token estimate (chars/4) over a profile's *loadable* set — the always-on rules,
// skill SKILL.md entrypoints, agents, and commands the model pulls into context —
// NOT every reference/script/asset file (those load on demand). Proves "core is
// small and auditable" and backs the CI guardrail. Read-only; no untrusted exec.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPackManifest } from "./pack-manifest.js";
import { resolveProfile } from "./pack-resolver.js";

export interface ContextBudgetReport {
	profile: string;
	files: number;
	lines: number;
	tokens: number;
}

/** A path the model loads into context (vs. on-demand references/scripts/assets). */
function isLoadable(path: string): boolean {
	if (path === "CLAUDE.md") return true;
	if (/^rules\/.+\.md$/.test(path)) return true;
	if (/^rules-conditional\/.+\.md$/.test(path)) return true;
	if (/^agents\/(?!.*_INDEX\.md$).+\.md$/.test(path)) return true;
	if (/^commands\/mk\/.+\.md$/.test(path)) return true;
	if (/^skills\/[^/]+\/SKILL\.md$/.test(path)) return true;
	return false;
}

/** Estimate the loadable context size for a profile. */
export function computeContextBudget(claudeDir: string, profile: string): ContextBudgetReport {
	const manifest = loadPackManifest(claudeDir);
	const paths = [...resolveProfile(claudeDir, manifest, profile)].filter(isLoadable);
	let lines = 0;
	let chars = 0;
	for (const rel of paths) {
		// CLAUDE.md lives at the project root, not inside .claude/.
		const abs = rel === "CLAUDE.md" ? join(claudeDir, "..", "CLAUDE.md") : join(claudeDir, rel);
		try {
			const body = readFileSync(abs, "utf-8");
			lines += body.split("\n").length;
			chars += body.length;
		} catch {
			// unreadable/absent loadable file — skip; resolution already validated membership
		}
	}
	return { profile, files: paths.length, lines, tokens: Math.ceil(chars / 4) };
}
