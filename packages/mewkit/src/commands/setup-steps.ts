import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import pc from "picocolors";
import { changeRecorder, type ChangeRecorder } from "../core/change-recorder.js";
import type { PlannedChange } from "../core/mutation-report.js";
import { ensureEnv, findPython, installPipPackages, verifyPackages } from "../core/dependency-installer.js";
import { formatPackageList } from "../core/skills-dependencies.js";
import { envSkills, readSkillRequirements, skillEnvDir } from "../core/skill-env.js";
// The ignore file and the shipped `.meowkit/` members are laid down by the
// installer too, so they are owned there and re-exported here for the callers
// that still reach for the constant.
import { KIT_DIR_GITIGNORE, writeKitDirGitignore } from "../core/install-meowkit-dir.js";

export { KIT_DIR_GITIGNORE };

export type StepName = "skill-envs" | "mcp" | "env" | "gitignore" | "project-context";

export interface StepResult {
	name: StepName;
	status: "pass" | "skip" | "fail" | "warn";
	message: string;
	/** Every file the step wrote, or would have written under `dryRun`. */
	changes?: PlannedChange[];
}

/** Options a step may read. */
export interface StepOptions {
	/** Skills the user named. Empty means create nothing — the default. */
	skills?: string[];
	/** Plan only: a step records what it would write and writes none of it. */
	dryRun?: boolean;
}

// Default file contents — used when .example files don't exist (no scaffold yet)
const DEFAULT_MCP = `{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}\n`;

const DEFAULT_ENV = `# MeowKit Environment Variables
# Never commit this file to git. Shell exports take precedence.

# Gemini (recommended — analysis, image gen, video gen)
# Get from: https://aistudio.google.com/apikey
MEOWKIT_GEMINI_API_KEY=

# MiniMax (optional — TTS, music, Hailuo video, image fallback)
# Get from: https://platform.minimax.io/
# MEOWKIT_MINIMAX_API_KEY=

# OpenRouter (optional — image gen fallback)
# Get from: https://openrouter.ai/keys
# MEOWKIT_OPENROUTER_API_KEY=
# MEOWKIT_OPENROUTER_FALLBACK_ENABLED=true
\n`;

// Mirrors `.meowkit/gitignore.meowkit`; used only when that template is absent.
// Nothing under `.meowkit/` appears here: `.meowkit/.gitignore` is authoritative
// for that directory, and a second description of the same paths in a second
// file is a second thing to keep in step.
const DEFAULT_GITIGNORE = `# MeowKit
.env
.env.local
session-state/
tasks/reports/
.claude/logs/
\n`;

/** Setup MCP configuration */
function setupMcp(projectDir: string, options: StepOptions = {}): StepResult {
	const mcpTarget = join(projectDir, ".mcp.json");
	const w = changeRecorder(projectDir, options.dryRun === true);

	if (existsSync(mcpTarget)) {
		return { name: "mcp", status: "skip", message: ".mcp.json already exists", changes: w.changes };
	}

	// Copy from example if available, otherwise create with defaults
	// Template moved into `.meowkit/`; an install made before the move still has the old copy.
	const canonicalMcpExample = join(projectDir, ".meowkit", "mcp.json.example");
	const mcpExample = existsSync(canonicalMcpExample)
		? canonicalMcpExample
		: join(projectDir, ".claude", "mcp.json.example");
	if (existsSync(mcpExample)) w.copy(mcpExample, mcpTarget);
	else w.write(mcpTarget, DEFAULT_MCP);
	return { name: "mcp", status: "pass", message: "Created .mcp.json — edit API keys inside.", changes: w.changes };
}

/** Setup `.meowkit/.env`. A pre-move `.claude/.env` still counts as configured — the loaders
 *  read both — so this never overwrites or duplicates an existing setup. */
function setupEnv(projectDir: string, options: StepOptions = {}): StepResult {
	const envTarget = join(projectDir, ".meowkit", ".env");
	const legacyEnv = join(projectDir, ".claude", ".env");
	const w = changeRecorder(projectDir, options.dryRun === true);

	for (const existing of [envTarget, legacyEnv]) {
		if (!existsSync(existing)) continue;
		if (readFileSync(existing, "utf-8").trim().length > 0) {
			return { name: "env", status: "skip", message: `${relative(projectDir, existing)} already exists`, changes: w.changes };
		}
	}

	w.mkdir(join(projectDir, ".meowkit"));
	w.write(envTarget, DEFAULT_ENV);
	return { name: "env", status: "pass", message: "Created .meowkit/.env — add your API keys.", changes: w.changes };
}

