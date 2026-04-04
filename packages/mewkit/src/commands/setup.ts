import { existsSync, readFileSync, writeFileSync, copyFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { commandAvailable, ensureVenv, installPipPackages, verifyPackages } from "../core/dependency-installer.js";
import { getRequirementsSource, formatPackageList } from "../core/skills-dependencies.js";

// --- System dependency helpers ---

/** Check if a command is available in PATH */
export function commandExists(cmd: string): boolean {
  return commandAvailable(cmd);
}

/** Install FFmpeg and ImageMagick based on the current OS and available package managers */
export async function installSystemDeps(): Promise<void> {
  const platform = process.platform;

  const hasFFmpeg = commandExists("ffmpeg");
  const hasImageMagick = commandExists("convert") || commandExists("magick");

  if (hasFFmpeg && hasImageMagick) {
    console.log(`  ${pc.green("✓")} FFmpeg and ImageMagick already installed`);
    return;
  }

  const toInstall: string[] = [];
  if (!hasFFmpeg) toInstall.push("FFmpeg");
  if (!hasImageMagick) toInstall.push("ImageMagick");
  console.log(`\n  Installing: ${toInstall.join(", ")}...`);

  try {
    if (platform === "darwin") {
      // macOS — require Homebrew
      if (!commandExists("brew")) {
        console.log(pc.yellow("  ⚠ Homebrew not found. Install from https://brew.sh then re-run."));
        return;
      }
      if (!hasFFmpeg) {
        console.log(pc.dim("  brew install ffmpeg..."));
        execSync("brew install ffmpeg", { stdio: "inherit" });
      }
      if (!hasImageMagick) {
        console.log(pc.dim("  brew install imagemagick..."));
        execSync("brew install imagemagick", { stdio: "inherit" });
      }
    } else if (platform === "linux") {
      if (commandExists("apt-get")) {
        const pkgs = [!hasFFmpeg && "ffmpeg", !hasImageMagick && "imagemagick"].filter(Boolean).join(" ");
        execSync(`sudo apt-get install -y ${pkgs}`, { stdio: "inherit" });
      } else if (commandExists("dnf")) {
        const pkgs = [!hasFFmpeg && "ffmpeg", !hasImageMagick && "ImageMagick"].filter(Boolean).join(" ");
        execSync(`sudo dnf install -y ${pkgs}`, { stdio: "inherit" });
      } else if (commandExists("pacman")) {
        const pkgs = [!hasFFmpeg && "ffmpeg", !hasImageMagick && "imagemagick"].filter(Boolean).join(" ");
        execSync(`sudo pacman -S --noconfirm ${pkgs}`, { stdio: "inherit" });
      } else if (commandExists("apk")) {
        const pkgs = [!hasFFmpeg && "ffmpeg", !hasImageMagick && "imagemagick"].filter(Boolean).join(" ");
        execSync(`apk add ${pkgs}`, { stdio: "inherit" });
      } else {
        console.log(pc.yellow("  ⚠ No supported package manager found (apt-get, dnf, pacman, apk)."));
        console.log("    Install FFmpeg and ImageMagick manually for your distribution.");
        return;
      }
    } else {
      // Windows — no automated install
      console.log(pc.yellow("  ⚠ Windows: install FFmpeg and ImageMagick manually."));
      console.log("    FFmpeg:      https://ffmpeg.org/download.html");
      console.log("    ImageMagick: https://imagemagick.org/script/download.php");
      return;
    }

    if (!hasFFmpeg) console.log(`  ${pc.green("✓")} FFmpeg installed`);
    if (!hasImageMagick) console.log(`  ${pc.green("✓")} ImageMagick installed`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(pc.red(`  ✗ Install failed: ${msg}`));
    console.log("    Try running manually or check your package manager permissions.");
  }
}

// --- Interactive system deps flow (used by init and setup --system-deps) ---

/** Show system dep status, prompt, and install if confirmed */
export async function promptAndInstallSystemDeps(): Promise<void> {
  const hasFFmpeg = commandExists("ffmpeg");
  const hasImageMagick = commandExists("convert") || commandExists("magick");

  console.log(pc.bold("\nChecking system dependencies..."));
  console.log(`  ${hasFFmpeg ? pc.green("✓") : pc.red("✗")} FFmpeg${hasFFmpeg ? " — already installed" : " — not found"}`);
  console.log(`  ${hasImageMagick ? pc.green("✓") : pc.red("✗")} ImageMagick${hasImageMagick ? " — already installed" : " — not found"}`);

  if (hasFFmpeg && hasImageMagick) return;

  const confirm = await p.confirm({
    message: "Install missing system dependencies?",
    initialValue: false,
  });

  if (p.isCancel(confirm)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (confirm) {
    await installSystemDeps();
  } else {
    console.log(pc.yellow("\n  ⚠ Skipped. Install later with: npx mewkit setup --system-deps"));
    console.log("    Run npx mewkit doctor to check what's missing.");
  }
}

// --- Standard setup steps ---

type StepName = "venv" | "deps" | "mcp" | "env" | "gitignore";

interface StepResult {
  name: StepName;
  status: "pass" | "skip" | "fail" | "warn";
  message: string;
}

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
  const mcpExample = join(projectDir, ".claude", "mcp.json.example");
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

  const envExample = join(projectDir, ".claude", "env.example");
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
  const meowkitIgnore = join(projectDir, ".claude", "gitignore.meowkit");
  const additions = existsSync(meowkitIgnore)
    ? readFileSync(meowkitIgnore, "utf-8")
    : DEFAULT_GITIGNORE;
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
    return { name: "deps", status: "warn", message: `${results.length - failed.length} installed, ${failed.length} failed` };
  }
  return { name: "deps", status: "fail", message: `All ${failed.length} package(s) failed` };
}

const STEPS: Record<StepName, (dir: string) => StepResult | Promise<StepResult>> = {
  venv: setupVenv,
  deps: setupDeps,
  mcp: setupMcp,
  env: setupEnv,
  gitignore: setupGitignore,
};

/** Run setup steps. --only=<step> runs a single step. --system-deps installs FFmpeg/ImageMagick. */
export async function setup(args: { only?: string; systemDeps?: boolean }): Promise<void> {
  // --system-deps: standalone system dep install flow, skips normal steps
  if (args.systemDeps) {
    console.log(pc.bold("\nMeowKit Setup — System Dependencies\n"));
    await promptAndInstallSystemDeps();
    return;
  }

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

    const result = await fn(dir);
    results.push(result);

    const icon = result.status === "pass" ? pc.green("✓")
      : result.status === "skip" ? pc.yellow("○")
      : result.status === "warn" ? pc.yellow("!")
      : pc.red("✗");
    console.log(`  ${icon} ${pc.bold(stepName)}: ${result.message}`);
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  const parts = [`${passed} configured`, `${skipped} skipped`];
  if (warned > 0) parts.push(`${warned} warnings`);
  if (failed > 0) parts.push(`${failed} failed`);
  console.log(`\n  ${pc.bold("Summary:")} ${parts.join(", ")}`);

  if (failed > 0) {
    process.exit(1);
  }
}
