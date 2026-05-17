import { existsSync, readFileSync, writeFileSync, copyFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { ensureVenv, installPipPackages, verifyPackages } from "../core/dependency-installer.js";
import { getRequirementsSource, formatPackageList } from "../core/skills-dependencies.js";

export type StepName = "venv" | "deps" | "mcp" | "env" | "gitignore" | "project-context";

export interface StepResult {
	name: StepName;
	status: "pass" | "skip" | "fail" | "warn";
	message: string;
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

const DEFAULT_GITIGNORE = `# MeowKit
.env
.env.local
.claude/.env
.claude/memory/
.claude/logs/
\n`;

/** Setup Python virtual environment for MeowKit skill scripts */
function setupVenv(projectDir: string): StepResult {
	try {
		const { venvDir, created } = ensureVenv(projectDir);
		if (created) return { name: "venv", status: "pass", message: `Created at ${venvDir}` };
		return { name: "venv", status: "skip", message: "Python venv already exists" };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { name: "venv", status: "fail", message: msg };
	}
}

/** Setup MCP configuration */
function setupMcp(projectDir: string): StepResult {
	const mcpTarget = join(projectDir, ".mcp.json");

	if (existsSync(mcpTarget)) {
		return { name: "mcp", status: "skip", message: ".mcp.json already exists" };
	}

	// Copy from example if available, otherwise create with defaults
	const mcpExample = join(projectDir, ".claude", "mcp.json.example");
	if (existsSync(mcpExample)) {
		copyFileSync(mcpExample, mcpTarget);
	} else {
		writeFileSync(mcpTarget, DEFAULT_MCP, "utf-8");
	}
	return { name: "mcp", status: "pass", message: "Created .mcp.json — edit API keys inside." };
}

/** Setup .env in .claude/ directory */
function setupEnv(projectDir: string): StepResult {
	const envTarget = join(projectDir, ".claude", ".env");

	if (existsSync(envTarget)) {
		const content = readFileSync(envTarget, "utf-8").trim();
		if (content.length > 0) {
			return { name: "env", status: "skip", message: ".claude/.env already exists" };
		}
	}

	mkdirSync(join(projectDir, ".claude"), { recursive: true });
	writeFileSync(envTarget, DEFAULT_ENV, "utf-8");
	return { name: "env", status: "pass", message: "Created .claude/.env — add your API keys." };
}

/** Setup .gitignore with MeowKit entries */
function setupGitignore(projectDir: string): StepResult {
	const gitignore = join(projectDir, ".gitignore");

	// Check if already has MeowKit entries
	if (existsSync(gitignore)) {
		const content = readFileSync(gitignore, "utf-8");
		if (content.includes(".claude/memory/")) {
			return { name: "gitignore", status: "skip", message: "MeowKit entries already in .gitignore" };
		}
	}

	// Read from .gitignore.meowkit if exists, otherwise use defaults
	const meowkitIgnore = join(projectDir, ".claude", "gitignore.meowkit");
	const additions = existsSync(meowkitIgnore) ? readFileSync(meowkitIgnore, "utf-8") : DEFAULT_GITIGNORE;
	appendFileSync(gitignore, `\n${additions}`, "utf-8");
	return { name: "gitignore", status: "pass", message: "Appended MeowKit entries to .gitignore" };
}

/** Install pip packages into the skills venv */
async function setupDeps(projectDir: string): Promise<StepResult> {
	const venvDir = join(projectDir, ".claude", "skills", ".venv");
	if (!existsSync(venvDir)) {
		return { name: "deps", status: "fail", message: "No venv. Run setup --only=venv first." };
	}

	const { packages, source } = getRequirementsSource(projectDir);
	console.log(pc.dim(`\n  Packages (from ${source}):`));
	console.log(pc.dim(formatPackageList(packages)));
	console.log();

	const existing = verifyPackages(projectDir, packages);
	const missing = packages.filter((_, i) => !existing[i]?.installed);

	if (missing.length === 0) {
		return { name: "deps", status: "skip", message: "All pip packages already installed" };
	}

	console.log(`  ${missing.length} package(s) to install, ${packages.length - missing.length} already present.\n`);

	const results = await installPipPackages(projectDir, missing);
	const failed = results.filter((r) => !r.success);

	if (failed.length === 0) {
		return { name: "deps", status: "pass", message: `Installed ${results.length} package(s)` };
	}
	if (failed.length < results.length) {
		return {
			name: "deps",
			status: "warn",
			message: `${results.length - failed.length} installed, ${failed.length} failed`,
		};
	}
	return { name: "deps", status: "fail", message: `All ${failed.length} package(s) failed` };
}

/**
 * Notify if docs/project-context.md is missing. The actual generator lives in the
 * mk:project-context skill (invoked via /mk:project-context generate|init).
 * This step does not auto-invoke the skill — agents are not callable from this CLI —
 * but flags the absence so users know to run the skill on first session.
 */
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

export const STEPS: Record<StepName, (dir: string) => StepResult | Promise<StepResult>> = {
	venv: setupVenv,
	deps: setupDeps,
	mcp: setupMcp,
	env: setupEnv,
	gitignore: setupGitignore,
	"project-context": setupProjectContext,
};
