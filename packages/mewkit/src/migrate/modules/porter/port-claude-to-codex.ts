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

/** Fully neutralize Claude-isms so the ported bundle is consistent with the Codex
 *  Harness — no residual `claude` mentions. Grounded in the Codex docs:
 *   - memory → runtime-neutral `.meowkit/` (never native `.codex/memory`)
 *   - `.claude/{agents,skills,hooks,rules,scripts,session-state,.env}` → Codex homes
 *   - `CLAUDE.md` → `AGENTS.md`; `CLAUDE_PROJECT_DIR` → `$(git rev-parse …)` (Codex
 *     exposes no such var); `CLAUDE_PLUGIN_ROOT/DATA` → Codex's `PLUGIN_ROOT/DATA`
 *   - product wording Claude(-Code) → Codex
 *   - tool/invocation tokens via the adapter rules (`/mk:` etc.)
 *  Order matters: specific rewrites precede catch-alls. */
export function neutralize(body: string): string {
	let out = body
		// Memory is runtime-neutral; must win over the generic `.claude/` catch-all.
		.replace(/\.claude\/memory/g, ".meowkit/memory")
		.replace(/\.claude\/agents/g, ".codex/agents")
		.replace(/\.claude\/skills/g, ".agents/skills")
		.replace(/\.claude\/hooks/g, ".codex/hooks")
		// Guidance rules were ported to `rule-*` Codex skills.
		.replace(/\.claude\/rules-conditional\//g, ".agents/skills/rule-")
		.replace(/\.claude\/rules\//g, ".agents/skills/rule-")
		.replace(/\.claude\/modes\//g, ".agents/skills/mode-")
		.replace(/\.claude\/scripts/g, ".codex/scripts")
		.replace(/\.claude\/session-state/g, ".codex/session-state")
		.replace(/\.claude\/\.env/g, ".codex/.env")
		// Any remaining `.claude/...` path or bare `.claude`.
		.replace(/\.claude\//g, ".codex/")
		.replace(/\.claude\b/g, ".codex");

	out = out
		.replace(/CLAUDE\.md/g, "AGENTS.md")
		.replace(/\$\{?CLAUDE_PROJECT_DIR\}?/g, "$(git rev-parse --show-toplevel)")
		.replace(/CLAUDE_PLUGIN_ROOT/g, "PLUGIN_ROOT")
		.replace(/CLAUDE_PLUGIN_DATA/g, "PLUGIN_DATA")
		.replace(/\$\{?CLAUDE_[A-Z0-9_]+\}?/g, "the project environment")
		.replace(/CLAUDE_[A-Z0-9_]+/g, "the project environment");

	out = out
		.replace(/claude-code/gi, "codex")
		.replace(/Claude Code/g, "Codex")
		.replace(/Claude['’]s/g, "Codex's")
		.replace(/\bClaude\b/g, "Codex")
		.replace(/\bclaude\b/g, "codex");

	out = applyCodexAdapters(out, { kinds: ["tool"] });

	// Case-preserving blanket catch-all for any remaining `claude` substring the
	// structured rules missed (e.g. inside identifiers like `claude_md_tokens` or
	// `claudekit`, where an underscore/letter blocks the word boundary). Runs LAST so
	// the structured rewrites above (CLAUDE.md→AGENTS.md, env vars, paths) win first.
	return out
		.replace(/CLAUDE/g, "CODEX")
		.replace(/Claude/g, "Codex")
		.replace(/claude/g, "codex");
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

// Codex reasoning-effort per source Claude `model:` tier. This mirrors each agent's
// Claude model assignment into Codex's per-agent knob: Claude selects a model id
// (opus/sonnet/haiku/fable), Codex model ids are deployment-specific so we do NOT
// emit one, but the reasoning-effort ladder IS portable. `inherit` (and any unmapped
// value) omits the key so the agent inherits Codex's configured default. The
// `.claude/agents/*.md` `model:` field is the single source — re-porting reproduces
// these values, so hand-edits to the bundle are unnecessary and would be overwritten.
const CODEX_EFFORT_BY_MODEL: Record<string, string> = {
	opus: "xhigh",
	fable: "xhigh",
	sonnet: "high",
	haiku: "medium",
};

/** Port one `.claude/agents/<name>.md` to a Codex agent TOML. Returns null for a
 *  markdown file that is not an agent (no `name:` frontmatter — e.g. an index doc). */
export function portAgent(srcMd: string): { name: string; toml: string } | null {
	const { frontmatter, body } = parseFrontmatter(srcMd);
	const fm = (frontmatter ?? {}) as Record<string, unknown>;
	if (!fm.name) return null;
	const name = String(fm.name);
	const description = neutralize(flattenDescription(fm.description));
	const di = neutralize(body.trim());
	const lines = [`name = ${JSON.stringify(name)}`, `description = ${JSON.stringify(description)}`];
	const effort = CODEX_EFFORT_BY_MODEL[String(fm.model ?? "").trim().toLowerCase()];
	if (effort) lines.push(`model_reasoning_effort = ${JSON.stringify(effort)}`);
	lines.push(`developer_instructions = """\n${tomlMultiline(di)}\n"""`);
	return { name, toml: `${lines.join("\n")}\n` };
}

/** Port a SKILL.md body: keep name (de-namespaced) + description; neutralize body. */
export function portSkillMd(srcMd: string, fallbackName: string): { name: string; content: string } {
	const { frontmatter, body } = parseFrontmatter(srcMd);
	const fm = (frontmatter ?? {}) as Record<string, unknown>;
	const name = String(fm.name ?? fallbackName).replace(/^mk:/, "");
	const description = neutralize(flattenDescription(fm.description) || fallbackName);
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
			// with the ported version and neutralize every text file (references AND
			// scripts — scripts reference `.claude/` paths that break on Codex).
			cpSync(srcSkillDir, destSkillDir, { recursive: true });
			writeFileSync(join(destSkillDir, "SKILL.md"), content, "utf-8");
			neutralizeTextTree(destSkillDir);
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

// Text extensions to neutralize under a copied skill dir (SKILL.md is already
// ported). Binary/asset files (images, sqlite, fonts) are left untouched.
const TEXT_EXTS = new Set([
	".md", ".markdown", ".txt", ".sh", ".bash", ".zsh", ".py", ".js", ".cjs", ".mjs",
	".ts", ".tsx", ".json", ".jsonl", ".yaml", ".yml", ".toml", ".env", ".example", ".cfg", ".ini",
]);

function hasTextExt(name: string): boolean {
	const dot = name.lastIndexOf(".");
	return dot >= 0 && TEXT_EXTS.has(name.slice(dot).toLowerCase());
}

/** Neutralize every text file (references, docs, AND scripts) under a copied skill
 *  dir so no `claude` reference survives. SKILL.md is skipped (already ported). */
function neutralizeTextTree(dir: string): void {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) neutralizeTextTree(full);
		else if (entry.name !== "SKILL.md" && hasTextExt(entry.name) && statSync(full).isFile()) {
			writeFileSync(full, neutralize(readFileSync(full, "utf-8")), "utf-8");
		}
	}
}
