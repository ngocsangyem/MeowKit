// The launcher and the native binary: which kind of CLI runs, and when a binary is refused.
//
// The binary is a shell script stand-in that answers `--version` with a banner and anything
// else with a marker, so each case shows which CLI the launcher actually ran. Shell scripts
// do not run on Windows, so these cases are Unix-only; the resolution code has no
// platform-specific branch except the `.exe` suffix.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { launcherPath, launcherSource, type LauncherPin } from "../project-launcher.js";

const unix = process.platform !== "win32";

function project(version: string, installedBy: LauncherPin): string {
	const root = fs.mkdtempSync(path.join(tmpdir(), "mk-launcher-native-"));
	fs.mkdirSync(path.dirname(launcherPath(root)), { recursive: true });
	fs.writeFileSync(launcherPath(root), launcherSource(version, installedBy), "utf-8");
	return root;
}

/** A `bin/` directory holding one stand-in executable named `name`. */
function binDir(name: string, banner: string, marker: string): string {
	const dir = fs.mkdtempSync(path.join(tmpdir(), "mk-launcher-bin-"));
	const file = path.join(dir, name);
	fs.writeFileSync(
		file,
		`#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${JSON.stringify(banner)}; else echo ${JSON.stringify(marker)}; fi\n`,
		"utf-8",
	);
	fs.chmodSync(file, 0o755);
	return dir;
}

/** The project's own Node dependency, printing `marker`. */
function nodeDependency(root: string, marker: string): void {
	const dist = path.join(root, "node_modules", "mewkit", "dist");
	fs.mkdirSync(dist, { recursive: true });
	fs.writeFileSync(path.join(dist, "index.js"), `console.log(${JSON.stringify(marker)});\n`, "utf-8");
}

function run(root: string, bin: string | null): { status: number; out: string } {
	const home = fs.mkdtempSync(path.join(tmpdir(), "mk-launcher-home-"));
	const dirs = [...(bin ? [bin] : []), path.dirname(process.execPath), "/bin", "/usr/bin"];
	try {
		const out = execFileSync(process.execPath, [launcherPath(root), "status"], {
			cwd: root,
			encoding: "utf-8",
			env: { ...process.env, PATH: dirs.join(path.delimiter), HOME: home, MEWKIT_INSTALL_DIR: "" },
			stdio: ["pipe", "pipe", "pipe"],
		});
		return { status: 0, out };
	} catch (err) {
		const e = err as { status?: number | null; stdout?: string; stderr?: string };
		return { status: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
	}
}

describe.skipIf(!unix)("a launcher written by the native binary", () => {
	it("runs the binary first, ahead of a Node dependency in the project", () => {
		const root = project("0.1.0", "native");
		nodeDependency(root, "from-node");
		const result = run(root, binDir("mewkit-next", "mewkit-next 0.1.4", "from-binary"));
		expect(result).toMatchObject({ status: 0 });
		expect(result.out).toContain("from-binary");
	});

	it("refuses a binary outside the pinned caret range and falls back to the Node CLI", () => {
		const root = project("0.1.0", "native");
		nodeDependency(root, "from-node");
		for (const banner of ["mewkit-next 0.2.0", "mewkit-next 0.0.9", "mewkit-next 1.1.0"]) {
			const result = run(root, binDir("mewkit-next", banner, "from-binary"));
			expect(result.out, banner).toContain("from-node");
		}
	});

	it("accepts the binary under its future name, `mewkit`", () => {
		const root = project("1.0.0", "native");
		const result = run(root, binDir("mewkit", "mewkit 1.2.0", "from-binary"));
		expect(result.out).toContain("from-binary");
	});

	it("does not take itself for the binary when its own directory is first on PATH", () => {
		// The SessionStart hook puts `.meowkit/bin` first on the agent's PATH, and the launcher
		// is named `mewkit`. Probing itself would recurse until the 5 s timeout.
		const root = project("0.1.0", "native");
		const own = path.dirname(launcherPath(root));
		const bin = binDir("mewkit-next", "mewkit-next 0.1.0", "from-binary");
		const started = Date.now();
		const result = run(root, [own, bin].join(path.delimiter));
		expect(result.out).toContain("from-binary");
		expect(Date.now() - started).toBeLessThan(3000);

		const alone = run(root, own);
		expect(alone.status).toBe(127);
	});

	it("exits 127 when neither kind of CLI is available", () => {
		const root = project("0.1.0", "native");
		const result = run(root, null);
		expect(result.status).toBe(127);
		expect(result.out).toContain("mewkit doctor");
	});
});

describe.skipIf(!unix)("a launcher written by the Node package", () => {
	it("keeps running the Node CLI it was installed with when a binary is also present", () => {
		const root = project("2.3.1", "node");
		nodeDependency(root, "from-node");
		const result = run(root, binDir("mewkit-next", "mewkit-next 0.1.0", "from-binary"));
		expect(result.out).toContain("from-node");
	});

	it("falls back to any binary when the Node CLI is gone", () => {
		const root = project("2.3.1", "node");
		const result = run(root, binDir("mewkit-next", "mewkit-next 0.1.0", "from-binary"));
		expect(result).toMatchObject({ status: 0 });
		expect(result.out).toContain("from-binary");
	});

	it("does not take the Node package's own `mewkit` shim for the binary", () => {
		// The Node CLI prints a bare version, with no `mewkit ` banner in front of it.
		const root = project("2.3.1", "node");
		const result = run(root, binDir("mewkit", "2.3.1", "from-shim"));
		expect(result.status).toBe(127);
		expect(result.out).not.toContain("from-shim");
	});

	it("never accepts a binary through a relative PATH entry", () => {
		const root = project("2.3.1", "node");
		const bin = binDir("mewkit-next", "mewkit-next 0.1.0", "from-binary");
		const relative = path.relative(root, bin);
		const result = run(root, relative);
		expect(result.status).toBe(127);
	});
});
