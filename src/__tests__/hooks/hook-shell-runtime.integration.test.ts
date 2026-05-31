// Guards: parser-RUNTIME only (the sh-vs-bash here-string regression). Every configured SHELL hook is
// replayed through the interpreter settings.json names, with valid JSON on stdin, and
// must run WITHOUT a shell-interpreter error (no "Syntax error"/"Bad substitution"/etc.)
// and with a defined exit code (never 126/127, never a null spawn). On Ubuntu CI `/bin/sh`
// is dash, so this row is what would catch the original `<<<` here-string mismatch.
//
// NOT a gate-logic check — a hook here may legitimately exit 0/1/2 depending on state.
import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { runConfiguredHook } from "../../../packages/mewkit/src/core/hook-runner.js";
import { scaffold, SETTINGS, type HarnessProject } from "./_scaffold.js";

// ensure-skills-venv.sh builds a Python venv (slow, side-effecty) and does NOT source
// the stdin parser, so it cannot exhibit the runtime-mismatch bug — excluded to keep the
// sweep fast and deterministic. All other shell hooks are exercised.
const SWEEP_EXCLUDE = ["ensure-skills-venv.sh"];

// Dash/bash PARSE-error signatures only. Exec failures (command-not-found=127,
// not-executable=126) are caught separately by the exit-code assertion, so they are
// excluded here to avoid false-matching legitimate hook stderr like "plan not found".
const SHELL_ERROR = /Syntax error|Bad substitution|unexpected/i;

const SWEEP: Array<{ event: string; tool?: string; toolInput?: Record<string, unknown> }> = [
	{ event: "SessionStart" },
	{ event: "PreToolUse", tool: "Write", toolInput: { file_path: "src/app.ts" } },
	{ event: "PreToolUse", tool: "Read", toolInput: { file_path: "README.md" } },
	{ event: "PreToolUse", tool: "Bash", toolInput: { command: "ls -la" } },
	{ event: "PostToolUse", tool: "Write", toolInput: { file_path: "src/app.ts" } },
	{ event: "Stop" },
	{ event: "UserPromptSubmit" },
];

let project: HarnessProject | null = null;
afterEach(() => {
	project?.cleanup();
	project = null;
});

describe("hook shell runtime sweep (every configured shell hook runs clean)", () => {
	for (const probe of SWEEP) {
		const label = `${probe.event}${probe.tool ? `/${probe.tool}` : ""}`;
		it(`${label}: configured shell hooks run without a shell error`, () => {
			project = scaffold();
			const results = runConfiguredHook(SETTINGS, {
				projectDir: project.dir,
				event: probe.event,
				tool: probe.tool,
				toolName: probe.tool,
				toolInput: probe.toolInput,
				exclude: SWEEP_EXCLUDE,
			});
			for (const r of results) {
				expect(r.status, `${label} → ${r.script} did not return an exit code (spawn failed/timeout)`).not.toBeNull();
				expect([126, 127], `${label} → ${r.script} hit exec/not-found exit ${r.status}`).not.toContain(r.status);
				expect(r.stderr, `${label} → ${r.script} emitted a shell-interpreter error:\n${r.stderr}`).not.toMatch(
					SHELL_ERROR,
				);
			}
		});
	}

	// Explicit POSIX-safety pin: production invokes the parser via bash, but it MUST also
	// parse correctly under /bin/sh (dash on CI). This invokes read-hook-input.sh via `sh -c`
	// directly and asserts HOOK_FILE_PATH round-trips a payload with %, backslash, and spaces.
	it("read-hook-input.sh parses stdin JSON correctly under /bin/sh", () => {
		project = scaffold();
		const parser = path.join(project.dir, ".claude/hooks/lib/read-hook-input.sh");
		const payload = JSON.stringify({ tool_name: "Edit", tool_input: { file_path: "a%s\\b c.ts" } });
		// `sh -c <script> <$0> <$1...>` — the trailing arg is $0, kept well-defined across shells.
		const proc = spawnSync("sh", ["-c", `. "${parser}"; printf '%s' "$HOOK_FILE_PATH"`, "read-hook-input-probe"], {
			cwd: project.dir,
			input: payload,
			encoding: "utf8",
			timeout: 15000,
			env: { ...process.env, CLAUDE_PROJECT_DIR: project.dir },
		});
		expect(proc.stderr).not.toMatch(SHELL_ERROR);
		expect(proc.stdout).toBe("a%s\\b c.ts");
	});
});
