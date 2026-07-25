// Fixture-driven proof for every native Cursor hook adapter: each event proves
// allow / deny / malformed-JSON / fail-open-noncritical / fail-closed-critical,
// per the phase's success criteria. Hooks are spawned as real child processes
// (matching how Cursor itself invokes a `type:"command"` hook: JSON on stdin,
// JSON on stdout, exit 0) so this test exercises the actual shipped `.cjs`
// files, not a re-implementation of their logic.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = join(HERE, "..", "..", "modules", "cursor", "root", ".cursor", "hooks");
const FIXTURES_DIR = join(HERE, "cursor-hook-fixtures");

function fixture(name: string): string {
	return readFileSync(join(FIXTURES_DIR, `${name}.json`), "utf-8");
}

interface HookResult {
	status: number | null;
	json: Record<string, unknown> | null;
	stderr: string;
}

function runHook(script: string, stdin: string, projectDir: string, extraEnv: Record<string, string> = {}): HookResult {
	const res = spawnSync(process.execPath, [join(HOOKS_DIR, script)], {
		input: stdin,
		cwd: projectDir,
		encoding: "utf-8",
		env: { ...process.env, CURSOR_PROJECT_DIR: projectDir, ...extraEnv },
	});
	let json: Record<string, unknown> | null = null;
	try {
		json = res.stdout ? JSON.parse(res.stdout) : null;
	} catch {
		json = null;
	}
	return { status: res.status, json, stderr: res.stderr ?? "" };
}

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "cursor-hooks-"));
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("privacy-read-gate.cjs (beforeReadFile, security-critical)", () => {
	it("allows a non-sensitive path", () => {
		const r = runHook("privacy-read-gate.cjs", fixture("before-read-file-allow"), dir);
		expect(r.status).toBe(0);
		expect(r.json).toEqual({ permission: "allow" });
	});

	it("denies a sensitive path (.env.production)", () => {
		const r = runHook("privacy-read-gate.cjs", fixture("before-read-file-deny"), dir);
		expect(r.status).toBe(0);
		expect(r.json?.permission).toBe("deny");
	});

	it("fails closed (deny) on malformed JSON", () => {
		const r = runHook("privacy-read-gate.cjs", fixture("malformed"), dir);
		expect(r.status).toBe(0);
		expect(r.json?.permission).toBe("deny");
	});

	it("kill switch (env var) downgrades a deny to allow with a loud warning", () => {
		const r = runHook("privacy-read-gate.cjs", fixture("before-read-file-deny"), dir, {
			MEWKIT_CURSOR_HOOKS_KILL_SWITCH: "1",
		});
		expect(r.json?.permission).toBe("allow");
		expect(String(r.json?.user_message)).toMatch(/kill switch/i);
		expect(r.stderr).toMatch(/KILL SWITCH ACTIVE/);
	});

	it("kill switch (flag file) downgrades a deny to allow", () => {
		mkdirSync(join(dir, ".meowkit", "state"), { recursive: true });
		writeFileSync(join(dir, ".meowkit", "state", "cursor-hooks-kill-switch"), "");
		const r = runHook("privacy-read-gate.cjs", fixture("before-read-file-deny"), dir);
		expect(r.json?.permission).toBe("allow");
	});
});

describe("shell-gate.cjs (beforeShellExecution, security-critical)", () => {
	it("allows a benign command", () => {
		const r = runHook("shell-gate.cjs", fixture("before-shell-execution-allow"), dir);
		expect(r.json).toEqual({ permission: "allow" });
	});

	it("denies a destructive command", () => {
		const r = runHook("shell-gate.cjs", fixture("before-shell-execution-deny"), dir);
		expect(r.json?.permission).toBe("deny");
	});

	it("asks (not deny) on a privilege-escalation pattern", () => {
		const r = runHook("shell-gate.cjs", fixture("before-shell-execution-ask"), dir);
		expect(r.json?.permission).toBe("ask");
	});

	it("fails closed on malformed JSON", () => {
		const r = runHook("shell-gate.cjs", fixture("malformed"), dir);
		expect(r.json?.permission).toBe("deny");
	});
});

