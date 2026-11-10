/**
 * `mewkit skill env` — create, repair or list per-skill interpreter environments.
 *
 * The only command in the kit that creates an interpreter environment, and it
 * does so only when a user names a skill. Nothing calls it implicitly: no hook,
 * no session start, no other verb. A skill that finds its environment missing
 * prints this command and stops.
 */

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import pc from "picocolors";
import { ensureEnv, findPython, installPipPackages } from "../core/dependency-installer.js";
import {
	ENVS_REL,
	RUNTIME_KEY,
	envSkills,
	envUsable,
	readSkillRequirements,
	readSkillRuntime,
	skillEnvDir,
} from "../core/skill-env.js";

/** Every environment directory present, whether or not a skill still declares one. */
function existingEnvs(projectDir: string): string[] {
	try {
		return readdirSync(join(projectDir, ENVS_REL), { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/** `--list`: every skill that needs an environment, and whether its one is usable. */
function listEnvs(projectDir: string): number {
	const skills = envSkills(projectDir);
	const present = new Set(existingEnvs(projectDir));

	console.log(pc.bold(`\nPer-skill environments  ${pc.dim(ENVS_REL)}\n`));
	if (!skills.length) {
		console.log(pc.dim(`  No skill declares ${RUNTIME_KEY} or pins packages.\n`));
		return 0;
	}
	for (const skill of skills) {
		const envDir = skillEnvDir(projectDir, skill);
		const runtime = readSkillRuntime(projectDir, skill);
		const state = envUsable(envDir) ? pc.green("ready") : existsSync(envDir) ? pc.yellow("broken") : pc.dim("absent");
		const req = readSkillRequirements(projectDir, skill);
		const pins = req.source ? `${req.packages.length} pinned` : "stdlib only";
		console.log(
			`  ${skill.padEnd(18)} ${state.padEnd(16)} ${pc.dim(`${runtime?.entries.join(", ") ?? "binary only"} · ${pins}`)}`,
		);
	}

	// An environment with no declaring skill is listed rather than deleted: it may
	// belong to a skill the user removed, and deleting a tree the user filled is
	// not this command's call.
	const orphans = [...present].filter((name) => !skills.includes(name));
	if (orphans.length) console.log(pc.dim(`\n  No longer declared: ${orphans.join(", ")}`));
	console.log();
	return 0;
}

/** Create or repair the environment for one skill, installing only its own pins. */
async function provisionEnv(projectDir: string, skill: string): Promise<number> {
	const known = envSkills(projectDir);

	// Validated before it reaches any path join: the name arrives from a command
	// line and ends up naming a directory that pip writes into.
	if (!/^[a-z0-9][a-z0-9-]*$/.test(skill)) {
		console.error(pc.red(`\nNot a skill directory name: ${skill}`));
		console.error(pc.dim(`Skills that need one: ${known.join(", ") || "(none)"}\n`));
		return 1;
	}

	if (!existsSync(join(projectDir, ".claude", "skills", skill))) {
		console.error(pc.red(`\nNo such skill: ${skill}`));
		console.error(pc.dim(`Skills that need an environment: ${known.join(", ") || "(none)"}\n`));
		return 1;
	}

	const runtime = readSkillRuntime(projectDir, skill);
	if (!known.includes(skill)) {
		console.error(
			pc.red(`\nSkill ${skill} declares no ${RUNTIME_KEY} and pins no packages, so it needs no environment.`),
		);
		console.error(pc.dim(`Skills that need one: ${known.join(", ") || "(none)"}\n`));
		return 1;
	}

	if (!findPython()) {
		console.error(pc.red(`\nNo Python interpreter found in PATH.`));
		console.error(
			pc.dim(`${skill} requires ${runtime?.entries.join(", ") ?? "python"}. Install it, then re-run this command.\n`),
		);
		return 1;
	}

	const envDir = skillEnvDir(projectDir, skill);
	const req = readSkillRequirements(projectDir, skill);

	if (req.rejected.length) {
		// Reported and not installed: a line that fails package-name validation
		// could be a flag or a URL, and either one turns a pinned install into an
		// arbitrary one.
		console.error(
			pc.red(`\nRejected ${req.rejected.length} requirement line(s) in ${relative(projectDir, req.source ?? "")}:`),
		);
		for (const line of req.rejected) console.error(pc.red(`  ${line}`));
		console.error(pc.dim("\nFix the pin, then re-run. Nothing was installed.\n"));
		return 1;
	}

	console.log(pc.bold(`\nEnvironment for ${skill}`));
	let created: boolean;
	let repaired: boolean;
	try {
		({ created, repaired } = ensureEnv(projectDir, envDir));
	} catch (err) {
		console.error(pc.red(`\n${err instanceof Error ? err.message : String(err)}\n`));
		return 1;
	}
	console.log(
		`  ${pc.green("✓")} ${created ? "created" : repaired ? "repaired" : "already present"} ${pc.dim(relative(projectDir, envDir))}`,
	);

	if (!req.source) {
		// Standard-library only. An empty environment is the right answer, not a
		// failure: the skill's scripts import nothing off the index.
		console.log(`  ${pc.green("✓")} no requirements file — standard library only, nothing to install\n`);
		return 0;
	}

	console.log(pc.dim(`  pins: ${relative(projectDir, req.source)} (${req.packages.length})`));
	if (!req.packages.length) {
		console.log(`  ${pc.green("✓")} requirements file pins nothing\n`);
		return 0;
	}

	const results = await installPipPackages(projectDir, envDir, req.packages);
	const failed = results.filter((r) => !r.success);
	if (failed.length) {
		console.error(pc.red(`\n${failed.length} of ${results.length} package(s) failed to install.\n`));
		return 1;
	}
	console.log(`\n  ${pc.green("✓")} ${results.length} package(s) installed into ${relative(projectDir, envDir)}\n`);
	return 0;
}

const USAGE = `mewkit skill env — per-skill interpreter environments

Usage:
  mewkit skill env <skill>    create or repair the environment for one skill
  mewkit skill env --list     show every skill that declares a runtime
`;

/** Entry point for the `skill` verb. */
export async function skillCommand(argv: string[]): Promise<number> {
	const projectDir = process.cwd();
	if (argv[0] !== "env") {
		process.stdout.write(USAGE);
		return 1;
	}
	const rest = argv.slice(1);
	if (rest.includes("--list")) return listEnvs(projectDir);
	const skill = rest.find((a) => !a.startsWith("-"));
	if (!skill) {
		process.stdout.write(USAGE);
		return 1;
	}
	return provisionEnv(projectDir, skill);
}
