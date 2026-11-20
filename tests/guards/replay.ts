// Guard replay: fire a host-shaped payload through every hook a runtime registers for an
// event, in a throwaway git repo, and report the decision the host would act on.
//
// The hook list is read from each runtime's own registration file and the registered
// command line is executed as written, so a guard that is added, removed or re-pointed in
// a registration file changes what these suites exercise without editing them.
//
// Every run gets an isolated HOME and an environment built from scratch: no MEOWKIT_* or
// host variables leak in from the developer's shell, so user config cannot change a decision.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type Env = Record<string, string | undefined>;
export type Runtime = "claude-code" | "codex" | "cursor";

export const REPO_ROOT = path.resolve(__dirname, "../..");

/** Where each runtime's hook tree comes from, and the file that registers its hooks. */
const SOURCES: Record<Runtime, { tree: string; dest: string; registration: string; extra: string[] }> = {
	"claude-code": { tree: ".claude/hooks", dest: ".claude/hooks", registration: ".claude/settings.json", extra: [".claude/settings.json"] },
	codex: { tree: "kit/overlays/codex/files/.codex", dest: ".codex", registration: ".codex/hooks.json", extra: [] },
	cursor: { tree: "kit/overlays/cursor/files/.cursor", dest: ".cursor", registration: ".cursor/hooks.json", extra: [] },
};

export interface Hook {
	runtime: Runtime;
	event: string;
	matcher?: string;
	/** Registered command line, before variable expansion. */
	command: string;
	args: string[];
	failClosed?: boolean;
}

export interface HookResult {
	hook: Hook;
	exit: number | null;
	stdout: string;
	stderr: string;
	blocked: boolean;
}

export interface Fixture {
	dir: string;
	home: string;
	git: (...args: string[]) => string;
	write: (rel: string, body: string) => void;
}

const sourcePath = (runtime: Runtime, rel: string): string =>
	runtime === "claude-code" ? path.join(REPO_ROOT, rel) : path.join(REPO_ROOT, SOURCES[runtime].tree, "..", rel);

/** The hooks a runtime registers, read from its registration file in the repo. */
export function registeredHooks(runtime: Runtime): Hook[] {
	type Entry = { type?: string; command: string; args?: string[]; failClosed?: boolean; matcher?: string; hooks?: Entry[] };
	const config = JSON.parse(fs.readFileSync(sourcePath(runtime, SOURCES[runtime].registration), "utf8")) as { hooks?: Record<string, Entry[]> };
	const hooks: Hook[] = [];
	for (const [event, groups] of Object.entries(config.hooks ?? {})) {
		for (const group of groups) {
			// Claude Code and Codex nest commands under a matcher group; Cursor lists them flat.
			const entries = Array.isArray(group.hooks) ? group.hooks : [group];
			for (const entry of entries) {
				if (entry.type !== "command") continue;
				hooks.push({ runtime, event, matcher: group.matcher, command: entry.command, args: entry.args ?? [], failClosed: entry.failClosed });
			}
		}
	}
	return hooks;
}

/** Hook script paths (relative to the project) named by a registered command. */
export function scriptOf(hook: Hook): string {
	const line = [hook.command, ...hook.args].join(" ");
	const match = line.match(/\.(?:claude|codex|cursor)\/hooks\/[\w./-]+\.cjs/);
	return match ? match[0] : line;
}

/** A temp git repo carrying the hook trees of the given runtimes and a small Node project. */
export function makeFixture(runtimes: Runtime[]): Fixture {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mk-guards-")));
	const home = fs.mkdtempSync(path.join(os.tmpdir(), "mk-guards-home-"));
	const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", env: baseEnv(home) as NodeJS.ProcessEnv });
	const write = (rel: string, body: string) => {
		fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
		fs.writeFileSync(path.join(dir, rel), body);
	};
	git("init", "-q");
	git("config", "user.email", "guards@example.com");
	git("config", "user.name", "guards");
	git("config", "commit.gpgsign", "false");
	for (const runtime of runtimes) {
		const src = SOURCES[runtime];
		fs.cpSync(path.join(REPO_ROOT, src.tree), path.join(dir, src.dest), { recursive: true, filter: (p) => !p.includes("__tests__") });
		for (const rel of src.extra) if (fs.existsSync(path.join(REPO_ROOT, rel))) fs.cpSync(path.join(REPO_ROOT, rel), path.join(dir, rel));
	}
	// The kill switch's flag file must not exist; the env var is never passed (see baseEnv).
	fs.rmSync(path.join(dir, ".meowkit/state/cursor-hooks-kill-switch"), { force: true });
	writeNodeProject(write);
	// The repo's own install provides vitest, a runner that can name the tests related to a
	// change; no network, no install step per fixture.
	fs.symlinkSync(path.join(REPO_ROOT, "node_modules"), path.join(dir, "node_modules"), "dir");
	git("add", "-A");
	git("commit", "-qm", "baseline");
	return { dir, home, git, write };
}

