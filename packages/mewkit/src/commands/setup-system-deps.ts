import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { commandAvailable } from "../core/dependency-installer.js";
import {
	listDeps,
	isDepCommandPresent,
	parseOptionalSystemDepsFromSkillMd,
	validateSkillDeclaredKeys,
	type SystemDepEntry,
} from "../lib/system-deps-registry.js";

/** Check if a command is available in PATH */
export function commandExists(cmd: string): boolean {
	return commandAvailable(cmd);
}

/**
 * Detect whether a system dep is currently present.
 * For most deps this is a PATH lookup; playwright-chromium uses a python import probe
 * and therefore relies on the registry's detectCommand string as documentation only —
 * the actual check is done via its doctorCheck function in doctor.ts.
 * For setup purposes we do a simple PATH check for PATH-based deps and skip
 * venv-based deps (they are always offered as installable in setup).
 *
 * Delegates to isDepCommandPresent() from the registry which handles multi-binary
 * deps (e.g. ImageMagick 6 "convert" vs ImageMagick 7+ "magick") via detectCommands.
 */
function isDepPresent(dep: SystemDepEntry): boolean {
	// Playwright uses a venv python import, not a PATH command — cannot PATH-check here.
	// We conservatively treat it as absent so the prompt always offers it.
	if (dep.detectCommand.includes(".venv")) return false;
	return isDepCommandPresent(dep, commandAvailable);
}

/**
 * Enumerate all skills in .claude/skills/, parse their SKILL.md,
 * and aggregate the valid optional_system_deps keys.
 * Unknown keys produce a console warning and are excluded.
 */
function collectSkillDeclaredDeps(projectDir: string): Set<string> {
	const skillsDir = join(projectDir, ".claude", "skills");
	if (!existsSync(skillsDir)) return new Set();

	// Enumerate any subdirectory containing SKILL.md (content-based, prefix-agnostic)
	let skillDirs: string[];
	try {
		skillDirs = readdirSync(skillsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory() && !d.name.startsWith(".") && existsSync(join(skillsDir, d.name, "SKILL.md")))
			.map((d) => d.name);
	} catch {
		skillDirs = [];
	}

	const validKeys = new Set<string>();

	for (const skillName of skillDirs) {
		const fullPath = join(skillsDir, skillName, "SKILL.md");

		let content: string;
		try {
			content = readFileSync(fullPath, "utf-8");
		} catch {
			continue;
		}

		const declared = parseOptionalSystemDepsFromSkillMd(content);
		if (declared.length === 0) continue;

		const { valid } = validateSkillDeclaredKeys(declared, skillName);
		for (const k of valid) validKeys.add(k);
	}

	return validKeys;
}

/** Install a single system dep using its registry entry */
async function installSingleDep(dep: SystemDepEntry, projectDir: string): Promise<void> {
	const platform = process.platform as NodeJS.Platform;
	const commands = dep.installCommands[platform] ?? [];

	if (commands.length === 0) {
		console.log(pc.yellow(`  ⚠ No automated install for ${dep.name} on ${platform}.`));
		console.log(`    Manual: ${dep.manualUrl}`);
		return;
	}

	// For macOS, ffmpeg and imagemagick need Homebrew
	if (platform === "darwin" && (dep.key === "ffmpeg" || dep.key === "imagemagick")) {
		if (!commandAvailable("brew")) {
			console.log(pc.yellow("  ⚠ Homebrew not found. Install from https://brew.sh then re-run."));
			return;
		}
	}

	// For Linux, pick the right package manager and adjust commands
	if (platform === "linux" && (dep.key === "ffmpeg" || dep.key === "imagemagick")) {
		await installLinuxDep(dep);
		return;
	}

	// General: run each install command in sequence
	try {
		for (const cmd of commands) {
			// Playwright commands reference relative .venv paths — resolve from projectDir
			const resolvedCmd = cmd.startsWith(".claude")
				? `${join(projectDir, cmd.split(" ")[0] ?? "")} ${cmd.split(" ").slice(1).join(" ")}`
				: cmd;
			console.log(pc.dim(`  ${resolvedCmd}...`));
			execSync(resolvedCmd, { stdio: "inherit", cwd: projectDir });
		}
		console.log(`  ${pc.green("✓")} ${dep.name} installed`);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(pc.red(`  ✗ ${dep.name} install failed: ${msg}`));
		console.log(`    Manual: ${dep.manualUrl}`);
	}
}

