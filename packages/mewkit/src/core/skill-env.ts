/**
 * Per-skill interpreter environments.
 *
 * One environment per skill, under `.meowkit/envs/<skill>/`, created on demand.
 * The alternative — one shared environment created at every session start — made
 * every project pay for an interpreter that most sessions never used, and made a
 * skill's dependencies everyone's dependencies: a package one skill pinned was
 * installed for all of them, and a conflict between two skills had nowhere to go.
 *
 * Two rules hold everywhere in this module, because they are the ones that keep
 * an optional runtime optional:
 *
 *   Nothing here installs implicitly. Creation happens when a user asks for it
 *   by name. A skill that finds its environment missing reports how to create it
 *   and stops; it never repairs itself mid-task.
 *
 *   An environment gets exactly ONE skill's pinned requirements. No merged set
 *   across skills, no built-in default list — if a package is not pinned in the
 *   skill's own `requirements.txt`, it is not installed.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type SkillsDependency, validatePackageName } from "./skills-dependencies.js";

/** Where environments live, relative to the project root. */
export const ENVS_REL = join(".meowkit", "envs");

/** The frontmatter key naming the interpreter a skill needs. */
export const RUNTIME_KEY = "requires_runtime";

export interface SkillRuntime {
	/** Raw entries, e.g. `["python>=3.9"]`. */
	entries: string[];
	/** Interpreter family of the first entry, e.g. `python`. */
	interpreter: string;
}

/** `<project>/.meowkit/envs/<skill>` — the one environment for one skill. */
export function skillEnvDir(projectDir: string, skill: string): string {
	if (!/^[a-z0-9][a-z0-9-]*$/.test(skill)) throw new Error(`Not a skill directory name: ${skill}`);
	return join(projectDir, ENVS_REL, skill);
}

/** Platform-correct interpreter path inside an environment. */
export function envPythonPath(envDir: string): string {
	return process.platform === "win32" ? join(envDir, "Scripts", "python.exe") : join(envDir, "bin", "python3");
}

/** Platform-correct pip path inside an environment. */
export function envPipPath(envDir: string): string {
	return process.platform === "win32" ? join(envDir, "Scripts", "pip.exe") : join(envDir, "bin", "pip");
}

/** True when the environment exists AND its interpreter is actually present. */
export function envUsable(envDir: string): boolean {
	return existsSync(envPythonPath(envDir));
}

function skillDir(projectDir: string, skill: string): string {
	return join(projectDir, ".claude", "skills", skill);
}

/**
 * Read `requires_runtime` out of a skill's frontmatter.
 *
 * Deliberately a narrow scan rather than a YAML parse: this runs on the path
 * where a skill script is already failing, and pulling in a parser to read one
 * list of short strings would make the diagnostic depend on more than the
 * thing it is diagnosing. Accepts the inline form (`[python>=3.9]`) and the
 * block form (`- python>=3.9`).
 */
export function readSkillRuntime(projectDir: string, skill: string): SkillRuntime | null {
	const skillFile = join(skillDir(projectDir, skill), "SKILL.md");
	let text: string;
	try {
		text = readFileSync(skillFile, "utf-8");
	} catch {
		return null;
	}
	if (!text.startsWith("---")) return null;
	const end = text.indexOf("\n---", 3);
	const frontmatter = end === -1 ? text : text.slice(0, end);

	const lines = frontmatter.split("\n");
	const entries: string[] = [];
	for (let i = 0; i < lines.length; i += 1) {
		const match = /^requires_runtime:\s*(.*)$/.exec(lines[i] ?? "");
		if (!match) continue;
		const inline = (match[1] ?? "").trim();
		if (inline.startsWith("[")) {
			for (const part of inline.replace(/^\[|\]$/g, "").split(",")) {
				const value = part.trim().replace(/^["']|["']$/g, "");
				if (value) entries.push(value);
			}
		} else if (inline) {
			entries.push(inline.replace(/^["']|["']$/g, ""));
		}
		for (let j = i + 1; j < lines.length; j += 1) {
			const item = /^\s*-\s*(.+)$/.exec(lines[j] ?? "");
			if (!item) break;
			entries.push((item[1] ?? "").trim().replace(/^["']|["']$/g, ""));
		}
		break;
	}
	if (!entries.length) return null;
	const interpreter = (/^[a-zA-Z][a-zA-Z0-9_.-]*/.exec(entries[0] ?? "")?.[0] ?? "python").toLowerCase();
	return { entries, interpreter };
}

/** Every skill directory, sorted. */
function allSkills(projectDir: string): string[] {
	try {
		return readdirSync(join(projectDir, ".claude", "skills"), { withFileTypes: true })
			.filter((e) => e.isDirectory() && !e.name.startsWith("."))
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/**
 * Every skill that needs an environment of its own.
 *
 * Declaring an interpreter is one way to need one; the other is pinning
 * packages. Two skills install a command-line BINARY from their pins and never
 * run a `.py` of their own, so they declare no interpreter requirement and
 * still have somewhere their binary has to live. Keying eligibility off "has
 * pins OR declares a runtime" covers both, and keeps the interpreter
 * declaration meaning what it says — this skill runs Python — rather than
 * doubling as a flag for "this skill needs a directory".
 */
export function envSkills(projectDir: string): string[] {
	return allSkills(projectDir).filter(
		(name) => readSkillRuntime(projectDir, name) !== null || skillRequirementsPath(projectDir, name) !== null,
	);
}

/** A skill's own pinned requirements file, or null when it ships none. */
export function skillRequirementsPath(projectDir: string, skill: string): string | null {
	for (const rel of [join("scripts", "requirements.txt"), "requirements.txt"]) {
		const candidate = join(skillDir(projectDir, skill), rel);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

export interface SkillRequirements {
	/** The file the pins came from, or null for a skill that ships none. */
	source: string | null;
	packages: SkillsDependency[];
	/** Lines that failed package-name validation. Reported, never installed. */
	rejected: string[];
}

/**
 * Read ONE skill's pins. A skill with no requirements file yields an empty set,
 * which is the correct answer for a skill whose scripts are standard-library
 * only — it still gets an environment, just an empty one.
 */
export function readSkillRequirements(projectDir: string, skill: string): SkillRequirements {
	const source = skillRequirementsPath(projectDir, skill);
	if (!source) return { source: null, packages: [], rejected: [] };

	const packages: SkillsDependency[] = [];
	const rejected: string[] = [];
	for (const raw of readFileSync(source, "utf-8").split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		if (validatePackageName(line)) packages.push({ name: line, description: "" });
		else rejected.push(line);
	}
	return { source, packages, rejected };
}