/**
 * A project whose lint flags any tracked or staged file containing LINT_ERROR and whose
 * tests run under vitest. The lint script and the test file append to a run counter outside
 * git, so a case can tell how many times the ship check ran, whatever its output format.
 */
function writeNodeProject(write: Fixture["write"]): void {
	write(".gitignore", ".meowkit/\n.runs/\nnode_modules\n");
	write("package.json", JSON.stringify({ name: "guards-fixture", private: true, scripts: { lint: "node scripts/lint.cjs", test: "vitest run" } }, null, 2));
	const counter = (name: string) =>
		`require("node:fs").mkdirSync(".runs",{recursive:true});require("node:fs").appendFileSync(".runs/${name}","1\\n");`;
	write("scripts/lint.cjs", `${counter("lint")}
const files = require("node:child_process").execFileSync("git", ["ls-files", "--cached"], { encoding: "utf8" }).split("\\n").filter(Boolean);
const bad = files.filter((f) => { try { return require("node:fs").readFileSync(f, "utf8").includes("LINT" + "_ERROR"); } catch { return false; } });
if (bad.length) { console.error("lint errors in: " + bad.join(", ")); process.exit(1); }
`);
	write("src/add.cjs", "module.exports = (a, b) => a + b;\n");
	// ESM import, so vitest's module graph links the test to src/add.cjs for `related`.
	write(
		"tests/add.test.mjs",
		`import fs from "node:fs";
import { test, expect } from "vitest";
import add from "../src/add.cjs";
fs.mkdirSync(".runs", { recursive: true });
fs.appendFileSync(".runs/test", "1\\n");
test("add", () => expect(add(2, 2)).toBe(4));
`,
	);
}

/** How many times a fixture script ran (`lint` or `test`). */
export function runCount(fx: Fixture, name: "lint" | "test"): number {
	const file = path.join(fx.dir, ".runs", name);
	return fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).length : 0;
}

/** A clean environment: PATH and an isolated HOME, nothing else from the caller's shell. */
function baseEnv(home: string): Env {
	return { PATH: process.env.PATH, HOME: home, TMPDIR: os.tmpdir(), LANG: "C", GIT_CONFIG_NOSYSTEM: "1" };
}

const matches = (hook: Hook, toolName?: string): boolean =>
	!hook.matcher || toolName === undefined || new RegExp(`^(?:${hook.matcher})$`).test(toolName) || (hook.runtime === "cursor" && new RegExp(hook.matcher).test(toolName));

/** The decision the host reads from one hook run. */
function decision(hook: Hook, exit: number | null, stdout: string): boolean {
	let json: Record<string, unknown> = {};
	try {
		const parsed: unknown = stdout.trim() ? JSON.parse(stdout.trim()) : null;
		if (parsed && typeof parsed === "object") json = parsed as Record<string, unknown>;
	} catch {
		// Not JSON: the exit code is the whole decision.
	}
	if (hook.runtime === "cursor") {
		if (json.permission === "deny" || json.permission === "ask") return true;
		return exit !== 0 && hook.failClosed === true;
	}
	const specific = json.hookSpecificOutput as Record<string, unknown> | undefined;
	if (hook.runtime === "codex" && specific?.permissionDecision === "deny") return true;
	return exit === 2;
}

/** Run one registered hook exactly as the host would launch it. */
export function runHook(fx: Fixture, hook: Hook, payload: unknown, env: Env = {}): HookResult {
	const vars = { CLAUDE_PROJECT_DIR: fx.dir, CURSOR_PROJECT_DIR: fx.dir };
	const expand = (s: string) => s.replace(/\$\{(\w+)\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? "");
	const fullEnv = { ...baseEnv(fx.home), ...(hook.runtime === "cursor" ? { CURSOR_PROJECT_DIR: fx.dir } : {}), ...(hook.runtime === "claude-code" ? { CLAUDE_PROJECT_DIR: fx.dir } : {}), ...env };
	const input = typeof payload === "string" ? payload : JSON.stringify(payload);
	const r = hook.args.length
		? spawnSync(expand(hook.command), hook.args.map(expand), { cwd: fx.dir, input, encoding: "utf8", env: fullEnv as NodeJS.ProcessEnv, timeout: 60_000 })
		: spawnSync("sh", ["-c", hook.command], { cwd: fx.dir, input, encoding: "utf8", env: fullEnv as NodeJS.ProcessEnv, timeout: 60_000 });
	return { hook, exit: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", blocked: decision(hook, r.status, r.stdout ?? "") };
}

/** Fire an event through every hook the runtime registers for it; blocked if any hook blocks. */
export function fireEvent(fx: Fixture, runtime: Runtime, event: string, payload: Record<string, unknown>, opts: { toolName?: string; env?: Env } = {}) {
	const hooks = registeredHooks(runtime).filter((h) => h.event === event && matches(h, opts.toolName));
	const results = hooks.map((h) => runHook(fx, h, { cwd: fx.dir, ...payload }, opts.env));
	return { results, blocked: results.some((r) => r.blocked), ran: hooks.map(scriptOf) };
}
