// The committed launcher: resolvable from a clone, refusing with a next action, and never
// reaching the network on any branch.
//
// An `npx` install left nothing in the project that could run the CLI, so hooks had no
// executable to trust and prose naming `mewkit …` could not resolve. A hook is the worst
// place to discover you have no network, so the launcher resolves what is already on the
// machine and reports when it cannot — it never fetches.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { cliRecordPath, LAUNCHER_REL, launcherPath, launcherSource, writeLauncher } from "../project-launcher.js";
import { executableIsTrusted } from "../hook-runtime.js";

function scratchProject(): string {
	const dir = fs.mkdtempSync(path.join(tmpdir(), "mk-launcher-"));
	fs.mkdirSync(path.join(dir, ".meowkit"), { recursive: true });
	return dir;
}

/**
 * A disposable stand-in for the home directory the CLI records installs under. Without it
 * these tests write a real `~/.mewkit/cli/<version>.json` on the developer's machine, which
 * outlives the run and names a temp path that no longer exists — residue one run leaves for
 * the next to trip over, and the opposite of what asserting inside a throwaway directory is for.
 */
function scratchHome(): string {
	return fs.mkdtempSync(path.join(tmpdir(), "mk-launcher-home-"));
}

/** A standalone CLI stand-in, so the test never depends on a built dist or a home record. */
function fakeCli(dir: string, output: string): string {
	const entry = path.join(dir, "fake-cli.js");
	fs.writeFileSync(entry, `console.log(${JSON.stringify(output)});\n`, "utf-8");
	return entry;
}

function runLauncher(root: string, env: NodeJS.ProcessEnv = {}): { status: number; out: string } {
	try {
		const out = execFileSync(process.execPath, [launcherPath(root), "--version"], {
			cwd: root,
			encoding: "utf-8",
			env: { ...process.env, ...env },
			stdio: ["pipe", "pipe", "pipe"],
		});
		return { status: 0, out };
	} catch (err) {
		const e = err as { status?: number | null; stdout?: string; stderr?: string };
		return { status: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
	}
}

describe("the launcher file", () => {
	it("is written at the committed path, executable, pinned to the installing version", () => {
		const root = scratchProject();
		writeLauncher(root, { version: "9.9.9-test", cliEntry: fakeCli(root, "irrelevant"), storeHome: scratchHome() });
		expect(LAUNCHER_REL).toBe(path.join(".meowkit", "bin", "mewkit"));
		const stat = fs.statSync(launcherPath(root));
		expect(stat.isFile()).toBe(true);
		expect(stat.mode & 0o111).toBeGreaterThan(0);
		expect(fs.readFileSync(launcherPath(root), "utf-8")).toContain('"9.9.9-test"');
	});

	it("reaches no network, no package manager and no credential on any branch", () => {
		const text = launcherSource("1.2.3");
		for (const pattern of [
			/https?:\/\//,
			/fetch\(/,
			/node:https|require\('https'\)/,
			/\bnpx\b/,
			/\bnpm\b|\bpnpm\b|\byarn\b/,
			/curl|wget/,
			/\.npmrc|credential|keychain|NPM_TOKEN/i,
		]) {
			expect(pattern.test(text), `launcher must not contain ${pattern}`).toBe(false);
		}
	});

	it("carries no copy of the CLI, only a resolution of one", () => {
		// A vendored engine would be a second thing to keep current; the whole point is
		// that the launcher is small enough to read.
		expect(launcherSource("1.2.3").split("\n").length).toBeLessThan(80);
	});

	it("passes the existing containment gate, and an exiled copy does not", () => {
		const root = scratchProject();
		writeLauncher(root, { version: "9.9.9-test", cliEntry: fakeCli(root, "irrelevant"), storeHome: scratchHome() });
		expect(executableIsTrusted(launcherPath(root), root)).toBe(true);

		const outside = fs.mkdtempSync(path.join(tmpdir(), "mk-launcher-outside-"));
		const exiled = path.join(outside, "mewkit");
		fs.copyFileSync(launcherPath(root), exiled);
		expect(executableIsTrusted(exiled, root)).toBe(false);
	});
});

describe("launcher resolution", () => {
	it("prefers the project's own dependency over the machine record", () => {
		const root = scratchProject();
		const home = scratchHome();
		writeLauncher(root, { version: "9.9.9-test", cliEntry: fakeCli(root, "from-record"), storeHome: home });
		const dep = path.join(root, "node_modules", "mewkit", "dist");
		fs.mkdirSync(dep, { recursive: true });
		fs.writeFileSync(path.join(dep, "index.js"), 'console.log("from-project-dependency");\n', "utf-8");

		// HOME points at the store the record was written to, so the record really is
		// available and losing to the project copy on merit rather than on absence.
		const result = runLauncher(root, { HOME: home, USERPROFILE: home });
		expect(result.status).toBe(0);
		expect(result.out).toContain("from-project-dependency");
	});

	it("falls through to the machine record when the project has no dependency of its own", () => {
		const root = scratchProject();
		const home = scratchHome();
		writeLauncher(root, { version: "9.9.9-test", cliEntry: fakeCli(root, "from-record"), storeHome: home });

		// The `npx`-install case: nothing in the project, so the pinned record is the only
		// way through. Previously this branch had no test at all.
		const result = runLauncher(root, { HOME: home, USERPROFILE: home });
		expect(result.status).toBe(0);
		expect(result.out).toContain("from-record");
		expect(JSON.parse(fs.readFileSync(cliRecordPath("9.9.9-test", home), "utf-8"))).toMatchObject({
			version: "9.9.9-test",
		});
	});

	it("records nothing outside the store it was given", () => {
		const root = scratchProject();
		const home = scratchHome();
		writeLauncher(root, { version: "9.9.9-probe", cliEntry: fakeCli(root, "irrelevant"), storeHome: home });
		expect(fs.existsSync(cliRecordPath("9.9.9-probe", home))).toBe(true);
		// The same version under the real home directory must not exist, which is the
		// property that makes this suite leave the machine as it found it.
		expect(fs.existsSync(cliRecordPath("9.9.9-probe"))).toBe(false);
	});

	it("refuses with the version it wanted and a next action when nothing resolves", () => {
		const root = scratchProject();
		// A version this machine has never installed: no record, no dependency.
		writeLauncher(root, {
			version: "0.0.0-absent",
			cliEntry: path.join(root, "does-not-exist.js"),
			storeHome: scratchHome(),
		});
		const result = runLauncher(root);
		expect(result.status).not.toBe(0);
		expect(result.out).toContain("0.0.0-absent");
		expect(result.out).toContain("mewkit doctor");
		// A refusal is a message, not a crash report.
		expect(result.out).not.toMatch(/\n\s+at\s/);
	});
});
