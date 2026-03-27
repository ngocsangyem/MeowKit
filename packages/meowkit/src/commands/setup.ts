import { existsSync, readFileSync, writeFileSync, copyFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import pc from "picocolors";

type StepName = "venv" | "mcp" | "env" | "gitignore";

interface StepResult {
  name: StepName;
  status: "pass" | "skip" | "fail";
  message: string;
}

/** Setup Python virtual environment for MeowKit skill scripts */
function setupVenv(projectDir: string): StepResult {
  const venvDir = join(projectDir, ".claude", "skills", ".venv");

  if (existsSync(venvDir)) {
    return { name: "venv", status: "skip", message: "Python venv already exists" };
  }

  // Check if python3 is available
  try {
    execSync("python3 --version", { stdio: "pipe" });
  } catch {
    return { name: "venv", status: "fail", message: "python3 not found. Install Python 3.9+ first." };
  }

  try {
    console.log(pc.dim("  Creating Python venv..."));
    execSync(`python3 -m venv "${venvDir}"`, { stdio: "pipe" });

    // Install common skill dependencies if requirements.txt exists
    const reqFile = join(projectDir, ".claude", "skills", "requirements.txt");
    if (existsSync(reqFile)) {
      console.log(pc.dim("  Installing skill dependencies..."));
      execSync(`"${venvDir}/bin/pip" install -r "${reqFile}"`, { stdio: "pipe" });
    }

    return { name: "venv", status: "pass", message: `Created at ${venvDir}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: "venv", status: "fail", message: `Failed to create venv: ${msg}` };
  }
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
# Never commit this file to git.

# Gemini API key (required for meow:multimodal skill)
# Get from: https://aistudio.google.com/apikey
GEMINI_API_KEY=
\n`;

const DEFAULT_GITIGNORE = `# MeowKit
.env
.env.local
.claude/memory/
.claude/logs/
\n`;

/** Setup MCP configuration */
function setupMcp(projectDir: string): StepResult {
  const mcpTarget = join(projectDir, ".mcp.json");

  if (existsSync(mcpTarget)) {
    return { name: "mcp", status: "skip", message: ".mcp.json already exists" };
  }

  // Copy from example if available, otherwise create with defaults
  const mcpExample = join(projectDir, ".mcp.json.example");
  if (existsSync(mcpExample)) {
    copyFileSync(mcpExample, mcpTarget);
  } else {
    writeFileSync(mcpTarget, DEFAULT_MCP, "utf-8");
  }
  return { name: "mcp", status: "pass", message: "Created .mcp.json — edit API keys inside." };
}

/** Setup .env */
function setupEnv(projectDir: string): StepResult {
  const envTarget = join(projectDir, ".env");

  if (existsSync(envTarget)) {
    return { name: "env", status: "skip", message: ".env already exists" };
  }

  const envExample = join(projectDir, ".env.example");
  if (existsSync(envExample)) {
    copyFileSync(envExample, envTarget);
  } else {
    writeFileSync(envTarget, DEFAULT_ENV, "utf-8");
  }
  return { name: "env", status: "pass", message: "Created .env — add your API keys." };
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
  const meowkitIgnore = join(projectDir, ".gitignore.meowkit");
  const additions = existsSync(meowkitIgnore)
    ? readFileSync(meowkitIgnore, "utf-8")
    : DEFAULT_GITIGNORE;
  appendFileSync(gitignore, `\n${additions}`, "utf-8");
  return { name: "gitignore", status: "pass", message: "Appended MeowKit entries to .gitignore" };
}

const STEPS: Record<StepName, (dir: string) => StepResult> = {
  venv: setupVenv,
  mcp: setupMcp,
  env: setupEnv,
  gitignore: setupGitignore,
};

/** Run setup steps. --only=<step> runs a single step. */
export function setup(args: { only?: string }): void {
  // Always use cwd. No walk-up — avoids matching ~/.claude or parent projects.
  const dir = process.cwd();

  const stepsToRun: StepName[] = args.only
    ? [args.only as StepName]
    : (Object.keys(STEPS) as StepName[]);

  console.log(pc.bold("\nMeowKit Setup\n"));

  const results: StepResult[] = [];

  for (const stepName of stepsToRun) {
    const fn = STEPS[stepName];
    if (!fn) {
      console.error(pc.red(`Unknown step: ${stepName}. Available: ${Object.keys(STEPS).join(", ")}`));
      process.exit(1);
    }

    const result = fn(dir);
    results.push(result);

    const icon = result.status === "pass" ? pc.green("✓")
      : result.status === "skip" ? pc.yellow("○")
      : pc.red("✗");
    console.log(`  ${icon} ${pc.bold(stepName)}: ${result.message}`);
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const failed = results.filter((r) => r.status === "fail").length;

  console.log(`\n  ${pc.bold("Summary:")} ${passed} configured, ${skipped} skipped, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}
