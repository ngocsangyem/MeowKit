// The one way to downgrade Gate 1, and the three ways it refuses.
//
// A hatch is only safe while every use of it is recorded and every way of
// reaching it is deliberate. So this suite asserts the three refusals as hard as
// it asserts the two working forms: scope collapse, where the "user" file turns
// out to be the committed project file; an unloggable downgrade, where the
// record cannot be written; and a committed project config trying to express the
// hatch at all.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const { resolveHatch, LOG_REL } = require_(path.join(REPO_ROOT, ".claude/hooks/lib/gate1-hatch.cjs")) as {
	resolveHatch: (o: object) => { downgrade: boolean; source: string | null; notices: string[] };
	LOG_REL: string;
};

const CONFIG_REL = path.join(".meowkit", "config.yaml");

function layout(): { root: string; home: string } {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), "mk-hatch-"));
	const root = path.join(base, "project");
	const home = path.join(base, "home");
	fs.mkdirSync(root, { recursive: true });
	fs.mkdirSync(home, { recursive: true });
	return { root, home };
}

const writeConfig = (dir: string, body: string): void => {
	fs.mkdirSync(path.join(dir, ".meowkit"), { recursive: true });
	fs.writeFileSync(path.join(dir, CONFIG_REL), body);
};

const log = (root: string): string => {
	try {
		return fs.readFileSync(path.join(root, LOG_REL), "utf8");
	} catch {
		return "";
	}
};

describe("the Gate 1 escape hatch", () => {
	it("applies from the environment and records one line naming the source", () => {
		const { root, home } = layout();
		const result = resolveHatch({ root, home, env: { MEOWKIT_GATE1_PRESENCE_ONLY: "1" } });
		expect(result.downgrade).toBe(true);
		expect(result.source).toBe("env");
		expect(log(root).trim().split("\n").length).toBe(1);
		expect(log(root)).toContain("MEOWKIT_GATE1_PRESENCE_ONLY");
		expect(result.notices.join(" ")).toContain("presence-only");
	});

	it("applies from the user file and records one line naming it", () => {
		const { root, home } = layout();
		writeConfig(home, "gate1PresenceOnly: true\n");
		const result = resolveHatch({ root, home, env: {} });
		expect(result.downgrade).toBe(true);
		expect(result.source).toBe("user-config");
		expect(log(root).trim().split("\n").length).toBe(1);
		expect(log(root)).toContain("gate1PresenceOnly");
	});

	it("does nothing when neither form is set, and writes no log line", () => {
		const { root, home } = layout();
		const result = resolveHatch({ root, home, env: {} });
		expect(result.downgrade).toBe(false);
		expect(log(root)).toBe("");
	});

	it("ignores gate1PresenceOnly in the project file", () => {
		const { root, home } = layout();
		writeConfig(root, "gate1PresenceOnly: true\n");
		expect(resolveHatch({ root, home, env: {} }).downgrade).toBe(false);
	});

	it("ignores a false value and any other key in the user file", () => {
		const { root, home } = layout();
		writeConfig(home, "gate1PresenceOnly: false\ntdd: true\n");
		expect(resolveHatch({ root, home, env: {} }).downgrade).toBe(false);
	});

	it("refuses when the project root IS the home directory", () => {
		// A dotfiles-style repository, or a container where the workspace is
		// `$HOME`: the two paths are then the same file and "outside the
		// repository" was never true.
		const base = fs.mkdtempSync(path.join(os.tmpdir(), "mk-hatch-collapse-"));
		writeConfig(base, "gate1PresenceOnly: true\n");
		const result = resolveHatch({ root: base, home: base, env: {} });
		expect(result.downgrade).toBe(false);
		expect(result.notices.join(" ")).toMatch(/pull request/);
		expect(log(base)).toMatch(/REFUSED/);
	});

	it("refuses when a symlink makes the two the same file", () => {
		const { root, home } = layout();
		writeConfig(root, "gate1PresenceOnly: true\n");
		fs.symlinkSync(path.join(root, ".meowkit"), path.join(home, ".meowkit"));
		const result = resolveHatch({ root, home, env: {} });
		expect(result.downgrade).toBe(false);
		expect(result.notices.join(" ")).toMatch(/pull request/);
	});

	it("still honours the environment variable in that layout", () => {
		// An environment variable is not editable by a pull request, so it stays
		// available where the file form is refused.
		const base = fs.mkdtempSync(path.join(os.tmpdir(), "mk-hatch-collapse-env-"));
		writeConfig(base, "gate1PresenceOnly: true\n");
		expect(resolveHatch({ root: base, home: base, env: { MEOWKIT_GATE1_PRESENCE_ONLY: "1" } }).downgrade).toBe(true);
	});

	it("fails closed when the record cannot be written", () => {
		for (const form of ["env", "user"] as const) {
			const { root, home } = layout();
			if (form === "user") writeConfig(home, "gate1PresenceOnly: true\n");
			// A file where the telemetry directory must go: the append cannot
			// succeed, and an unrecorded gate downgrade is not permitted.
			fs.mkdirSync(path.join(root, ".meowkit"), { recursive: true });
			fs.writeFileSync(path.join(root, ".meowkit/telemetry"), "not a directory");
			const env = form === "env" ? { MEOWKIT_GATE1_PRESENCE_ONLY: "1" } : {};
			const result = resolveHatch({ root, home, env });
			expect(result.downgrade, form).toBe(false);
			expect(result.notices.join(" "), form).toMatch(/could not be recorded/);
		}
	});

	it("fails closed when the project directory itself is read-only", () => {
		const { root, home } = layout();
		writeConfig(home, "gate1PresenceOnly: true\n");
		fs.chmodSync(root, 0o500);
		try {
			expect(resolveHatch({ root, home, env: {} }).downgrade).toBe(false);
		} finally {
			fs.chmodSync(root, 0o700);
		}
	});

	it("cannot return any key other than the hatch", () => {
		const { readHatchKey } = require_(path.join(REPO_ROOT, ".claude/hooks/lib/gate1-hatch.cjs")) as {
			readHatchKey: (file: string) => boolean | undefined;
		};
		const { home } = layout();
		writeConfig(home, "tdd: true\nautobuild:\n  mode: LEAN\n");
		// The reader's return type is a boolean or nothing. There is no shape in
		// which a second key could reach the gate.
		expect(readHatchKey(path.join(home, CONFIG_REL))).toBeUndefined();
	});
});
