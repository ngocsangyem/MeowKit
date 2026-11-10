import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCodexModuleDir } from "../codex-authored-bundle.js";

// Exercises the authored Codex safety hooks against the real Codex hook contract:
// JSON on stdin, deny = stdout `{hookSpecificOutput:{permissionDecision:"deny"}}` at exit 0,
// allow = exit 0 with no deny. Runs the actual .cjs files as Codex would. The gate runs the
// shared Gate 1 decision (approved plan + fresh receipt + signed contract) and fails closed.
const hooksDir = join(resolveCodexModuleDir(), "root", ".codex", "hooks");
const { stamp } = createRequire(import.meta.url)(join(hooksDir, "lib", "approval-receipt.cjs")) as {
	stamp: (file: string, approver: string) => { code: number };
};

function runHook(name: string, payload: unknown, cwdPayload?: string, dir = hooksDir) {
	const body = cwdPayload ? { cwd: cwdPayload, ...(payload as object) } : payload;
	const env = { ...process.env };
	for (const key of ["MEOWKIT_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "CURSOR_PROJECT_DIR", "MEOWKIT_AUTOBUILD_MODE"])
		delete env[key];
	const res = spawnSync(process.execPath, [join(dir, name)], { input: JSON.stringify(body), encoding: "utf-8", env });
	return {
		status: res.status,
		stdout: res.stdout ?? "",
		denied: (res.stdout ?? "").includes('"permissionDecision":"deny"'),
	};
}

/** A git project with an approved plan for slug `demo` and a signed sprint contract. */
function approvedProject(root: string): string {
	spawnSync("git", ["init", "-q"], { cwd: root });
	const plan = join(root, "tasks", "plans", "260101-demo", "plan.md");
	mkdirSync(join(root, "tasks", "plans", "260101-demo"), { recursive: true });
	writeFileSync(plan, "---\ntitle: demo\n---\n# plan\n");
	expect(stamp(plan, "tester").code).toBe(0);
	mkdirSync(join(root, "tasks", "contracts"), { recursive: true });
	writeFileSync(join(root, "tasks", "contracts", "260101-demo-sprint-1.md"), "---\nstatus: signed\n---\n");
	return plan;
}

const patch = (...paths: string[]) =>
	`*** Begin Patch\n${paths.map((p) => `*** Update File: ${p}\n+x\n`).join("")}*** End Patch`;
const edit = (...paths: string[]) => ({ tool_name: "apply_patch", tool_input: { command: patch(...paths) } });

describe("codex privacy-block hook (PreToolUse/Bash)", () => {
	it("denies a Bash command that reads a sensitive file, exit 0 + deny JSON", () => {
		const r = runHook("privacy-block.cjs", { tool_name: "Bash", tool_input: { command: "cat .env.local" } });
		expect(r.status).toBe(0);
		expect(r.denied).toBe(true);
	});
	it("denies exfiltration of an SSH private key", () => {
		const r = runHook("privacy-block.cjs", { tool_name: "Bash", tool_input: { command: "cp ~/.ssh/id_rsa /tmp/x" } });
		expect(r.denied).toBe(true);
	});
	it("denies base64 of a credentials file", () => {
		const r = runHook("privacy-block.cjs", { tool_name: "Bash", tool_input: { command: "base64 credentials.json" } });
		expect(r.denied).toBe(true);
	});
	it("denies a fetch aimed at a loopback host, as Claude Code does", () => {
		const r = runHook("privacy-block.cjs", {
			tool_name: "Bash",
			tool_input: { command: "python3 fetch_as_markdown.py http://127.0.0.1:8080/x" },
		});
		expect(r.denied).toBe(true);
	});
	it("allows an ordinary build command (no false positive)", () => {
		const r = runHook("privacy-block.cjs", { tool_name: "Bash", tool_input: { command: "npm run build" } });
		expect(r.denied).toBe(false);
	});
	it("allows prose that merely mentions the word secret", () => {
		const r = runHook("privacy-block.cjs", { tool_name: "Bash", tool_input: { command: "echo my secret plan" } });
		expect(r.denied).toBe(false);
	});
	it("denies on invalid stdin (a guard that cannot read the command must not allow it)", () => {
		const res = spawnSync(process.execPath, [join(hooksDir, "privacy-block.cjs")], {
			input: "not json",
			encoding: "utf-8",
		});
		expect(res.status).toBe(0);
		expect(res.stdout).toContain('"permissionDecision":"deny"');
	});
});

describe("codex gate-enforcement hook (PreToolUse/apply_patch)", () => {
	let project: string;
	beforeEach(() => {
		project = realpathSync(mkdtempSync(join(tmpdir(), "codex-gate-")));
	});
	afterEach(() => rmSync(project, { recursive: true, force: true }));

	it("denies a source edit when no approved plan exists", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		const r = runHook("gate-enforcement.cjs", edit("src/x.ts"), project);
		expect(r.status).toBe(0);
		expect(r.denied).toBe(true);
	});
	it("allows a source edit once the plan is approved and the contract signed", () => {
		approvedProject(project);
		expect(runHook("gate-enforcement.cjs", edit("src/x.ts"), project).denied).toBe(false);
	});
	it("denies a source edit when the plan has no approval receipt", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		mkdirSync(join(project, "tasks", "plans", "260101-x"), { recursive: true });
		writeFileSync(join(project, "tasks", "plans", "260101-x", "plan.md"), "---\ntitle: x\n---\n# plan\n");
		const r = runHook("gate-enforcement.cjs", edit("src/x.ts"), project);
		expect(r.denied).toBe(true);
		expect(r.stdout).toContain("has no approval receipt");
	});
	it("denies a source edit when the plan changed after approval", () => {
		appendFileSync(approvedProject(project), "new scope\n");
		const r = runHook("gate-enforcement.cjs", edit("src/x.ts"), project);
		expect(r.denied).toBe(true);
		expect(r.stdout).toContain("receipt is stale");
	});
	it("judges every file in a patch: docs plus source without a plan is denied", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		expect(runHook("gate-enforcement.cjs", edit("docs/a.md"), project).denied).toBe(false);
		expect(runHook("gate-enforcement.cjs", edit("docs/a.md", "src/b.ts"), project).denied).toBe(true);
	});
	it("gates the destination of a move", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		const move = {
			tool_name: "apply_patch",
			tool_input: { command: "*** Begin Patch\n*** Update File: docs/a.md\n*** Move to: src/a.ts\n*** End Patch" },
		};
		expect(runHook("gate-enforcement.cjs", move, project).denied).toBe(true);
	});
	it("always allows test files, docs, plan files and the runtime's own trees (no plan needed)", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		for (const p of [
			"src/x.test.ts",
			"docs/readme.md",
			"tasks/plans/p/plan.md",
			".codex/config.toml",
			".agents/skills/a/SKILL.md",
		]) {
			expect(runHook("gate-enforcement.cjs", edit(p), project).denied, `${p} should be allowed`).toBe(false);
		}
	});
	it("rejects a backup/legacy path", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		expect(runHook("gate-enforcement.cjs", edit("src/x.bak/y.ts"), project).denied).toBe(true);
	});
	it("denies when the call names no file it can read (unknown payload shape)", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		const r = runHook(
			"gate-enforcement.cjs",
			{ tool_name: "apply_patch", tool_input: { command: "no file markers here" } },
			project,
		);
		expect(r.denied).toBe(true);
	});
	it("reads targets from a structured patch keyed by path", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		const r = runHook(
			"gate-enforcement.cjs",
			{ tool_name: "apply_patch", tool_input: { changes: { "src/a.ts": { type: "add" } } } },
			project,
		);
		expect(r.denied).toBe(true);
	});
	it("denies a write outside the project root, even into a kit-looking tree", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		expect(runHook("gate-enforcement.cjs", edit("../outside/.claude/hooks/x.cjs"), project).denied).toBe(true);
	});
	it("denies outside a git repository, where no root can be trusted", () => {
		approvedProject(project);
		rmSync(join(project, ".git"), { recursive: true, force: true });
		expect(runHook("gate-enforcement.cjs", edit("src/x.ts"), project).denied).toBe(true);
	});
	it("denies on unreadable stdin", () => {
		const res = spawnSync(process.execPath, [join(hooksDir, "gate-enforcement.cjs")], {
			input: "not json",
			encoding: "utf-8",
		});
		expect(res.stdout).toContain('"permissionDecision":"deny"');
	});
	it("denies when the tree has no runtime config", () => {
		const copy = join(project, "hooks");
		cpSync(hooksDir, copy, { recursive: true });
		rmSync(join(copy, "hook-runtime-config.json"));
		approvedProject(project);
		const r = runHook("gate-enforcement.cjs", edit("docs/a.md"), project, copy);
		expect(r.denied).toBe(true);
		expect(r.stdout).toContain("hook-runtime-config.json");
	});
});

