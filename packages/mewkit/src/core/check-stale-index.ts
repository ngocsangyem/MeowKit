import fs from "node:fs";
import path from "node:path";
import { buildInventory, type InventoryEntry } from "./build-inventory.js";
import type { CheckResult } from "../commands/validate.js";

// Stale-index check. Compares the counts (and id completeness) DECLARED in
// README.md + the index files against the ACTUAL inventory from buildInventory.
// A count drift or a missing index row turns the build red with a precise diff.
// Discovery rules are NOT re-derived here — they come from buildInventory, so
// declared docs reconcile with reality by construction.

interface ActualCounts {
	skills: InventoryEntry[];
	agents: InventoryEntry[];
	commands: InventoryEntry[];
	rules: InventoryEntry[]; // rules/
	rulesConditional: InventoryEntry[]; // rules-conditional/
	hooks: InventoryEntry[];
}

function actualCounts(claudeDir: string): ActualCounts {
	const { entries } = buildInventory(claudeDir);
	const byType = (t: string) => entries.filter((e) => e.type === t);
	const rules = byType("rule");
	return {
		skills: byType("skill"),
		agents: byType("agent"),
		commands: byType("command"),
		rules: rules.filter((e) => e.path.startsWith("rules/")),
		rulesConditional: rules.filter((e) => e.path.startsWith("rules-conditional/")),
		hooks: byType("hook"),
	};
}

/** A single declared-vs-actual count claim found in a doc. */
export interface CountDiff {
	source: string;
	label: string;
	declared: number;
	actual: number;
}

/** A canonical count token: its file, a human label, the regex, and the truth. */
interface CountSpec {
	source: string;
	label: string;
	pattern: RegExp; // one capture group = the declared number; scanned globally
	actual: number;
}

function read(repoRoot: string, rel: string): string {
	const p = path.join(repoRoot, rel);
	return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
}