/**
 * Strip a stale `.meowkit/memory/` ignore line.
 *
 * In v2 the whole memory directory was gitignored. In v3 the store is COMMITTED and reviewed
 * in the PR diff — that is the entire replacement for the deleted approve gate. A project set
 * up by the previous version carries the old ignore line, and since it also carries the new
 * `.meowkit/telemetry/` line, the "already present" probe below returns `skip` and the stale
 * line survives forever. The premise then silently does not hold on exactly the installs that
 * have history worth reviewing.
 *
 * Only the memory line is touched, and only when it is an exact MeowKit-shaped ignore; an
 * explicit user negation (`!`) is left alone.
 */
export function stripStaleMemoryIgnore(content: string): { content: string; stripped: boolean } {
	const stale = /^\s*\.?\/?\.meowkit\/memory\/?\*{0,2}\s*$/;
	const lines = content.split("\n");
	const kept = lines.filter((line) => !stale.test(line));
	if (kept.length === lines.length) return { content, stripped: false };
	return { content: kept.join("\n"), stripped: true };
}

/**
 * Strip the per-class `.meowkit/*` ignores the deny-all file supersedes.
 *
 * Same shape and same reason as the memory-line strip above: a project set up by
 * the previous version carries lines that now describe the same paths twice, and
 * two descriptions of one path is one of them going stale. A line a user negated
 * with `!` is left alone — that is a decision, not a leftover.
 */
export function stripSupersededMeowkitIgnores(content: string): { content: string; stripped: string[] } {
	const superseded = /^\s*\.?\/?\.meowkit\/(?:telemetry|state|cache|envs|backups)\/?\*{0,2}\s*$|^\s*\.?\/?\.meowkit\/\.env\s*$/;
	const lines = content.split("\n");
	const stripped: string[] = [];
	const kept = lines.filter((line) => {
		if (line.trimStart().startsWith("!")) return true;
		if (!superseded.test(line)) return true;
		stripped.push(line.trim());
		return false;
	});
	if (stripped.length === 0) return { content, stripped };
	return { content: kept.join("\n"), stripped };
}

/** Setup both ignore files: the deny-all one for `.meowkit/`, and the root one. */
function setupGitignore(projectDir: string, options: StepOptions = {}): StepResult {
	const gitignore = join(projectDir, ".gitignore");
	const w = changeRecorder(projectDir, options.dryRun === true);
	const wroteInner = writeKitDirGitignore(projectDir, w.dryRun);
	const notes: string[] = [];
	if (wroteInner) {
		w.record("create", join(projectDir, ".meowkit", ".gitignore"));
		notes.push("Wrote .meowkit/.gitignore (deny-all + the shared allowlist)");
	}

	if (existsSync(gitignore)) {
		let content = readFileSync(gitignore, "utf-8");
		// BEFORE the skip: a stale or superseded line has to go even when everything else is present.
		const memory = stripStaleMemoryIgnore(content);
		if (memory.stripped) {
			content = memory.content;
			notes.push("Removed the stale .meowkit/memory/ ignore — the v3 team store is committed");
		}
		const superseded = stripSupersededMeowkitIgnores(content);
		if (superseded.stripped.length) {
			content = superseded.content;
			notes.push(`Removed ${superseded.stripped.length} .meowkit/ line(s) now covered by .meowkit/.gitignore`);
		}
		if (memory.stripped || superseded.stripped.length) w.write(gitignore, content);
		if (content.includes("session-state/")) {
			return {
				name: "gitignore",
				status: notes.length ? "pass" : "skip",
				message: notes.length ? notes.join("; ") : "MeowKit entries already in .gitignore",
				changes: w.changes,
			};
		}
	}

	// Read from the shipped template if it exists, otherwise use defaults.
	const meowkitIgnore = join(projectDir, ".meowkit", "gitignore.meowkit");
	const additions = existsSync(meowkitIgnore) ? readFileSync(meowkitIgnore, "utf-8") : DEFAULT_GITIGNORE;
	w.append(gitignore, `\n${additions}`);
	notes.push("Appended MeowKit entries to .gitignore");
	return { name: "gitignore", status: "pass", message: notes.join("; "), changes: w.changes };
}

/**
 * Create the interpreter environment for each skill the user NAMED, and nothing
 * else.
 *
 * Opt-in by default. Setup used to create one shared environment unconditionally
 * and install a merged set of every skill's dependencies into it, which meant a
 * project that used no Python skill still paid for Python, and a user who wanted
 * one skill got all of them. With no `--skills`, this step reports that it did
 * nothing and why.
 *
 * Each named skill gets exactly its own pins. There is no merged set and no
 * built-in default list to fall back on.
 */