// Codex documents that a session may start in a subdirectory and sets no project-root
// environment variable, so the hook resolves the root from the git top level. With the payload
// cwd below the root, the gate must still find the plan and classify targets root-relative.
describe("codex gate-enforcement hook (session started in a subdirectory)", () => {
	let project: string;
	let subdir: string;

	beforeEach(() => {
		project = realpathSync(mkdtempSync(join(tmpdir(), "codex-gate-sub-")));
		subdir = join(project, "packages", "web");
		mkdirSync(subdir, { recursive: true });
	});
	afterEach(() => rmSync(project, { recursive: true, force: true }));

	it("finds the root plan via the git top level when the session cwd is a subdirectory", () => {
		approvedProject(project);
		expect(runHook("gate-enforcement.cjs", edit("src/x.ts"), subdir).denied).toBe(false);
	});

	it("still denies a source edit from a subdirectory when the project has no plan", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		expect(runHook("gate-enforcement.cjs", edit("src/x.ts"), subdir).denied).toBe(true);
	});

	it("classifies a target relative to the session cwd, then against the root", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		for (const p of ["src/x.test.ts", "docs/readme.md"]) {
			expect(
				runHook("gate-enforcement.cjs", edit(p), subdir).denied,
				`${p} should be allowed from a subdirectory`,
			).toBe(false);
		}
	});

	it("resolves an absolute target against the root", () => {
		spawnSync("git", ["init", "-q"], { cwd: project });
		expect(runHook("gate-enforcement.cjs", edit(join(project, "docs", "readme.md")), subdir).denied).toBe(false);
	});
});