/** Build the list of count specifications anchored to each doc's real format. */
export function countSpecs(repoRoot: string): CountSpec[] {
	const claudeDir = path.join(repoRoot, ".claude");
	const a = actualCounts(claudeDir);
	return [
		{ source: "README.md", label: "skills", pattern: /(\d+)\s+skills/g, actual: a.skills.length },
		{ source: "README.md", label: "agents", pattern: /(\d+)\s+(?:specialist\s+)?agents/g, actual: a.agents.length },
		{ source: "README.md", label: "commands", pattern: /(\d+)\s+(?:slash\s+)?commands/g, actual: a.commands.length },
		{ source: "README.md", label: "rules", pattern: /(\d+)\s+(?:enforcement\s+)?rules/g, actual: a.rules.length },
		{ source: "README.md", label: "hook scripts", pattern: /(\d+)\s+hook scripts/g, actual: a.hooks.length },
		{
			source: "website/.vitepress/config.ts",
			label: "website skills",
			pattern: /(\d+)\+?\s+skills/g,
			actual: a.skills.length,
		},
		{
			source: "website/.vitepress/config.ts",
			label: "website agents",
			pattern: /(\d+)\s+agents/g,
			actual: a.agents.length,
		},
		{
			source: "website/workflows/new-project.md",
			label: "new-project skills",
			pattern: /(\d+)\s+skills/g,
			actual: a.skills.length,
		},
		{
			source: "website/workflows/new-project.md",
			label: "new-project agents",
			pattern: /(\d+)\s+agents/g,
			actual: a.agents.length,
		},
		{
			source: "website/reference/rules-index.md",
			label: "rules index agents",
			pattern: /all\s+(\d+)\s+agents/g,
			actual: a.agents.length,
		},
		{
			source: "website/reference/skills/lazy-agent-loader.md",
			label: "lazy loader agents",
			pattern: /all\s+(\d+)\s+agents/g,
			actual: a.agents.length,
		},
		{
			source: "website/core-concepts/how-it-works.md",
			label: "how-it-works skills",
			pattern: /(\d+)\+?\s+skills/g,
			actual: a.skills.length,
		},
		{
			source: ".claude/agents/SKILLS_INDEX.md",
			label: "skills total",
			pattern: /\*\*Total\*\*\|\*\*(\d+)\*\*/g,
			actual: a.skills.length,
		},
		{
			source: ".claude/agents/AGENTS_INDEX.md",
			label: "agents index header",
			pattern: /\[(\d+)\]\{agent_file/g,
			actual: a.agents.length,
		},
		{
			source: ".claude/hooks/HOOKS_INDEX.md",
			label: "shell hooks",
			pattern: /(\d+)\s+shell hook/g,
			actual: a.hooks.length,
		},
		// docs/core/meowkit-architecture.md — the UNDATED overview prose only. The dated
		// "Component Inventory (Verified …)" table below it is a historical snapshot and is
		// intentionally NOT count-generated (bumping it would falsify the audit record).
		{
			source: "docs/core/meowkit-architecture.md",
			label: "arch overview skills",
			pattern: /(\d+)\s+domain skills/g,
			actual: a.skills.length,
		},
		{
			source: "docs/core/meowkit-architecture.md",
			label: "arch overview rules",
			pattern: /(\d+)\s+rule files/g,
			actual: a.rules.length,
		},
	];
}

/** Parse declared counts and diff them against the inventory. */
export function compareCounts(repoRoot: string): CountDiff[] {
	const diffs: CountDiff[] = [];
	for (const spec of countSpecs(repoRoot)) {
		const body = read(repoRoot, spec.source);
		const matches = [...body.matchAll(spec.pattern)];
		if (matches.length === 0) {
			// A count token that cannot be found is itself a failure — never pass-on-no-match.
			diffs.push({ source: spec.source, label: `${spec.label} (token not found)`, declared: -1, actual: spec.actual });
			continue;
		}
		for (const m of matches) {
			const declared = Number(m[1]);
			if (declared !== spec.actual) {
				diffs.push({ source: spec.source, label: spec.label, declared, actual: spec.actual });
			}
		}
	}
	return diffs;
}

/** Completeness: every artifact id must appear in its index file. */
export function missingRows(repoRoot: string): { source: string; type: string; missingIds: string[] }[] {
	const claudeDir = path.join(repoRoot, ".claude");
	const a = actualCounts(claudeDir);
	const out: { source: string; type: string; missingIds: string[] }[] = [];

	const skillsIndex = read(repoRoot, ".claude/agents/SKILLS_INDEX.md");
	const missSkills = a.skills.filter((e) => !skillsIndex.includes(e.id)).map((e) => e.id);
	if (missSkills.length > 0)
		out.push({ source: ".claude/agents/SKILLS_INDEX.md", type: "skill", missingIds: missSkills });

	const agentsIndex = read(repoRoot, ".claude/agents/AGENTS_INDEX.md");
	const missAgents = a.agents.filter((e) => !agentsIndex.includes(e.id)).map((e) => e.id);
	if (missAgents.length > 0)
		out.push({ source: ".claude/agents/AGENTS_INDEX.md", type: "agent", missingIds: missAgents });

	const hooksIndex = read(repoRoot, ".claude/hooks/HOOKS_INDEX.md");
	const missHooks = a.hooks.filter((e) => !hooksIndex.includes(e.id)).map((e) => e.id);
	if (missHooks.length > 0) out.push({ source: ".claude/hooks/HOOKS_INDEX.md", type: "hook", missingIds: missHooks });

	return out;
}

/** Full stale-index check → CheckResults under the "Inventory" section. */
export function checkStaleIndex(repoRoot: string): CheckResult[] {
	const results: CheckResult[] = [];

	const diffs = compareCounts(repoRoot);
	for (const d of diffs) {
		const declared = d.declared < 0 ? "not found" : String(d.declared);
		results.push({
			name: `Count drift: ${d.source} (${d.label})`,
			status: "fail",
			detail: `declared ${declared}, found ${d.actual}`,
			section: "Inventory",
		});
	}

	const missing = missingRows(repoRoot);
	for (const m of missing) {
		results.push({
			name: `Index incomplete: ${m.source}`,
			status: "fail",
			detail: `${m.missingIds.length} ${m.type}(s) missing: ${m.missingIds.join(", ")}`,
			section: "Inventory",
		});
	}

	if (diffs.length === 0 && missing.length === 0) {
		results.push({
			name: "Index counts & completeness",
			status: "pass",
			detail: "README + index files match the inventory",
			section: "Inventory",
		});
	}
	return results;
}

/**
 * Rewrite ONLY the count number tokens in README + index headers to match the
 * inventory. Curated index prose/rows are never touched. Returns the files it
 * changed. Missing completeness rows are reported by the check, never auto-filled.
 */
export function emitCounts(repoRoot: string): string[] {
	const changed = new Set<string>();
	// Group specs by source so each file is read/written once.
	const bySource = new Map<string, CountSpec[]>();
	for (const spec of countSpecs(repoRoot)) {
		const list = bySource.get(spec.source) ?? [];
		list.push(spec);
		bySource.set(spec.source, list);
	}
	for (const [source, specs] of bySource) {
		const abs = path.join(repoRoot, source);
		if (!fs.existsSync(abs)) continue;
		const body = fs.readFileSync(abs, "utf-8");
		let next = body;
		for (const spec of specs) {
			next = next.replace(spec.pattern, (full, num) => full.replace(num, String(spec.actual)));
		}
		if (next !== body) {
			fs.writeFileSync(abs, next);
			changed.add(source);
		}
	}
	return [...changed];
}
