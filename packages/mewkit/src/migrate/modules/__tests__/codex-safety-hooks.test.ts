import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCodexModuleDir } from "../codex-authored-bundle.js";

// Exercises the authored Codex safety hooks against the real Codex hook contract:
// JSON on stdin, deny = stdout `{hookSpecificOutput:{permissionDecision:"deny"}}` at exit 0,
// allow = exit 0 with no deny. Runs the actual .cjs files as Codex would.
const hooksDir = join(resolveCodexModuleDir(), "root", ".codex", "hooks");

function runHook(name: string, payload: unknown, cwdPayload?: string) {
	const body = cwdPayload ? { cwd: cwdPayload, ...(payload as object) } : payload;
	const res = spawnSync(process.execPath, [join(hooksDir, name)], {
		input: JSON.stringify(body),
		encoding: "utf-8",
	});
	return { status: res.status, denied: (res.stdout ?? "").includes('"permissionDecision":"deny"') };
}

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
	it("allows an ordinary build command (no false positive)", () => {
		const r = runHook("privacy-block.cjs", { tool_name: "Bash", tool_input: { command: "npm run build" } });
		expect(r.denied).toBe(false);
	});
	it("allows prose that merely mentions the word secret", () => {
		const r = runHook("privacy-block.cjs", { tool_name: "Bash", tool_input: { command: "echo my secret plan" } });
		expect(r.denied).toBe(false);
	});
	it("allows on invalid stdin (fail-open — CLI gate is authoritative)", () => {
		const res = spawnSync(process.execPath, [join(hooksDir, "privacy-block.cjs")], { input: "not json", encoding: "utf-8" });
		expect(res.status).toBe(0);
	});
});

describe("codex gate-enforcement hook (PreToolUse/apply_patch)", () => {
	let project: string;
	const patch = (path: string) => `*** Begin Patch\n*** Update File: ${path}\n+x\n*** End Patch`;
	beforeEach(() => {
		project = mkdtempSync(join(tmpdir(), "codex-gate-"));
	});
	afterEach(() => rmSync(project, { recursive: true, force: true }));

	it("denies a source edit when no approved plan exists", () => {
		const r = runHook("gate-enforcement.cjs", { tool_name: "apply_patch", tool_input: { command: patch("src/x.ts") } }, project);
		expect(r.status).toBe(0);
		expect(r.denied).toBe(true);
	});
	it("allows a source edit once a plan exists under tasks/plans/", () => {
		mkdirSync(join(project, "tasks", "plans", "260101-x"), { recursive: true });
		writeFileSync(join(project, "tasks", "plans", "260101-x", "plan.md"), "# plan\n");
		const r = runHook("gate-enforcement.cjs", { tool_name: "apply_patch", tool_input: { command: patch("src/x.ts") } }, project);
		expect(r.denied).toBe(false);
	});
	it("always allows test files, docs, and plan files (no plan needed)", () => {
		for (const p of ["src/x.test.ts", "docs/readme.md", "tasks/plans/p/plan.md"]) {
			const r = runHook("gate-enforcement.cjs", { tool_name: "apply_patch", tool_input: { command: patch(p) } }, project);
			expect(r.denied, `${p} should be allowed`).toBe(false);
		}
	});
	it("rejects a backup/legacy path", () => {
		const r = runHook("gate-enforcement.cjs", { tool_name: "apply_patch", tool_input: { command: patch("src/x.bak/y.ts") } }, project);
		expect(r.denied).toBe(true);
	});
	it("allows when no target path is determinable (fail-open)", () => {
		const r = runHook("gate-enforcement.cjs", { tool_name: "apply_patch", tool_input: { command: "no file markers here" } }, project);
		expect(r.denied).toBe(false);
	});
});
