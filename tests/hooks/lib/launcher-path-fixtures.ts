// Fixtures shared by the two suites that cover exposing the launcher on PATH: the library's
// own properties, and the SessionStart handler that calls it.
//
// They live here rather than in either suite because both need the same three things — a
// project with (or without) a committed launcher, an env file the host would evaluate, and a
// way to read back the value a shell would end up with — and a copy in each file is a copy
// that can drift.
import { expect } from "vitest";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const LIB = path.join(REPO_ROOT, ".claude", "hooks", "lib", "launcher-path-env.cjs");

export interface LauncherPathLib {
	exposeLauncherOnPath: (options: Record<string, unknown>) => string;
	containedLauncher: (projectRoot: string) => string | null;
	singleQuote: (value: string) => string;
	HINT: string;
}

export function loadLib(): LauncherPathLib {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	return require(LIB) as LauncherPathLib;
}

/** A scratch project, with the committed launcher in place unless asked otherwise. */
export function project(withLauncher = true): string {
	const dir = fs.mkdtempSync(path.join(tmpdir(), "mk-pathenv-"));
	if (withLauncher) writeLauncherFile(dir);
	return dir;
}

/** The launcher as an install would leave it: executable, at the committed path. */
export function writeLauncherFile(projectRoot: string): string {
	const target = path.join(projectRoot, ".meowkit", "bin", "mewkit");
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, "#!/usr/bin/env node\n", "utf-8");
	fs.chmodSync(target, 0o755);
	return target;
}

/** The file the host names in `CLAUDE_ENV_FILE` and evaluates before later shell commands. */
export function envFile(dir: string, contents = ""): string {
	const file = path.join(dir, "claude-env");
	fs.writeFileSync(file, contents, "utf-8");
	return file;
}

/** The PATH the appended assignment sets, unquoted the way a shell would read it. */
export function pathValue(file: string): string {
	const line = /^export PATH='(.*)'$/m.exec(fs.readFileSync(file, "utf-8"));
	expect(line, `no quoted PATH assignment in ${file}`).not.toBeNull();
	return (line?.[1] ?? "").split("'\\''").join("'");
}