/** Linux-specific install: detect available package manager and pick right pkg name */
async function installLinuxDep(dep: SystemDepEntry): Promise<void> {
	const pkgNames: Record<string, Partial<Record<string, string>>> = {
		ffmpeg: { "apt-get": "ffmpeg", dnf: "ffmpeg", pacman: "ffmpeg", apk: "ffmpeg" },
		imagemagick: { "apt-get": "imagemagick", dnf: "ImageMagick", pacman: "imagemagick", apk: "imagemagick" },
	};

	const names = pkgNames[dep.key];
	if (!names) {
		console.log(pc.yellow(`  ⚠ No Linux pkg map for ${dep.name}. Manual: ${dep.manualUrl}`));
		return;
	}

	const managers: Array<{ bin: string; cmd: (pkg: string) => string }> = [
		{ bin: "apt-get", cmd: (pkg) => `sudo apt-get install -y ${pkg}` },
		{ bin: "dnf", cmd: (pkg) => `sudo dnf install -y ${pkg}` },
		{ bin: "pacman", cmd: (pkg) => `sudo pacman -S --noconfirm ${pkg}` },
		{ bin: "apk", cmd: (pkg) => `apk add ${pkg}` },
	];

	for (const mgr of managers) {
		if (!commandAvailable(mgr.bin)) continue;
		const pkg = names[mgr.bin] ?? dep.key;
		try {
			console.log(pc.dim(`  ${mgr.cmd(pkg)}...`));
			execSync(mgr.cmd(pkg), { stdio: "inherit" });
			console.log(`  ${pc.green("✓")} ${dep.name} installed`);
			return;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(pc.red(`  ✗ ${dep.name} install failed: ${msg}`));
			return;
		}
	}

	console.log(pc.yellow(`  ⚠ No supported package manager found (apt-get, dnf, pacman, apk).`));
	console.log(`    Manual: ${dep.manualUrl}`);
}

/** Install all deps that are currently absent */
export async function installSystemDeps(projectDir?: string): Promise<void> {
	const dir = projectDir ?? process.cwd();
	const deps = listDeps();
	const allPresent = deps.every((d) => isDepPresent(d));

	if (allPresent) {
		// List the known PATH-based deps that are present
		const pathDeps = deps.filter((d) => !d.detectCommand.includes(".venv"));
		console.log(`  ${pc.green("✓")} ${pathDeps.map((d) => d.name).join(" and ")} already installed`);
		return;
	}

	const toInstall = deps.filter((d) => !isDepPresent(d));
	console.log(`\n  Installing: ${toInstall.map((d) => d.name).join(", ")}...`);

	for (const dep of toInstall) {
		await installSingleDep(dep, dir);
	}
}

/**
 * Show system dep status as a flat checklist, prompt, and install if confirmed.
 * Each dep is shown as:  [ ] Name (~NMB)   — unchecked by default (locked decision #4).
 * Playwright appears alongside FFmpeg and ImageMagick in the same list.
 */
export async function promptAndInstallSystemDeps(projectDir?: string): Promise<void> {
	const dir = projectDir ?? process.cwd();
	const allDeps = listDeps();

	// Collect which keys are declared by skills in this project (allowlist gate)
	const skillDeclaredKeys = collectSkillDeclaredDeps(dir);

	console.log(pc.bold("\nChecking system dependencies..."));

	for (const dep of allDeps) {
		const present = isDepPresent(dep);
		const sizeMB = Math.round(dep.sizeBytes / 1_000_000);
		console.log(
			`  ${present ? pc.green("✓") : pc.red("✗")} ${dep.name} (~${sizeMB}MB)` +
				`${present ? " — already installed" : " — not found"}`,
		);
	}

	// Only offer deps that are (a) absent and (b) declared by at least one skill,
	// OR are the base PATH deps (ffmpeg/imagemagick — always offered regardless of skills).
	const offerable = allDeps.filter((d) => {
		if (isDepPresent(d)) return false;
		// PATH-based deps (ffmpeg, imagemagick) are always offerable
		if (!d.detectCommand.includes(".venv")) return true;
		// Venv-based deps (playwright) only offered if a skill declares them
		return skillDeclaredKeys.has(d.key);
	});

	if (offerable.length === 0) return;

	const confirm = await p.confirm({
		message: "Install missing system dependencies?",
		initialValue: false,
	});

	if (p.isCancel(confirm)) {
		p.cancel("Setup cancelled.");
		process.exit(0);
	}

	if (confirm) {
		for (const dep of offerable) {
			await installSingleDep(dep, dir);
		}
	} else {
		console.log(pc.yellow("\n  ⚠ Skipped. Install later with: npx mewkit setup --system-deps"));
		console.log("    Run npx mewkit doctor to check what's missing.");
	}
}
