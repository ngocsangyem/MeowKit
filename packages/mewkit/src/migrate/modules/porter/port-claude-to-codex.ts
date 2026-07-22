// One-time porter: convert the authored `.claude/` tree into the correct Codex
// shapes for the hand-authored `modules/codex/` bundle. This is NOT the runtime
// converter — it emits checked-in authored files (to be hand-refined), grounded in
// the official Codex API:
//   - agents  → `.codex/agents/<name>.toml`  (name, description, developer_instructions)
//   - skills  → `.agents/skills/<name>/SKILL.md` (Codex uses the same SKILL.md format)
//   - commands/rules/modes → Codex skills (Codex has no command/rules surface for
//     arbitrary markdown; they become discoverable skills, prefixed to avoid clashes)
// Content is preserved; only Claude-specific tokens are neutralized (reusing the
// existing adapter rules) and memory paths point at the runtime-neutral `.meowkit/`.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseFrontmatter } from "../../frontmatter-parser.js";
import { applyCodexAdapters } from "../../providers/codex/adapter-map.js";

export interface PortSummary {
	agents: number;
	skills: number;
	commands: number;
	rules: number;
	modes: number;
}

/** Neutralize Claude-isms + point memory at `.meowkit/`. Reuses the adapter rules
 *  for TOOL tokens only — path rewrites run FIRST here so the specific `.meowkit/`
 *  memory mapping wins over the adapters' generic `.claude/`→`.agents/` path rule. */
export function neutralize(body: string): string {
	const paths = body
		.replace(/\.claude\/memory/g, ".meowkit/memory")
		.replace(/\.claude\/agents/g, ".codex/agents")
		.replace(/\.claude\/skills/g, ".agents/skills")
		.replace(/\.claude\/hooks/g, ".codex/hooks");
	return applyCodexAdapters(paths, { kinds: ["tool"] });
}

/** Collapse a (possibly multi-line YAML block) description to a single trimmed line. */
export function flattenDescription(value: unknown): string {
	return String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

/** Escape a body for a TOML triple-quoted (`"""`) string. */
function tomlMultiline(body: string): string {
	// Escape backslashes, then any run of 3+ quotes so it can't close the literal.
	return body.replace(/\\/g, "\\\\").replace(/"{3,}/g, (m) => m.replace(/"/g, '\\"'));
}

/** Port one `.claude/agents/<name>.md` to a Codex agent TOML. Returns null for a
 *  markdown file that is not an agent (no `name:` frontmatter — e.g. an index doc). */
export function portAgent(srcMd: string): { name: string; toml: string } | null {
	const { frontmatter, body } = parseFrontmatter(srcMd);
	const fm = (frontmatter ?? {}) as Record<string, unknown>;
	if (!fm.name) return null;
	const name = String(fm.name);
	const description = flattenDescription(fm.description);
	const di = neutralize(body.trim());
	const lines = [`name = ${JSON.stringify(name)}`, `description = ${JSON.stringify(description)}`];
	const crit = String(fm.criticality ?? "");
	if (crit === "high") lines.push(`model_reasoning_effort = "high"`);
	else if (crit === "low") lines.push(`model_reasoning_effort = "low"`);
	lines.push(`developer_instructions = """\n${tomlMultiline(di)}\n"""`);
	return { name, toml: `${lines.join("\n")}\n` };
}

/** Port a SKILL.md body: keep name (de-namespaced) + description; neutralize body. */
export function portSkillMd(srcMd: string, fallbackName: string): { name: string; content: string } {
	const { frontmatter, body } = parseFrontmatter(srcMd);
	const fm = (frontmatter ?? {}) as Record<string, unknown>;
	const name = String(fm.name ?? fallbackName).replace(/^mk:/, "");
	const description = flattenDescription(fm.description) || fallbackName;
	const header = `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\n---\n`;
	return { name, content: `${header}\n${neutralize(body.replace(/^\n+/, ""))}` };
}

function listMd(dir: string): string[] {
	return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")) : [];
}

