// No committed caller of the CLI may branch on an invocation error being exit 1.
//
// The exit codes now mean one thing each: 0 ran and succeeded, 1 ran and failed, 2 the
// invocation was wrong. Eleven commands used to answer a mistyped sub-verb with 1, so a
// caller written against that would silently change behaviour when they moved to 2. Nothing
// in the tree does — every call site tests `!== 0` — and this test is what keeps that true,
// because the property is cheap to hold and expensive to discover having lost.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The trees that hold committed callers of the CLI. */
const TREES = [
	path.join(".claude", "hooks"),
	path.join(".claude", "scripts"),
	"scripts",
	"tests",
	".github",
];

const SKIP_DIRS = new Set(["node_modules", "dist", "worktrees", "logs", ".git"]);
const EXTENSIONS = new Set([".cjs", ".js", ".mjs", ".ts", ".sh", ".yml", ".yaml", ".py"]);

/**
 * A caller reading 1 as a specific meaning, in every shape this tree could write it:
 *   JS/TS  — `status === 1`, `code == 1`, and the reverse order `1 === status`
 *   POSIX  — `[ $? -eq 1 ]`, `[ "$?" = "1" ]`, `[ "$?" == 1 ]`
 * The first version of this guard caught only the first two forms, which is narrower than
 * the invariant it is named for: an invocation error is 2, and nothing may depend on 1.
 */
const EXIT_NAMES = String.raw`status|code|exitCode|exit_code|exitStatus|ret|rc`;
const EXIT_ONE = new RegExp(
	[
		String.raw`\b(?:${EXIT_NAMES})\b\s*(?:===|==)\s*1\b`,
		String.raw`\b1\s*(?:===|==)\s*[\w.$\[\]"']*\b(?:${EXIT_NAMES})\b`,
		String.raw`-eq\s+1\b`,
		// `[ "$?" = "1" ]`, `[ $? == 1 ]`, and the same with the status in a variable.
		String.raw`\$\{?(?:\?|${EXIT_NAMES})\}?"?\s*(?:==?)\s*"?1"?(?:\s|\]|\)|;|$)`,
	].join("|"),
);

function walk(dir: string, out: string[]): void {
	if (!fs.existsSync(dir)) return;
	for (const name of fs.readdirSync(dir)) {
		if (SKIP_DIRS.has(name)) continue;
		const abs = path.join(dir, name);
		if (fs.statSync(abs).isDirectory()) walk(abs, out);
		else if (EXTENSIONS.has(path.extname(abs))) out.push(abs);
	}
}

describe("committed callers of the CLI", () => {
	it("never compares an exit code to 1", () => {
		const files: string[] = [];
		for (const tree of TREES) walk(path.join(REPO_ROOT, tree), files);
		expect(files.length).toBeGreaterThan(50);

		const offenders: string[] = [];
		for (const file of files) {
			// This test is itself allowed to name the pattern it forbids.
			if (file === fileURLToPath(import.meta.url)) continue;
			const lines = fs.readFileSync(file, "utf-8").split("\n");
			lines.forEach((line, index) => {
				if (EXIT_ONE.test(line)) offenders.push(`${path.relative(REPO_ROOT, file)}:${index + 1}: ${line.trim()}`);
			});
		}
		expect(offenders, offenders.join("\n")).toEqual([]);
	});

	it("catches every shape of that comparison, so the guard matches the invariant", () => {
		// Each line below is a real way this tree could read 1 as a meaning; a guard that
		// missed any of them would report "clean" while the dependency existed.
		for (const offender of [
			"if (result.status === 1) return;",
			"if (1 === result.status) return;",
			"const bad = r.code == 1;",
			'[ "$?" = "1" ] && exit 3',
			"[ $? == 1 ] && exit 3",
			"if [ $? -eq 1 ]; then exit 3; fi",
		]) {
			expect(EXIT_ONE.test(offender), offender).toBe(true);
		}
		// And the forms that are fine stay fine, or the guard would fail every clean tree.
		for (const allowed of [
			"if (result.status !== 0) return;",
			"const ok = r.status === 0;",
			'[ "$?" -ne 0 ] && exit 3',
			"expect(codeOf(['zzbogus'])).toBe(2);",
			"const retries = 1;",
		]) {
			expect(EXIT_ONE.test(allowed), allowed).toBe(false);
		}
	});

	it("still distinguishes a usage error from a command that ran and failed", () => {
		const cli = path.join(REPO_ROOT, "packages", "mewkit", "dist", "index.js");
		const codeOf = (args: string[]): number => {
			try {
				execFileSync(process.execPath, [cli, ...args], { cwd: REPO_ROOT, stdio: ["pipe", "pipe", "pipe"] });
				return 0;
			} catch (err) {
				return (err as { status?: number | null }).status ?? -1;
			}
		};
		expect(codeOf(["zzbogus"])).toBe(2);
		expect(codeOf(["plan", "zzbogus"])).toBe(2);
		expect(codeOf(["versions"])).toBe(0);
	});
});
