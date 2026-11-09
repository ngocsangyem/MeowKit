// The PATH-exposure library's own properties: what the rule does when it is called, with the
// four behaviours that are failure modes rather than preferences.
//
// The kit tells the agent to run `mewkit …`; that name only resolves if it is on PATH, and
// an install leaves the launcher in the project rather than on the machine. The host's
// committed mechanism is an append to the env file it names, whose contents run before each
// later shell command — which means this file is shared with every other hook, a `$PATH`
// left unexpanded in it costs PowerShell every hook-set variable, and a directory put on
// the front of PATH can shadow binaries nobody meant to replace.
//
// The handler that calls this library is covered by its sibling suite, so a failure here
// points at the rule and a failure there points at the wiring.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { envFile, loadLib, pathValue, project } from "./lib/launcher-path-fixtures.js";

const { exposeLauncherOnPath, containedLauncher, HINT } = loadLib();

describe("exposing the launcher on PATH", () => {
	it("appends one line and keeps what another hook already wrote", () => {
		const root = project();
		const existing = 'export UNRELATED_FROM_ANOTHER_HOOK="kept"\n';
		const file = envFile(root, existing);

		const note = exposeLauncherOnPath({ projectRoot: root, envFile: file, path: "/usr/bin:/bin" });

		expect(note).toBe("");
		const after = fs.readFileSync(file, "utf-8");
		expect(after.startsWith(existing)).toBe(true);
		const added = after.slice(existing.length).trim().split("\n");
		expect(added).toHaveLength(1);
		expect(added[0]).toMatch(/^export PATH='/);
	});

	it("writes a fully expanded value, never a literal $PATH", () => {
		const root = project();
		const file = envFile(root);
		exposeLauncherOnPath({ projectRoot: root, envFile: file, path: "/usr/bin:/bin" });
		const line = fs.readFileSync(file, "utf-8");
		expect(line).not.toContain("$PATH");
		expect(line).toContain("/usr/bin");
		expect(line).toContain("/bin");
	});

	it("prepends the launcher directory, so a project's pinned copy wins", () => {
		const root = project();
		const file = envFile(root);
		exposeLauncherOnPath({ projectRoot: root, envFile: file, path: "/usr/bin:/global/bin" });
		const value = pathValue(file);
		const entries = value.split(path.delimiter);
		expect(entries[0]).toBe(path.dirname(fs.realpathSync(path.join(root, ".meowkit", "bin", "mewkit"))));
		expect(entries).toContain("/usr/bin");
		expect(entries).toContain("/global/bin");
	});

	it("puts only the launcher on that directory, so nothing else is shadowed", () => {
		const root = project();
		const dir = path.dirname(containedLauncher(root) as string);
		expect(fs.readdirSync(dir)).toEqual(["mewkit"]);
	});

	it("does not append the same entry twice when it is already first", () => {
		const root = project();
		const file = envFile(root);
		const dir = path.dirname(containedLauncher(root) as string);
		const note = exposeLauncherOnPath({ projectRoot: root, envFile: file, path: `${dir}:/usr/bin` });
		expect(note).toBe("");
		expect(fs.readFileSync(file, "utf-8")).toBe("");
	});

	it("fails closed to the doctor hint when the host names no env file", () => {
		const root = project();
		expect(exposeLauncherOnPath({ projectRoot: root, envFile: undefined, path: "/usr/bin" })).toBe(HINT);
		expect(exposeLauncherOnPath({ projectRoot: root, envFile: "", path: "/usr/bin" })).toBe(HINT);
		expect(HINT).toContain("mewkit doctor");
	});

	it("fails closed to the hint when the write cannot happen, rather than throwing", () => {
		const root = project();
		const unwritable = path.join(root, "no-such-directory", "claude-env");
		expect(exposeLauncherOnPath({ projectRoot: root, envFile: unwritable, path: "/usr/bin" })).toBe(HINT);
	});

	it("fails closed to the hint when the project has no launcher", () => {
		const root = project(false);
		const file = envFile(root);
		expect(exposeLauncherOnPath({ projectRoot: root, envFile: file, path: "/usr/bin" })).toBe(HINT);
		expect(fs.readFileSync(file, "utf-8")).toBe("");
	});

	it("writes shell metacharacters in a directory name literally, never as code", () => {
		// A project directory name is attacker-influenced often enough (a clone named from a
		// hostile URL, an archive unpacked into a crafted path) that it has to be treated as
		// data. Inside double quotes a shell would run the `$(…)` and the backticks here.
		const base = fs.mkdtempSync(path.join(tmpdir(), "mk-pathenv-hostile-"));
		const root = path.join(base, 'ev$(touch PWNED)il "quoted" `id` dir');
		fs.mkdirSync(path.join(root, ".meowkit", "bin"), { recursive: true });
		fs.writeFileSync(path.join(root, ".meowkit", "bin", "mewkit"), "#!/usr/bin/env node\n", "utf-8");
		const file = envFile(base);

		expect(exposeLauncherOnPath({ projectRoot: root, envFile: file, path: "/usr/bin" })).toBe("");

		const written = fs.readFileSync(file, "utf-8");
		const launcherDir = path.dirname(fs.realpathSync(path.join(root, ".meowkit", "bin", "mewkit")));
		// The value the shell would end up with is the directory, byte for byte.
		expect(pathValue(file).split(path.delimiter)[0]).toBe(launcherDir);
		// And the dangerous forms are inside single quotes, where they are literal.
		expect(written).toMatch(/^export PATH='/m);
		expect(written).not.toMatch(/^export PATH="/m);

		// Proof rather than inspection: let a real shell evaluate the line and print the result.
		const evaluated = execFileSync("/bin/sh", ["-c", `. ${JSON.stringify(file)}; printf %s "$PATH"`], {
			cwd: base,
			encoding: "utf-8",
		});
		expect(evaluated.split(path.delimiter)[0]).toBe(launcherDir);
		expect(fs.existsSync(path.join(base, "PWNED"))).toBe(false);
		expect(fs.existsSync(path.join(root, "PWNED"))).toBe(false);
	});

	it("escapes a single quote in a directory name, the one byte single quotes cannot hold", () => {
		const base = fs.mkdtempSync(path.join(tmpdir(), "mk-pathenv-quote-"));
		const root = path.join(base, "it's a dir");
		fs.mkdirSync(path.join(root, ".meowkit", "bin"), { recursive: true });
		fs.writeFileSync(path.join(root, ".meowkit", "bin", "mewkit"), "#!/usr/bin/env node\n", "utf-8");
		const file = envFile(base);

		expect(exposeLauncherOnPath({ projectRoot: root, envFile: file, path: "/usr/bin" })).toBe("");
		const launcherDir = path.dirname(fs.realpathSync(path.join(root, ".meowkit", "bin", "mewkit")));
		const evaluated = execFileSync("/bin/sh", ["-c", `. ${JSON.stringify(file)}; printf %s "$PATH"`], {
			cwd: base,
			encoding: "utf-8",
		});
		expect(evaluated.split(path.delimiter)[0]).toBe(launcherDir);
	});

	it("refuses rather than writes when a PATH entry carries a newline", () => {
		const root = project();
		const file = envFile(root);
		// There is no one-line assignment that can hold this, so quoting is not the answer.
		expect(exposeLauncherOnPath({ projectRoot: root, envFile: file, path: "/usr/bin\n/evil" })).toBe(HINT);
		expect(fs.readFileSync(file, "utf-8")).toBe("");
	});

	it("refuses a launcher that resolves outside the project", () => {
		const root = project(false);
		const outside = fs.mkdtempSync(path.join(tmpdir(), "mk-pathenv-outside-"));
		fs.writeFileSync(path.join(outside, "mewkit"), "#!/usr/bin/env node\n", "utf-8");
		fs.mkdirSync(path.join(root, ".meowkit"), { recursive: true });
		fs.symlinkSync(outside, path.join(root, ".meowkit", "bin"));
		expect(containedLauncher(root)).toBeNull();
	});
});
