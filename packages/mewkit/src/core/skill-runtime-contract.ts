/**
 * The runtime contract a SKILL.md frontmatter has to satisfy.
 *
 * `requires_runtime` names an INTERPRETER the project may not have installed.
 * `runtime` names the agent EXECUTION ENVIRONMENT. The two were one permissive,
 * unvalidated key away from being used interchangeably, and a skill whose
 * interpreter requirement lands in the wrong field gets no environment at all —
 * so both confusions are errors here, in both directions.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { RUNTIME_KEY } from "./skill-env.js";

/** Values that belong in `runtime`; naming one in `requires_runtime` is a confusion. */
const EXECUTION_ENVIRONMENTS = new Set(["claude-code", "portable", "experimental"]);

/** Interpreter families; naming one in `runtime` is the mirror-image confusion. */
const INTERPRETERS = new Set(["python", "python3", "node", "ruby", "php", "perl", "go", "java", "deno", "bun"]);

/** How deep a skill directory is walked when looking for its own files. */
const MAX_DEPTH = 3;

type Frontmatter = Record<string, unknown>;

function values(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
	return [];
}

/** Interpreter family of an entry, e.g. `python>=3.9` → `python`. */
function interpreterOf(entry: string): string {
	return (/^[a-zA-Z][a-zA-Z0-9_.-]*/.exec(entry)?.[0] ?? "").toLowerCase();
}

/** Both field confusions, plus an unrecognised interpreter family. */
export function runtimeContractErrors(fm: Frontmatter): string[] {
	const errors: string[] = [];
	for (const value of values(fm.runtime)) {
		if (INTERPRETERS.has(interpreterOf(value))) {
			errors.push(`'runtime: ${value}' names an interpreter — use '${RUNTIME_KEY}' for that`);
		}
	}
	for (const entry of values(fm[RUNTIME_KEY])) {
		if (EXECUTION_ENVIRONMENTS.has(entry.toLowerCase())) {
			errors.push(`'${RUNTIME_KEY}: ${entry}' names an execution environment — use 'runtime' for that`);
		} else if (!INTERPRETERS.has(interpreterOf(entry))) {
			errors.push(`'${RUNTIME_KEY}: ${entry}' names no known interpreter`);
		}
	}
	return errors;
}

function walk(dir: string, depth: number, visit: (full: string, name: string, isDir: boolean) => boolean): void {
	if (depth > MAX_DEPTH) return;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		const descend = visit(full, entry.name, entry.isDirectory());
		if (entry.isDirectory() && descend) walk(full, depth + 1, visit);
	}
}

/** Every `.md` under a skill directory, concatenated — the skill's own prose. */
function markdownCorpus(skillDir: string): string {
	const parts: string[] = [];
	try {
		walk(skillDir, 0, (full, name, isDir) => {
			if (!isDir && name.endsWith(".md")) parts.push(readFileSync(full, "utf-8"));
			return true;
		});
	} catch {
		return "";
	}
	return parts.join("\n");
}

/**
 * Non-test `.py` files on a skill's documented invocation path: a script that
 * exists AND is named by the skill's own markdown. A `.py` nothing documents is
 * not something a user is told to run, so it does not oblige a declaration.
 */
export function documentedPythonScripts(skillDir: string): string[] {
	const scripts: string[] = [];
	try {
		walk(skillDir, 0, (full, name, isDir) => {
			if (isDir) return name !== "tests" && name !== "__pycache__";
			if (name.endsWith(".py") && !name.startsWith("test_")) scripts.push(path.relative(skillDir, full));
			return false;
		});
	} catch {
		return [];
	}
	const prose = markdownCorpus(skillDir);
	return scripts.filter((rel) => prose.includes(path.basename(rel)));
}
