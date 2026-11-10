#!/usr/bin/env node
/**
 * Keep `.claude/skills` projectable to other runtimes.
 *
 *   node scripts/check-skills-portable.cjs [projectRoot]
 *
 * Scans the markdown of every skill (frontmatter excluded) and reports `file:line` for:
 *   - own-path      a skill naming its own directory as `.claude/skills/<self>/…`; use a path
 *                   relative to the skill root for documents and `${CLAUDE_SKILL_DIR}/…` for
 *                   scripts it runs
 *   - missing       a skill-relative or `${CLAUDE_SKILL_DIR}` path, or a kit path, that does not
 *                   resolve to a file or directory the kit ships
 *   - unknown-class a `.claude/<surface>` reference outside the declared classes
 *   - unlisted-tool a Claude Code tool name mentioned in a skill but absent from
 *                   `.claude/kit-capabilities.json`
 *   - skill-dir-var `${CLAUDE_SKILL_DIR}` outside SKILL.md. Claude Code substitutes it only in
 *                   SKILL.md and does not export it to the shell, so elsewhere it stays literal
 *   - no-anchor     a skill whose other files run its own `scripts/…` or `bin/…` by relative path
 *                   while its SKILL.md never names `${CLAUDE_SKILL_DIR}`, the directory they
 *                   resolve against
 *
 * Classes of `.claude/` reference: rules, agents, hooks, skills (another skill), kit data files
 * (`kit-capabilities.json`, `kit-contract.json`), and state —
 * paths a project writes or configures at run time, which are not kit files.
 *
 * A line containing `portable-ignore` is skipped (for illustrative paths of other projects).
 * `missing` references that predate this check are recorded in
 * `scripts/skills-portable-baseline.json` (by file and target, not line) and tolerated; any new
 * one fails. Fixing a baselined reference and dropping its entry is always safe.
 * Code files are not scanned: scripts, hook commands and YAML need real paths at run time.
 */

const fs = require("fs");
const path = require("path");
const { excludeMatcher, shipSetExclusions } = require("./kit-ship-set.cjs");

const KIT_CLASSES = new Set(["rules", "agents", "hooks", "skills"]);
/** Kit-level data files at the top of `.claude/`, checked for existence like the classes above. */
const KIT_FILES = new Set(["kit-capabilities.json", "kit-contract.json"]);
/** Project run-time paths under `.claude/`; referenced by skills, never shipped by the kit. */
const STATE_SURFACES = new Set([
	"benchmarks",
	"logs",
	"packs",
	"plans",
	"product-areas.yaml",
	".mcp.json",
	"settings.local.json",
	"settings.json",
	"mcp.json.example",
	"data",
	"commands",
	"projects",
	"memory",
	"session-state",
	"worktrees",
	"metadata.json",
	"cache",
	"agent-memory",
]);

/** Claude Code built-in tool names (code.claude.com/docs/en/tools-reference), plus legacy `Task` and `MultiEdit`. */
const CLAUDE_TOOLS = new Set([
	"Agent",
	"AskUserQuestion",
	"Bash",
	"CronCreate",
	"CronDelete",
	"CronList",
	"Edit",
	"EnterPlanMode",
	"EnterWorktree",
	"ExitPlanMode",
	"ExitWorktree",
	"Glob",
	"Grep",
	"LSP",
	"ListMcpResourcesTool",
	"Monitor",
	"MultiEdit",
	"NotebookEdit",
	"PowerShell",
	"Read",
	"ReadMcpResourceTool",
	"SendMessage",
	"Skill",
	"Task",
	"TaskCreate",
	"TaskGet",
	"TaskList",
	"TaskOutput",
	"TaskStop",
	"TaskUpdate",
	"TodoWrite",
	"ToolSearch",
	"WebFetch",
	"WebSearch",
	"Write",
]);