/** Recursively collect every `*.md` file under `dir` (absolute paths). Used for
 *  commands, which are nested (e.g. `.claude/commands/mk/ship.md`). */
function walkMd(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walkMd(full));
		else if (entry.name.endsWith(".md")) out.push(full);
	}
	return out;
}

function writeFileTree(destDir: string, name: string, content: string): void {
	const skillDir = join(destDir, name);
	mkdirSync(skillDir, { recursive: true });
	writeFileSync(join(skillDir, "SKILL.md"), content, "utf-8");
}

/** Port every `.claude/` markdown surface into `outDir` (the modules/codex bundle). */
export function portAll(claudeDir: string, outDir: string): PortSummary {
	const summary: PortSummary = { agents: 0, skills: 0, commands: 0, rules: 0, modes: 0 };
	const agentsOut = join(outDir, "agents");
	const skillsOut = join(outDir, "skills");

	// Agents → .codex/agents/*.toml
	for (const file of listMd(join(claudeDir, "agents"))) {
		const ported = portAgent(readFileSync(join(claudeDir, "agents", file), "utf-8"));
		if (!ported) continue; // skip non-agent markdown (index/reference docs)
		mkdirSync(agentsOut, { recursive: true });
		writeFileSync(join(agentsOut, `${ported.name}.toml`), ported.toml, "utf-8");
		summary.agents++;
	}

	// Skills → .agents/skills/<name>/ (SKILL.md ported; references/scripts copied,
	// markdown neutralized in place).
	const skillsSrc = join(claudeDir, "skills");
	if (existsSync(skillsSrc)) {
		for (const entry of readdirSync(skillsSrc, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const srcSkillDir = join(skillsSrc, entry.name);
			const skillMdPath = join(srcSkillDir, "SKILL.md");
			if (!existsSync(skillMdPath)) continue;
			const { name, content } = portSkillMd(readFileSync(skillMdPath, "utf-8"), entry.name);
			const destSkillDir = join(skillsOut, name);
			// Copy the whole skill dir (references/scripts/assets), then overwrite SKILL.md
			// with the ported version and neutralize markdown references.
			cpSync(srcSkillDir, destSkillDir, { recursive: true });
			writeFileSync(join(destSkillDir, "SKILL.md"), content, "utf-8");
			neutralizeMarkdownTree(destSkillDir);
			summary.skills++;
		}
	}

	// Commands (nested under commands/**) / rules / modes → Codex skills, prefixed
	// to avoid namespace clashes with real skills.
	summary.commands = portAsSkills(walkMd(join(claudeDir, "commands")), skillsOut, "command-");
	summary.rules = portAsSkills(
		[...walkMd(join(claudeDir, "rules")), ...walkMd(join(claudeDir, "rules-conditional"))],
		skillsOut,
		"rule-",
	);
	summary.modes = portAsSkills(walkMd(join(claudeDir, "modes")), skillsOut, "mode-");
	return summary;
}

/** Port a set of `*.md` guidance files (absolute paths) into one skill each. */
function portAsSkills(files: string[], skillsOut: string, prefix: string): number {
	let count = 0;
	for (const file of files) {
		const fallback = `${prefix}${basename(file, ".md")}`;
		const { content } = portSkillMd(readFileSync(file, "utf-8"), fallback);
		// Force the prefixed name so command-/rule-/mode- skills are namespaced + unique.
		const named = content.replace(/name: "[^"]*"/, `name: ${JSON.stringify(fallback)}`);
		writeFileTree(skillsOut, fallback, named);
		count++;
	}
	return count;
}

/** Neutralize every markdown file under a copied skill dir (references, docs). */
function neutralizeMarkdownTree(dir: string): void {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) neutralizeMarkdownTree(full);
		else if (entry.name.endsWith(".md") && entry.name !== "SKILL.md" && statSync(full).isFile()) {
			writeFileSync(full, neutralize(readFileSync(full, "utf-8")), "utf-8");
		}
	}
}
