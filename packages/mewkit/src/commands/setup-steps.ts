import { existsSync, readFileSync, writeFileSync, copyFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import pc from "picocolors";
import { ensureEnv, findPython, installPipPackages, verifyPackages } from "../core/dependency-installer.js";
import { formatPackageList } from "../core/skills-dependencies.js";
import { envSkills, readSkillRequirements, skillEnvDir } from "../core/skill-env.js";

export type StepName = "skill-envs" | "mcp" | "env" | "gitignore" | "project-context";

export interface StepResult {
	name: StepName;
	status: "pass" | "skip" | "fail" | "warn";
	message: string;
}

/** Options a step may read. Only the environment step uses any. */
export interface StepOptions {
	/** Skills the user named. Empty means create nothing — the default. */
	skills?: string[];
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
// `.meowkit/config.json` and `.meowkit/memory/` are deliberately NOT ignored — both are meant to be committed.
const DEFAULT_GITIGNORE = `# MeowKit
.env
.env.local
.meowkit/.env
.meowkit/telemetry/
.meowkit/state/
.meowkit/cache/
.claude/.env
.claude/logs/
\n`;

/** Setup MCP configuration */
function setupMcp(projectDir: string): StepResult {
	const mcpTarget = join(projectDir, ".mcp.json");

	if (existsSync(mcpTarget)) {
		return { name: "mcp", status: "skip", message: ".mcp.json already exists" };
	}

	// Copy from example if available, otherwise create with defaults
	// Template moved into `.meowkit/`; an install made before the move still has the old copy.
	const canonicalMcpExample = join(projectDir, ".meowkit", "mcp.json.example");
	const mcpExample = existsSync(canonicalMcpExample)
		? canonicalMcpExample
		: join(projectDir, ".claude", "mcp.json.example");
	if (existsSync(mcpExample)) {
		copyFileSync(mcpExample, mcpTarget);
	} else {
		writeFileSync(mcpTarget, DEFAULT_MCP, "utf-8");
	}
	return { name: "mcp", status: "pass", message: "Created .mcp.json — edit API keys inside." };
}

/** Setup `.meowkit/.env`. A pre-move `.claude/.env` still counts as configured — the loaders
 *  read both — so this never overwrites or duplicates an existing setup. */
function setupEnv(projectDir: string): StepResult {
	const envTarget = join(projectDir, ".meowkit", ".env");
	const legacyEnv = join(projectDir, ".claude", ".env");

	for (const existing of [envTarget, legacyEnv]) {
		if (!existsSync(existing)) continue;
		if (readFileSync(existing, "utf-8").trim().length > 0) {
			return { name: "env", status: "skip", message: `${relative(projectDir, existing)} already exists` };
		}
	}

	mkdirSync(join(projectDir, ".meowkit"), { recursive: true });
	writeFileSync(envTarget, DEFAULT_ENV, "utf-8");
	return { name: "env", status: "pass", message: "Created .meowkit/.env — add your API keys." };
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

/** Setup .gitignore with MeowKit entries */
function setupGitignore(projectDir: string): StepResult {
	const gitignore = join(projectDir, ".gitignore");

	// Check if already has MeowKit entries
	if (existsSync(gitignore)) {
		let content = readFileSync(gitignore, "utf-8");
		// BEFORE the skip: a stale memory ignore has to go even when everything else is present.
		const stripped = stripStaleMemoryIgnore(content);
		if (stripped.stripped) {
			writeFileSync(gitignore, stripped.content, "utf-8");
			content = stripped.content;
		}
		if (content.includes(".meowkit/telemetry/")) {
			return {
				name: "gitignore",
				status: stripped.stripped ? "pass" : "skip",
				message: stripped.stripped
					? "Removed the stale .meowkit/memory/ ignore — the v3 team store is committed"
					: "MeowKit entries already in .gitignore",
			};
		}
	}

	// Read from .gitignore.meowkit if exists, otherwise use defaults
	const meowkitIgnore = join(projectDir, ".meowkit", "gitignore.meowkit");
	const additions = existsSync(meowkitIgnore) ? readFileSync(meowkitIgnore, "utf-8") : DEFAULT_GITIGNORE;
	appendFileSync(gitignore, `\n${additions}`, "utf-8");
	return { name: "gitignore", status: "pass", message: "Appended MeowKit entries to .gitignore" };
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

		try {
			const { created: made, repaired } = ensureEnv(projectDir, envDir);
			if (made || repaired) created.push(skill);
		} catch (err) {
			return { name: "skill-envs", status: "fail", message: `${skill}: ${err instanceof Error ? err.message : String(err)}` };
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
			return { name: "skill-envs", status: "warn", message: `${skill}: ${failed.length} of ${results.length} package(s) failed` };
		}
		installed.push(`${skill} (${results.length})`);
	}

	if (!created.length && !installed.length) {
		return { name: "skill-envs", status: "skip", message: `Already configured: ${requested.join(", ")}` };
	}
	const parts = [created.length ? `created ${created.join(", ")}` : "", installed.length ? `installed ${installed.join(", ")}` : ""].filter(Boolean);
	return { name: "skill-envs", status: "pass", message: parts.join("; ") };
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
