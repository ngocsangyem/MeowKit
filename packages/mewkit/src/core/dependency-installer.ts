/**
 * Dependency installer — environment creation, pip install, package verification.
 *
 * Every function here takes the environment DIRECTORY it should act on, rather
 * than deriving one shared path from the project root. That is the whole shape
 * of the change: there is no single environment to derive, so a caller that
 * cannot name which skill it is installing for cannot install at all.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import pc from "picocolors";
import type { SkillsDependency } from "./skills-dependencies.js";
import { validatePackageName, getBasePackageName } from "./skills-dependencies.js";
import { ENVS_REL, envPipPath, envPythonPath } from "./skill-env.js";

export interface InstallResult {
	name: string;
	success: boolean;
	error?: string;
}

export interface PackageVerification {
	name: string;
	installed: boolean;
}

const PIP_TIMEOUT_MS = 120_000;

/**
 * An environment path must stay inside `.meowkit/envs/`.
 *
 * The guard is on the directory an install writes into, because that is the
 * value a caller could get wrong — a skill name arriving from a command line
 * must not be able to aim pip at the project tree.
 */
export function validateEnvPath(projectDir: string, targetPath: string): void {
	const envsRoot = resolve(projectDir, ENVS_REL);
	if (!resolve(targetPath).startsWith(envsRoot)) {
		throw new Error(`Path escapes ${ENVS_REL}: ${targetPath}`);
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

/**
 * Ensure one environment exists and holds an interpreter.
 *
 * "Repair" and "create" are the same operation on purpose. An environment whose
 * directory survived but whose interpreter did not is the common real failure
 * (a pruned cache, an upgraded system Python), and it is indistinguishable from
 * absent to every caller, so it is treated as absent here too.
 */
export function ensureEnv(
	projectDir: string,
	envDir: string,
): { envDir: string; created: boolean; repaired: boolean } {
	validateEnvPath(projectDir, envDir);
	const existedBefore = existsSync(envDir);
	if (existedBefore && existsSync(envPythonPath(envDir))) return { envDir, created: false, repaired: false };

	const python = findPython();
	if (!python) throw new Error("No Python interpreter found in PATH.");

	mkdirSync(dirname(envDir), { recursive: true });
	console.log(pc.dim(existedBefore ? "  Repairing environment..." : "  Creating environment..."));
	execFileSync(python, ["-m", "venv", envDir], { stdio: "pipe" });
	return { envDir, created: !existedBefore, repaired: existedBefore };
}

/** Install a single pip package with timeout */
function installOnePackage(pipPath: string, packageName: string): Promise<InstallResult> {
	if (!validatePackageName(packageName)) {
		return Promise.resolve({ name: packageName, success: false, error: "Invalid package name" });
	}
	return new Promise((done) => {
		const proc = spawn(pipPath, ["install", packageName], { stdio: ["ignore", "pipe", "pipe"] });
		let stderr = "";
		const timer = setTimeout(() => {
			proc.kill("SIGTERM");
			stderr += "\nTimeout: exceeded 120s";
		}, PIP_TIMEOUT_MS);

		proc.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		proc.stdout.on("data", (chunk: Buffer) => {
			process.stdout.write(pc.dim(`    ${chunk.toString().trim()}\n`));
		});
		proc.on("close", (code) => {
			clearTimeout(timer);
			done(
				code === 0
					? { name: packageName, success: true }
					: { name: packageName, success: false, error: stderr.trim().split("\n").pop() || "Unknown error" },
			);
		});
		proc.on("error", (err) => {
			clearTimeout(timer);
			done({ name: packageName, success: false, error: err.message });
		});
	});
}

/** Install pip packages sequentially into one environment */
export async function installPipPackages(
	projectDir: string,
	envDir: string,
	packages: readonly SkillsDependency[],
): Promise<InstallResult[]> {
	validateEnvPath(projectDir, envDir);
	const pipPath = envPipPath(envDir);
	if (!existsSync(pipPath)) throw new Error(`pip not found at ${pipPath}.`);

	const results: InstallResult[] = [];
	for (const pkg of packages) {
		console.log(`  ${pc.cyan(">")} Installing ${pc.bold(pkg.name)}...`);
		const result = await installOnePackage(pipPath, pkg.name);
		results.push(result);
		console.log(result.success ? `  ${pc.green("✓")} ${pkg.name}` : `  ${pc.red("✗")} ${pkg.name}: ${result.error}`);
	}
	return results;
}

/** Map pip package names to Python import names */
const IMPORT_NAME_MAP: Record<string, string> = {
	pillow: "PIL",
	"python-dotenv": "dotenv",
	"google-genai": "google.genai",
};

/** Verify which packages are installed in one environment */
export function verifyPackages(envDir: string, packages: readonly SkillsDependency[]): PackageVerification[] {
	const pythonPath = envPythonPath(envDir);
	if (!existsSync(pythonPath)) return packages.map((p) => ({ name: p.name, installed: false }));
	const pipPath = envPipPath(envDir);

	return packages.map((pkg) => {
		const basePkgName = getBasePackageName(pkg.name);
		const importName = IMPORT_NAME_MAP[basePkgName];

		if (importName) {
			if (!/^[a-zA-Z0-9][a-zA-Z0-9._]*$/.test(importName)) return { name: pkg.name, installed: false };
			try {
				execFileSync(pythonPath, ["-c", `import ${importName}`], { stdio: "pipe" });
				return { name: pkg.name, installed: true };
			} catch {
				return { name: pkg.name, installed: false };
			}
		}
		// Unknown package — pip show fallback
		try {
			execFileSync(pipPath, ["show", basePkgName], { stdio: "pipe" });
			return { name: pkg.name, installed: true };
		} catch {
			return { name: pkg.name, installed: false };
		}
	});
}