const SKILL_DIR_VAR = "${CLAUDE_SKILL_DIR}";
const KIT_REF = /(^|[^\w/.$~}-])\.claude\/([A-Za-z0-9_.-]+)(\/[^\s`"'()<>\]|,;:*{}]*)?/g;
/**
 * Project-root spellings of a kit path. KIT_REF skips `.claude` after `/`, `.`, `$` or `}` so a
 * home or foreign tree is not read as this kit, which would also skip these; they are folded to
 * the bare form before scanning so `./.claude/…` and `${CLAUDE_PROJECT_DIR}/.claude/…` are checked.
 */
const PROJECT_ROOT_PREFIX = /(^|[^\w/.$~}-])(?:\$\{CLAUDE_PROJECT_DIR\}\/|\$CLAUDE_PROJECT_DIR\/|\.\/)(?=\.claude\/)/g;
const SKILL_DIR_REF = /\$\{CLAUDE_SKILL_DIR\}\/([^\s`"'()<>\]|,;*{}]+)/g;
/** Backticked or markdown-link targets that may be skill-relative paths. */
const CANDIDATE_PATH = /`([A-Za-z0-9_.-]+\/[^\s`]*)`|\]\(([A-Za-z0-9_.-]+(?:\/[^\s)#]*)?)(?:#[^)]*)?\)/g;
const TOOL_MENTION = /`([A-Z][A-Za-z]+)(?:\([^`]*\))?`|\b([A-Z][A-Za-z]+)\(/g;
/** A skill-relative executable path as a command line names it, outside backticks too. */
const RUN_PATH = /(?:^|[\s"'(=])((?:scripts|bin)\/[A-Za-z0-9_./-]+\.(?:cjs|mjs|js|py|sh|ts))(?![\w-])/g;

function listMarkdown(dir) {
	const out = [];
	const walk = (abs) => {
		for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
			if (entry.name === "node_modules" || entry.name === ".venv" || entry.name === "__pycache__") continue;
			const full = path.join(abs, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
		}
	};
	walk(dir);
	return out.sort();
}

/** Body lines with their 1-based numbers; a leading `---` frontmatter block is dropped. */
function bodyLines(text) {
	const lines = text.split("\n");
	let start = 0;
	if (lines[0] === "---") {
		const end = lines.indexOf("---", 1);
		if (end > 0) start = end + 1;
	}
	return lines.slice(start).map((line, i) => ({ line, number: start + i + 1 }));
}

/** Strip a trailing sentence period or anchor and normalise a referenced path. */
function cleanRef(ref) {
	return ref.replace(/#.*$/, "").replace(/[.]+$/, "");
}

/** Whether the path names a placeholder (`<name>`, `{x}`, `*`, `…`) rather than a real file. */
function isPlaceholder(ref) {
	return /[<>{}*…$]|\.\.\.|XX|YYMMDD/.test(ref);
}

function createContext(root) {
	const isExcluded = excludeMatcher(shipSetExclusions(root));
	const shipped = (rel) => {
		const abs = path.join(root, rel);
		if (!fs.existsSync(abs)) return false;
		return !isExcluded(rel.split(path.sep).join("/").replace(/\/$/, ""));
	};
	let tools = {};
	const capabilitiesFile = path.join(root, ".claude", "kit-capabilities.json");
	if (fs.existsSync(capabilitiesFile)) tools = JSON.parse(fs.readFileSync(capabilitiesFile, "utf8")).tools || {};
	return { root, shipped, tools };
}

/** Returns whether a non-SKILL.md file runs one of the skill's own scripts by relative path. */
function checkFile(ctx, file, violations, toolsSeen) {
	const rel = path.relative(ctx.root, file).split(path.sep).join("/");
	const self = rel.split("/")[2];
	const skillRoot = `.claude/skills/${self}`;
	const isSkillMd = rel === `${skillRoot}/SKILL.md`;
	const children = new Set(fs.readdirSync(path.join(ctx.root, skillRoot)));
	const report = (number, kind, message, target) => violations.push({ file: rel, line: number, kind, message, target });
	let runsRelative = false;

	for (const { line: raw, number } of bodyLines(fs.readFileSync(file, "utf8"))) {
		if (raw.includes("portable-ignore")) continue;
		const line = raw.replace(PROJECT_ROOT_PREFIX, "$1");

		if (!isSkillMd && line.includes(SKILL_DIR_VAR)) {
			report(
				number,
				"skill-dir-var",
				`${SKILL_DIR_VAR} is substituted only in SKILL.md — use a path relative to the skill root`,
			);
		}
		if (!isSkillMd) {
			for (const m of line.matchAll(RUN_PATH)) {
				const ref = cleanRef(m[1]);
				if (!children.has(ref.split("/")[0]) || isPlaceholder(ref)) continue;
				runsRelative = true;
				const target = `${skillRoot}/${ref}`;
				if (!ctx.shipped(target))
					report(number, "missing", `${ref} (relative to ${skillRoot}) is not shipped by the kit`, target);
			}
		}

		for (const m of line.matchAll(KIT_REF)) {
			const surface = m[2];
			const rest = m[3] || "";
			if (m[1] === "~" || line.slice(Math.max(0, m.index - 6), m.index + 1).includes("HOME")) continue;
			if (surface === "skills" && rest.startsWith(`/${self}/`)) {
				report(
					number,
					"own-path",
					`.claude/skills${rest} — use a skill-relative path, or ${SKILL_DIR_VAR}/… for a command`,
				);
				continue;
			}
			if (STATE_SURFACES.has(surface)) continue;
			if (KIT_FILES.has(surface)) {
				if (!ctx.shipped(`.claude/${surface}`))
					report(number, "missing", `.claude/${surface} is not shipped by the kit`, `.claude/${surface}`);
				continue;
			}
			if (!KIT_CLASSES.has(surface)) {
				report(number, "unknown-class", `.claude/${surface} is not a declared reference class`);
				continue;
			}
			const target = cleanRef(`.claude/${surface}${rest}`);
			if (rest.length > 1 && !isPlaceholder(target) && !ctx.shipped(target)) {
				report(number, "missing", `${target} is not shipped by the kit`, target);
			}
		}

		for (const m of line.matchAll(SKILL_DIR_REF)) {
			const target = cleanRef(`${skillRoot}/${m[1]}`);
			if (!isPlaceholder(target) && !ctx.shipped(target))
				report(number, "missing", `${SKILL_DIR_VAR}/${m[1]} is not shipped by the kit`, target);
		}

		for (const m of line.matchAll(CANDIDATE_PATH)) {
			const ref = cleanRef(m[1] || m[2] || "");
			const first = ref.split("/")[0];
			if (!children.has(first) || isPlaceholder(ref) || first === "SKILL.md") continue;
			const target = `${skillRoot}/${ref}`;
			if (!ctx.shipped(target))
				report(number, "missing", `${ref} (relative to ${skillRoot}) is not shipped by the kit`, target);
		}

		for (const m of line.matchAll(TOOL_MENTION)) {
			const name = m[1] || m[2];
			if (!CLAUDE_TOOLS.has(name)) continue;
			toolsSeen.add(name);
			if (!(name in ctx.tools))
				report(number, "unlisted-tool", `${name} is not listed in .claude/kit-capabilities.json`);
		}
	}
	return runsRelative;
}

/** Baselined `missing` references, keyed `file -> target`. */
function readBaseline(file) {
	if (!file || !fs.existsSync(file)) return new Set();
	return new Set(JSON.parse(fs.readFileSync(file, "utf8")).missing.map((e) => `${e.file} -> ${e.target}`));
}

function checkSkillsPortable(root, { baselineFile } = {}) {
	const ctx = createContext(root);
	const baseline = readBaseline(baselineFile);
	const violations = [];
	const toolsSeen = new Set();
	const skillsDir = path.join(root, ".claude", "skills");
	const runsRelative = new Set();
	for (const file of listMarkdown(skillsDir)) {
		// Files at the top of `.claude/skills/` belong to no skill and have no skill root.
		if (path.dirname(file) === skillsDir) continue;
		// A file the kit does not ship (a dev-only skill, eval or test data) cannot break an install.
		if (!ctx.shipped(path.relative(root, file))) continue;
		if (checkFile(ctx, file, violations, toolsSeen))
			runsRelative.add(path.relative(skillsDir, file).split(path.sep)[0]);
	}
	for (const skill of [...runsRelative].sort()) {
		const skillMd = path.join(skillsDir, skill, "SKILL.md");
		if (fs.existsSync(skillMd) && fs.readFileSync(skillMd, "utf8").includes(SKILL_DIR_VAR)) continue;
		violations.push({
			file: `.claude/skills/${skill}/SKILL.md`,
			line: 1,
			kind: "no-anchor",
			message: `other files run scripts relative to the skill root, but SKILL.md never names ${SKILL_DIR_VAR}`,
		});
	}
	const tolerated = (v) => v.kind === "missing" && baseline.has(`${v.file} -> ${v.target}`);
	return { violations: violations.filter((v) => !tolerated(v)), toolsSeen: [...toolsSeen].sort() };
}

module.exports = { checkSkillsPortable, CLAUDE_TOOLS, STATE_SURFACES };

if (require.main === module) {
	const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
	const { violations } = checkSkillsPortable(root, {
		baselineFile: path.join(__dirname, "skills-portable-baseline.json"),
	});
	for (const v of violations) console.error(`${v.file}:${v.line}: [${v.kind}] ${v.message}`);
	if (violations.length > 0) {
		console.error(`\n${violations.length} portability violation(s) in .claude/skills.`);
		process.exit(1);
	}
	console.log("Skills are portable: no own-path, missing, unclassified or unlisted-tool references.");
}
