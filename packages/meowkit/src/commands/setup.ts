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

/** Setup MCP configuration from example */
function setupMcp(projectDir: string): StepResult {
  const mcpExample = join(projectDir, ".mcp.json.example");
  const mcpTarget = join(projectDir, ".mcp.json");

  if (existsSync(mcpTarget)) {
    return { name: "mcp", status: "skip", message: ".mcp.json already exists" };
  }

  if (!existsSync(mcpExample)) {
    return { name: "mcp", status: "fail", message: ".mcp.json.example not found" };
  }

  copyFileSync(mcpExample, mcpTarget);
  return { name: "mcp", status: "pass", message: "Created .mcp.json from example. Edit API keys inside." };
}

/** Setup .env from example */
function setupEnv(projectDir: string): StepResult {
  const envExample = join(projectDir, ".env.example");
  const envTarget = join(projectDir, ".env");

  if (existsSync(envTarget)) {
    return { name: "env", status: "skip", message: ".env already exists" };
  }

  if (!existsSync(envExample)) {
    return { name: "env", status: "fail", message: ".env.example not found" };
  }

  copyFileSync(envExample, envTarget);
  return { name: "env", status: "pass", message: "Created .env from example. Add your API keys." };
}

/** Append MeowKit gitignore entries to project .gitignore */
function setupGitignore(projectDir: string): StepResult {
  const meowkitIgnore = join(projectDir, ".gitignore.meowkit");
  const gitignore = join(projectDir, ".gitignore");

  if (!existsSync(meowkitIgnore)) {
    return { name: "gitignore", status: "fail", message: ".gitignore.meowkit not found" };
  }

  // Check if already appended
  if (existsSync(gitignore)) {
    const content = readFileSync(gitignore, "utf-8");
    if (content.includes(".claude/memory/")) {
      return { name: "gitignore", status: "skip", message: "MeowKit entries already in .gitignore" };
    }
  }

  const additions = readFileSync(meowkitIgnore, "utf-8");
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
  // Find project root by walking up to find .claude/
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, ".claude"))) break;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  if (!existsSync(join(dir, ".claude"))) {
    console.error(pc.red("No .claude/ directory found. Run 'npm create meowkit' first."));
    process.exit(1);
  }

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
