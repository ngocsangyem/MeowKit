/** Dependency installer — venv creation, pip install, package verification */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import pc from "picocolors";
import type { SkillsDependency } from "./skills-dependencies.js";
import { validatePackageName, getBasePackageName } from "./skills-dependencies.js";

export interface InstallResult {
  name: string;
  success: boolean;
  error?: string;
}

export interface PackageVerification {
  name: string;
  installed: boolean;
}

const VENV_RELATIVE = join(".claude", "skills", ".venv");
const PIP_TIMEOUT_MS = 120_000;

/** Validate a path stays inside the .claude directory */
function validateInsideClaude(projectDir: string, targetPath: string): void {
  const claudeDir = resolve(projectDir, ".claude");
  if (!resolve(targetPath).startsWith(claudeDir)) {
    throw new Error(`Path escapes .claude directory: ${targetPath}`);
  }
}

/** Check if a command exists in PATH. Cross-platform: `where` on Windows, `which` on Unix. */
export function commandAvailable(cmd: string): boolean {
  const whichCmd = process.platform === "win32" ? "where" : "which";
  try {
    execFileSync(whichCmd, [cmd], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/** Find python command. Returns "python3", "python", "py" (Windows), or null. */
export function findPython(): string | null {
  if (process.platform === "win32") {
    if (commandAvailable("py")) return "py";
    if (commandAvailable("python")) return "python";
  } else {
    if (commandAvailable("python3")) return "python3";
    if (commandAvailable("python")) return "python";
  }
  return null;
}

/** Get platform-correct pip binary path inside the venv */
export function getPipPath(projectDir: string): string {
  const venvDir = join(projectDir, VENV_RELATIVE);
  const pipPath = process.platform === "win32"
    ? join(venvDir, "Scripts", "pip.exe")
    : join(venvDir, "bin", "pip");
  validateInsideClaude(projectDir, pipPath);
  return pipPath;
}

/** Get platform-correct python binary path inside the venv */
export function getVenvPythonPath(projectDir: string): string {
  const venvDir = join(projectDir, VENV_RELATIVE);
  const pythonPath = process.platform === "win32"
    ? join(venvDir, "Scripts", "python.exe")
    : join(venvDir, "bin", "python3");
  validateInsideClaude(projectDir, pythonPath);
  return pythonPath;
}

/** Ensure the skills venv exists. Creates it if missing. */
export function ensureVenv(projectDir: string): { venvDir: string; created: boolean } {
  const venvDir = join(projectDir, VENV_RELATIVE);
  validateInsideClaude(projectDir, venvDir);
  if (existsSync(venvDir)) return { venvDir, created: false };

  const python = findPython();
  if (!python) throw new Error("python3 not found in PATH. Install Python 3.9+ first.");

  console.log(pc.dim("  Creating Python venv..."));
  execFileSync(python, ["-m", "venv", venvDir], { stdio: "pipe" });
  return { venvDir, created: true };
}

/** Install a single pip package with timeout */
function installOnePackage(pipPath: string, packageName: string): Promise<InstallResult> {
  if (!validatePackageName(packageName)) {
    return Promise.resolve({ name: packageName, success: false, error: "Invalid package name" });
  }
  return new Promise((done) => {
    const proc = spawn(pipPath, ["install", packageName], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { proc.kill("SIGTERM"); stderr += "\nTimeout: exceeded 120s"; }, PIP_TIMEOUT_MS);

    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(pc.dim(`    ${chunk.toString().trim()}\n`));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      done(code === 0
        ? { name: packageName, success: true }
        : { name: packageName, success: false, error: stderr.trim().split("\n").pop() || "Unknown error" });
    });
    proc.on("error", (err) => { clearTimeout(timer); done({ name: packageName, success: false, error: err.message }); });
  });
}

/** Install pip packages sequentially into the venv */
export async function installPipPackages(
  projectDir: string,
  packages: readonly SkillsDependency[],
): Promise<InstallResult[]> {
  const pipPath = getPipPath(projectDir);
  if (!existsSync(pipPath)) throw new Error(`pip not found at ${pipPath}. Run 'mewkit setup --only=venv' first.`);

  const results: InstallResult[] = [];
  for (const pkg of packages) {
    console.log(`  ${pc.cyan(">")} Installing ${pc.bold(pkg.name)}...`);
    const result = await installOnePackage(pipPath, pkg.name);
    results.push(result);
    console.log(result.success
      ? `  ${pc.green("✓")} ${pkg.name}`
      : `  ${pc.red("✗")} ${pkg.name}: ${result.error}`);
  }
  return results;
}

/** Map pip package names to Python import names */
const IMPORT_NAME_MAP: Record<string, string> = {
  "pillow": "PIL",
  "python-dotenv": "dotenv",
  "google-genai": "google.genai",
};

/** Verify which packages are installed in the venv */
export function verifyPackages(
  projectDir: string,
  packages: readonly SkillsDependency[],
): PackageVerification[] {
  const pythonPath = getVenvPythonPath(projectDir);
  if (!existsSync(pythonPath)) return packages.map((p) => ({ name: p.name, installed: false }));
  const pipPath = getPipPath(projectDir);

  return packages.map((pkg) => {
    const basePkgName = getBasePackageName(pkg.name);
    const importName = IMPORT_NAME_MAP[basePkgName];

    if (importName) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._]*$/.test(importName)) return { name: pkg.name, installed: false };
      try {
        execFileSync(pythonPath, ["-c", `import ${importName}`], { stdio: "pipe" });
        return { name: pkg.name, installed: true };
      } catch { return { name: pkg.name, installed: false }; }
    }
    // Unknown package — pip show fallback
    try {
      execFileSync(pipPath, ["show", basePkgName], { stdio: "pipe" });
      return { name: pkg.name, installed: true };
    } catch { return { name: pkg.name, installed: false }; }
  });
}
