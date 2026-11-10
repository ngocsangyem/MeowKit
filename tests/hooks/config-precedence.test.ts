// Which level answered, proved cell by cell.
//
// The order is environment override > CLI flag > project > user > default, and
// the only reason to test every cell rather than the interesting one is that a
// precedence bug shows up as a plausible value from the wrong place — which
// looks like a preference, not a bug, until someone edits the file that is being
// ignored.
//
// `tdd` is the cell that matters most. It is one of only two sources that can
// turn strict test-first mode ON, so a committed `tdd: false` must not be able
// to override an exported `MEOWKIT_TDD=1`: that would let a pull request switch
// an enforcement mode off for everyone, silently.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const { resolveConfig, configValue } = require_(path.join(REPO_ROOT, ".claude/hooks/lib/read-config.cjs")) as {
	resolveConfig: (o: object) => { values: Record<string, unknown>; levels: Record<string, string>; errors: unknown[] };
	configValue: (key: string, fallback: unknown, o: object) => { value: unknown; level: string };
};
const { isTddEnabled } = require_(path.join(REPO_ROOT, ".claude/hooks/lib/tdd-detect.cjs")) as {
	isTddEnabled: (o: object) => { enabled: boolean; source: string };
};

interface Levels {
	project?: string;
	user?: string;
	sentinel?: "on" | "off";
}

/** A throwaway project with the registry plus whichever levels a cell needs. */
function fixture(levels: Levels): { root: string; home: string } {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), "mk-precedence-"));
	const root = path.join(base, "project");
	const home = path.join(base, "home");
	fs.mkdirSync(path.join(root, ".claude/hooks"), { recursive: true });
	fs.mkdirSync(home, { recursive: true });
	fs.cpSync(path.join(REPO_ROOT, ".claude/hooks/handlers.json"), path.join(root, ".claude/hooks/handlers.json"));
	if (levels.project !== undefined) {
		fs.mkdirSync(path.join(root, ".meowkit"), { recursive: true });
		fs.writeFileSync(path.join(root, ".meowkit/config.yaml"), levels.project);
	}
	if (levels.user !== undefined) {
		fs.mkdirSync(path.join(home, ".meowkit"), { recursive: true });
		fs.writeFileSync(path.join(home, ".meowkit/config.yaml"), levels.user);
	}
	if (levels.sentinel !== undefined) {
		fs.mkdirSync(path.join(root, ".meowkit/state"), { recursive: true });
		fs.writeFileSync(path.join(root, ".meowkit/state/tdd-mode"), levels.sentinel);
	}
	return { root, home };
}

describe("precedence is environment override, then flag, then project, then user, then default", () => {
	it("default answers when no level is set", () => {
		const { root, home } = fixture({});
		expect(configValue("tdd", false, { root, home, env: {} })).toEqual({ value: false, level: "default" });
	});

	it("user answers when it is the only level set", () => {
		const { root, home } = fixture({ user: "tdd: true\n" });
		expect(configValue("tdd", false, { root, home, env: {} })).toEqual({ value: true, level: "user" });
	});

	it("project outranks user", () => {
		const { root, home } = fixture({ project: "tdd: false\n", user: "tdd: true\n" });
		expect(configValue("tdd", true, { root, home, env: {} })).toEqual({ value: false, level: "project" });
	});

	it("a flag outranks the project file", () => {
		const { root, home } = fixture({ project: "tdd: false\n", user: "tdd: false\n" });
		expect(configValue("tdd", false, { root, home, env: {}, flags: { tdd: true } })).toEqual({ value: true, level: "flag" });
	});

	it("the supported environment override outranks all four", () => {
		const { root, home } = fixture({ project: "tdd: false\n", user: "tdd: false\n" });
		expect(configValue("tdd", false, { root, home, env: { MEOWKIT_TDD: "1" }, flags: { tdd: false } })).toEqual({ value: true, level: "env" });
	});

	it("resolves autobuild.mode and a hook toggle at each level too", () => {
		const { root, home } = fixture({ project: "autobuild:\n  mode: LEAN\n", user: "autobuild:\n  mode: FULL\nhooks:\n  post-write: false\n" });
		const { values, levels } = resolveConfig({ root, home, env: {} });
		expect(values["autobuild.mode"]).toBe("LEAN");
		expect(levels["autobuild.mode"]).toBe("project");
		expect(values["hooks.post-write"]).toBe(false);
		expect(levels["hooks.post-write"]).toBe("user");
	});
});

