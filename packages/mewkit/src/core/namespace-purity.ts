// Source namespace-purity guardrails for `mewkit validate` — encode the failure
// modes that bit the toolkit's prior namespaced-distribution experiment so they
// cannot silently regress even though the distribution machinery itself is gone:
//   1. Agent `name:` frontmatter stays bare (a namespaced agent name would be a
//      leftover from a namespaced-runtime experiment and is never valid source).
//   2. Skill `name:` frontmatter stays `mk:`-scoped (catch a stray non-`mk:`
//      namespace leak).
//   3. Every `subagent_type` reference resolves to a real kit agent or a
//      built-in host agent type.
import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../commands/validate.js";
import type { Status } from "./../commands/doctor-checks.js";

const SECTION = "Plugin" as const;

/** Plugin name prefix historically used to scope skill names (e.g. `mk:cook`). */
const PLUGIN_NAME = "mk";

/**
 * Built-in agent types the host runtime provides. References to these are always
 * bare — they are not kit agents and are never namespaced.
 */
export const BUILTIN_AGENT_TYPES = new Set<string>(["Explore", "Bash", "general-purpose", "Plan"]);

/** First `name:` value in a markdown file's YAML frontmatter, or null. */
function readFrontmatterName(filePath: string): string | null {
	let text: string;
	try {
		text = fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
	const match = text.match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m);
	return match ? match[1].trim() : null;
}

/** Read the bare `name:` frontmatter value from each agent file in a dir. */
export function collectAgentNames(agentsDir: string): Set<string> {
	const names = new Set<string>();
	let entries: string[];
	try {
		entries = fs.readdirSync(agentsDir);
	} catch {
		return names;
	}
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const name = readFrontmatterName(path.join(agentsDir, entry));
		if (name) names.add(name);
	}
	return names;
}

/** Walk a directory yielding every file path. */
function* walk(dir: string): Generator<string> {
	if (!fs.existsSync(dir)) return;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (entry.isFile()) yield full;
	}
}

/** Source namespace purity — agents bare, skills `mk:`, refs resolvable. */
export function checkPluginNamespace(claudeDir: string): CheckResult[] {
	const results: CheckResult[] = [];
	const agentNames = collectAgentNames(path.join(claudeDir, "agents"));

	// Agent names must be bare — a namespaced agent name is never valid source.
	const prefixedAgents = [...agentNames].filter((n) => n.includes(":"));
	results.push({
		name: "Agent names are bare",
		status: prefixedAgents.length === 0 ? "pass" : "fail",
		detail:
			prefixedAgents.length === 0
				? `${agentNames.size} agents, none namespaced`
				: `unexpectedly namespaced: ${prefixedAgents.join(", ")}`,
		section: SECTION,
	});

	// Skill names must be `mk:`-scoped (catch a non-`mk:` namespace leak).
	const skillsDir = path.join(claudeDir, "skills");
	const leaked: string[] = [];
	if (fs.existsSync(skillsDir)) {
		for (const dirent of fs.readdirSync(skillsDir, { withFileTypes: true })) {
			if (!dirent.isDirectory()) continue;
			const skillFile = path.join(skillsDir, dirent.name, "SKILL.md");
			if (!fs.existsSync(skillFile)) continue;
			const m = fs.readFileSync(skillFile, "utf-8").match(/^name:\s*["']?([^"'\r\n]+)/m);
			if (m && !m[1].trim().startsWith(`${PLUGIN_NAME}:`)) leaked.push(`${dirent.name} → ${m[1].trim()}`);
		}
	}
	results.push({
		name: "Skill names are mk:-scoped",
		status: leaked.length === 0 ? "pass" : "fail",
		detail: leaked.length === 0 ? "no namespace leaks" : `non-mk: skill names: ${leaked.join("; ")}`,
		section: SECTION,
	});

	// Every subagent_type ref must resolve to a kit agent or a built-in.
	const allowed = new Set<string>([...agentNames, ...BUILTIN_AGENT_TYPES]);
	const stray: string[] = [];
	const refRe = /subagent_type\s*[:=]\s*["']?([A-Za-z][A-Za-z0-9-]*)/g;
	for (const file of walk(skillsDir)) {
		if (!/\.(md|sh|cjs|mjs|js|ts|py)$/.test(file)) continue;
		const text = fs.readFileSync(file, "utf-8");
		let match: RegExpExecArray | null;
		while ((match = refRe.exec(text)) !== null) {
			const ref = match[1];
			if (!allowed.has(ref) && !ref.startsWith(`${PLUGIN_NAME}:`)) {
				stray.push(`${path.relative(claudeDir, file)} → ${ref}`);
			}
		}
	}
	results.push({
		name: "subagent_type refs resolve",
		status: stray.length === 0 ? "pass" : "warn",
		detail:
			stray.length === 0 ? "all refs are kit agents or built-ins" : `unknown refs: ${stray.slice(0, 5).join("; ")}`,
		section: SECTION,
	});

	return results;
}

export type { Status };