async function setupSkillEnvs(projectDir: string, options: StepOptions = {}): Promise<StepResult> {
	const requested = options.skills ?? [];
	if (!requested.length) {
		return {
			name: "skill-envs",
			status: "skip",
			message: "No skills selected — pass --skills=<a,b> or run `mewkit skill env <skill>`",
		};
	}

	const declared = envSkills(projectDir);
	const unknown = requested.filter((skill) => !declared.includes(skill));
	if (unknown.length) {
		return {
			name: "skill-envs",
			status: "fail",
			message: `Not a skill that needs an environment: ${unknown.join(", ")}. Eligible: ${declared.join(", ") || "(none)"}`,
		};
	}

	if (!findPython()) {
		// Exits clean, creates nothing, and says why — an absent interpreter is a
		// reason to skip, not a reason to fail a setup that configured everything else.
		return {
			name: "skill-envs",
			status: "skip",
			message: `No Python interpreter in PATH — skipped ${requested.join(", ")}; install Python, then re-run`,
		};
	}

	const created: string[] = [];
	const installed: string[] = [];
	const w: ChangeRecorder = changeRecorder(projectDir, options.dryRun === true);
	for (const skill of requested) {
		const envDir = skillEnvDir(projectDir, skill);
		const req = readSkillRequirements(projectDir, skill);
		if (req.rejected.length) {
			return {
				name: "skill-envs",
				status: "fail",
				message: `${skill}: rejected requirement line(s): ${req.rejected.join(", ")} — nothing installed`,
			};
		}

		// A dry run reports the environment and the pins and creates neither: an
		// interpreter environment is the largest thing setup writes.
		if (w.dryRun) {
			if (!existsSync(envDir)) {
				w.record("create", envDir, "interpreter environment");
				created.push(skill);
			}
			if (req.packages.length) {
				w.record("install", envDir, `${req.packages.length} package(s) for ${skill}`);
				installed.push(`${skill} (${req.packages.length})`);
			}
			continue;
		}

		try {
			const { created: made, repaired } = ensureEnv(projectDir, envDir);
			if (made || repaired) {
				w.record("create", envDir, "interpreter environment");
				created.push(skill);
			}
		} catch (err) {
			return { name: "skill-envs", status: "fail", message: `${skill}: ${err instanceof Error ? err.message : String(err)}`, changes: w.changes };
		}

		if (!req.packages.length) continue;
		const present = verifyPackages(envDir, req.packages);
		const missing = req.packages.filter((_, i) => !present[i]?.installed);
		if (!missing.length) continue;
		console.log(pc.dim(`\n  ${skill} — pins from ${relative(projectDir, req.source ?? "")}:`));
		console.log(pc.dim(formatPackageList(missing)));
		const results = await installPipPackages(projectDir, envDir, missing);
		const failed = results.filter((r) => !r.success);
		if (failed.length) {
			return { name: "skill-envs", status: "warn", message: `${skill}: ${failed.length} of ${results.length} package(s) failed`, changes: w.changes };
		}
		w.record("install", envDir, `${results.length} package(s) for ${skill}`);
		installed.push(`${skill} (${results.length})`);
	}

	if (!created.length && !installed.length) {
		return { name: "skill-envs", status: "skip", message: `Already configured: ${requested.join(", ")}`, changes: w.changes };
	}
	const parts = [created.length ? `created ${created.join(", ")}` : "", installed.length ? `installed ${installed.join(", ")}` : ""].filter(Boolean);
	return { name: "skill-envs", status: "pass", message: parts.join("; "), changes: w.changes };
}

function setupProjectContext(projectDir: string): StepResult {
	const target = join(projectDir, "docs", "project-context.md");
	if (existsSync(target)) {
		return { name: "project-context", status: "skip", message: "docs/project-context.md already exists" };
	}
	const hasCodebase =
		existsSync(join(projectDir, "package.json")) ||
		existsSync(join(projectDir, "pyproject.toml")) ||
		existsSync(join(projectDir, "Cargo.toml")) ||
		existsSync(join(projectDir, "go.mod"));
	const action = hasCodebase ? "generate" : "init";
	return {
		name: "project-context",
		status: "warn",
		message: `Run \`/mk:project-context ${action}\` in your first session to create docs/project-context.md`,
	};
}

export const STEPS: Record<StepName, (dir: string, options?: StepOptions) => StepResult | Promise<StepResult>> = {
	"skill-envs": setupSkillEnvs,
	mcp: setupMcp,
	env: setupEnv,
	gitignore: setupGitignore,
	"project-context": setupProjectContext,
};