describe("mcp-gate.cjs (beforeMCPExecution, security-critical, cloud-unsupported)", () => {
	it("allows a server present in .cursor/mcp.json", () => {
		mkdirSync(join(dir, ".cursor"), { recursive: true });
		writeFileSync(
			join(dir, ".cursor", "mcp.json"),
			JSON.stringify({ mcpServers: { context7: { url: "https://example.com" } } }),
		);
		const r = runHook("mcp-gate.cjs", fixture("before-mcp-execution-allow"), dir);
		expect(r.json).toEqual({ permission: "allow" });
	});

	it("denies a server not in the allowlist", () => {
		mkdirSync(join(dir, ".cursor"), { recursive: true });
		writeFileSync(
			join(dir, ".cursor", "mcp.json"),
			JSON.stringify({ mcpServers: { context7: { url: "https://example.com" } } }),
		);
		const r = runHook("mcp-gate.cjs", fixture("before-mcp-execution-deny"), dir);
		expect(r.json?.permission).toBe("deny");
	});

	it("denies everything when no .cursor/mcp.json exists (no allowlist configured)", () => {
		const r = runHook("mcp-gate.cjs", fixture("before-mcp-execution-allow"), dir);
		expect(r.json?.permission).toBe("deny");
	});

	it("fails closed on malformed JSON", () => {
		const r = runHook("mcp-gate.cjs", fixture("malformed"), dir);
		expect(r.json?.permission).toBe("deny");
	});
});

describe("tool-gate.cjs (preToolUse, matcher-enumerated)", () => {
	it("allows a file-mutation tool targeting a non-protected path", () => {
		const r = runHook("tool-gate.cjs", fixture("pre-tool-use-file-mutation-allow"), dir);
		expect(r.json?.permission).toBe("allow");
	});

	it("denies a file-mutation tool targeting a protected path (.ssh)", () => {
		const r = runHook("tool-gate.cjs", fixture("pre-tool-use-file-mutation-deny"), dir);
		expect(r.json?.permission).toBe("deny");
	});

	// Regression (security-review finding #2): a file-mutation tool call must
	// not be able to write the kill-switch flag file or the reconciliation
	// ledger under .meowkit/state/ — that would silently disable every
	// security gate or forge ledger trust.
	it("denies a file-mutation tool targeting the .meowkit/state kill-switch flag file", () => {
		const r = runHook("tool-gate.cjs", fixture("pre-tool-use-file-mutation-deny-meowkit-state"), dir);
		expect(r.json?.permission).toBe("deny");
	});

	it("denies a file-mutation tool targeting the .meowkit/state reconciliation ledger", () => {
		const r = runHook("tool-gate.cjs", fixture("pre-tool-use-file-mutation-deny-meowkit-ledger"), dir);
		expect(r.json?.permission).toBe("deny");
	});

	it("allows a read-only-query tool (fail-open bucket)", () => {
		const r = runHook("tool-gate.cjs", fixture("pre-tool-use-read-only"), dir);
		expect(r.json).toEqual({ permission: "allow" });
	});

	// Regression (security-review finding #1): `ask` is not host-enforced for
	// preToolUse (only beforeShellExecution/beforeMCPExecution enforce `ask`),
	// so an unclassified/unknown tool_name must `deny` — the decision that IS
	// enforced — never fall back to `ask`, which would silently no-op at the
	// host. Real shell/MCP enforcement lives in shell-gate.cjs / mcp-gate.cjs.
	it("denies (never asks) an unclassified tool_name — ask is not enforced for preToolUse", () => {
		const r = runHook("tool-gate.cjs", fixture("pre-tool-use-unclassified"), dir);
		expect(r.json?.permission).toBe("deny");
	});

	it("fails closed (deny) on malformed JSON", () => {
		const r = runHook("tool-gate.cjs", fixture("malformed"), dir);
		expect(r.json?.permission).toBe("deny");
	});
});