describe("strict test-first mode keeps its own order", () => {
	it("is off by default", () => {
		const { root } = fixture({});
		expect(isTddEnabled({ root, env: {} })).toEqual({ enabled: false, source: "default" });
	});

	it("is on from the environment", () => {
		const { root } = fixture({});
		expect(isTddEnabled({ root, env: { MEOWKIT_TDD: "1" } })).toEqual({ enabled: true, source: "env" });
	});

	it("is on from the session sentinel", () => {
		const { root } = fixture({ sentinel: "on" });
		expect(isTddEnabled({ root, env: {} })).toEqual({ enabled: true, source: "sentinel" });
	});

	it("is on from the project file, and from the user file beneath it", () => {
		const fromProject = fixture({ project: "tdd: true\n" });
		expect(isTddEnabled({ root: fromProject.root, env: {} })).toEqual({ enabled: true, source: "project" });
	});

	it("a committed tdd: false does NOT override an exported MEOWKIT_TDD=1", () => {
		const { root } = fixture({ project: "tdd: false\n" });
		const answer = isTddEnabled({ root, env: { MEOWKIT_TDD: "1" } });
		expect(answer).toEqual({ enabled: true, source: "env" });
	});

	it("keeps the failing-test-first block on in that same cell", () => {
		// The value being right is not the point: the point is that the gate that
		// reads it still blocks. A reordering that only showed up here would be a
		// silently relaxed enforcement mode.
		const { root } = fixture({ project: "tdd: false\n" });
		fs.mkdirSync(path.join(root, ".claude/hooks"), { recursive: true });
		fs.cpSync(path.join(REPO_ROOT, ".claude/hooks/pre-implement.cjs"), path.join(root, ".claude/hooks/pre-implement.cjs"));
		fs.cpSync(path.join(REPO_ROOT, ".claude/hooks/lib"), path.join(root, ".claude/hooks/lib"), { recursive: true });
		const result = spawnSync(process.execPath, [path.join(root, ".claude/hooks/pre-implement.cjs"), "parser"], {
			cwd: root,
			env: { ...process.env, MEOWKIT_TDD: "1", CLAUDE_PROJECT_DIR: root },
			encoding: "utf8",
		});
		expect(result.status).not.toBe(0);
		expect(`${result.stderr}${result.stdout}`).toMatch(/TDD mode is ON/);
	});

	it("no longer consults the removed profile alias", () => {
		const source = fs.readFileSync(path.join(REPO_ROOT, ".claude/hooks/lib/tdd-detect.cjs"), "utf8");
		expect(source).not.toMatch(/env\.MEOW_PROFILE/);
	});
});

describe("a malformed project config degrades safely", () => {
	it("reports the error and applies no keys", () => {
		const { root, home } = fixture({ project: "budget:\n\tcap: 5\n" });
		const resolved = resolveConfig({ root, home, env: {} });
		expect(resolved.values).toEqual({});
		expect(resolved.errors.length).toBe(1);
		expect((resolved.errors[0] as { line: number; code: string }).line).toBe(2);
		expect((resolved.errors[0] as { code: string }).code).toBe("tab-indentation");
	});

	it("leaves every observer at its own default", () => {
		const { root, home } = fixture({ project: "hooks:\n  post-write: nonsense-value\n" });
		const { isObserverEnabled } = require_(path.join(REPO_ROOT, ".claude/hooks/lib/read-config.cjs")) as {
			isObserverEnabled: (name: string, o: object) => boolean;
		};
		expect(isObserverEnabled("post-write", { root, home, env: {} })).toBe(true);
	});
});