describe("telemetry-observers.cjs (fail-open, PII-scrubbed)", () => {
	it("persists a scrubbed record and never blocks", () => {
		const r = runHook("telemetry-observers.cjs", fixture("post-tool-use"), dir);
		expect(r.status).toBe(0);
		expect(r.json).toEqual({});
		const logPath = join(dir, ".meowkit", "telemetry", "observe-events.jsonl");
		expect(existsSync(logPath)).toBe(true);
		const record = JSON.parse(readFileSync(logPath, "utf-8").trim());
		expect(record.transcript_path).toBeUndefined();
		expect(record.user_email).toMatch(/^sha256:/);
	});

	it("no-ops silently on malformed JSON (fail open, never blocks)", () => {
		const r = runHook("telemetry-observers.cjs", fixture("malformed"), dir);
		expect(r.status).toBe(0);
		expect(r.json).toEqual({});
		expect(existsSync(join(dir, ".meowkit", "telemetry", "observe-events.jsonl"))).toBe(false);
	});

	it("handles preCompact as best-effort telemetry only (never touches memory)", () => {
		const r = runHook("telemetry-observers.cjs", fixture("pre-compact"), dir);
		expect(r.status).toBe(0);
		expect(r.json).toEqual({});
		expect(existsSync(join(dir, ".meowkit", "telemetry", "observe-events.jsonl"))).toBe(true);
		expect(existsSync(join(dir, ".meowkit", "memory"))).toBe(false);
	});

	// Regression (security-review finding #3): a secret-shaped value embedded in
	// ANY field (command, tool_input, tool_output, prompt, content — not just the
	// 4 named PII fields) must be redacted before persistence to .meowkit/telemetry/.
	it("redacts a secret-shaped value embedded in tool_input.command before persisting", () => {
		const r = runHook("telemetry-observers.cjs", fixture("post-tool-use-with-secret-in-command"), dir);
		expect(r.status).toBe(0);
		const logPath = join(dir, ".meowkit", "telemetry", "observe-events.jsonl");
		const raw = readFileSync(logPath, "utf-8").trim();
		expect(raw).not.toContain("AKIAABCDEFGHIJKLMNOP");
		const record = JSON.parse(raw);
		expect(record.tool_input.command).toContain("[REDACTED-AWS-KEY]");
	});
});

describe("prompt-capture.cjs (beforeSubmitPrompt, noncritical, block-only contract never exercised)", () => {
	it("always continues for a plain prompt (fast no-op)", () => {
		const r = runHook("prompt-capture.cjs", fixture("before-submit-prompt-plain"), dir);
		expect(r.json).toEqual({ continue: true });
	});

	it("always continues even for a capture-prefixed prompt (capture is a side effect, never blocking)", () => {
		const r = runHook("prompt-capture.cjs", fixture("before-submit-prompt-capture"), dir);
		expect(r.json).toEqual({ continue: true });
	});
});

describe("subagent-lifecycle.cjs (subagentStart/subagentStop, noncritical)", () => {
	it("allows subagentStart and logs telemetry", () => {
		const r = runHook("subagent-lifecycle.cjs", fixture("subagent-start"), dir);
		expect(r.json?.permission).toBe("allow");
		expect(existsSync(join(dir, ".meowkit", "telemetry", "subagent-lifecycle.jsonl"))).toBe(true);
	});

	it("emits a bounded followup_message on subagentStop error status", () => {
		const r = runHook("subagent-lifecycle.cjs", fixture("subagent-stop-error"), dir);
		expect(typeof r.json?.followup_message).toBe("string");
		const record = JSON.parse(
			readFileSync(join(dir, ".meowkit", "telemetry", "subagent-lifecycle.jsonl"), "utf-8").trim(),
		);
		expect(record.agent_transcript_path).toBeUndefined();
		expect(record.user_email).toMatch(/^sha256:/);
	});

	it("emits no followup_message on subagentStop completed status", () => {
		const r = runHook("subagent-lifecycle.cjs", fixture("subagent-stop-completed"), dir);
		expect(r.json).toEqual({});
	});
});

describe("stop-followup.cjs (stop, bounded followup)", () => {
	it("emits a bounded followup_message on error status under the loop bound", () => {
		const r = runHook("stop-followup.cjs", fixture("stop-error"), dir);
		expect(typeof r.json?.followup_message).toBe("string");
	});

	it("emits no followup_message on completed status", () => {
		const r = runHook("stop-followup.cjs", fixture("stop-completed"), dir);
		expect(r.json).toEqual({});
	});
});

describe("session-context.cjs (sessionStart, never blocking)", () => {
	it("emits bounded additional_context", () => {
		const r = runHook("session-context.cjs", fixture("session-start"), dir);
		expect(typeof r.json?.additional_context).toBe("string");
	});
});
