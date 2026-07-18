// Unit + smoke tests for per-handler Codex hook wrapper generation.
// Covers: .sh handler → copied script + .cjs wrapper, self-containment (works
// after the source is deleted), space-safe argv execution, $CLAUDE_PROJECT_DIR
// env rewrite, and exit-2 deny semantics for safety hooks
// (protocol: https://developers.openai.com/codex/hooks).

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CODEX_CAPABILITY_TABLE } from "../../providers/codex/capabilities.js";
import { generateCodexHookWrappers } from "../codex-hook-wrapper.js";

const CAPS = CODEX_CAPABILITY_TABLE[0]; // 0.142 tier: deny on PreToolUse

let workDir: string;
let srcDir: string;
let wrapperDir: string;

beforeEach(() => {
	workDir = mkdtempSync(join(tmpdir(), "codex-wrapper-"));
	srcDir = join(workDir, ".claude", "hooks");
	wrapperDir = join(workDir, ".codex", "hooks");
	spawnSync("mkdir", ["-p", srcDir, wrapperDir]);
});

afterEach(() => {
	rmSync(workDir, { recursive: true, force: true });
});

function writeShHook(name: string, body: string): string {
	const p = join(srcDir, name);
	writeFileSync(p, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
	return p;
}

describe("generateCodexHookWrappers — sh handler", () => {
	it("copies the .sh script under the wrapper tree and generates a .cjs wrapper", () => {
		const original = writeShHook("post-write.sh", 'echo "ran"');
		const [result] = generateCodexHookWrappers([{ originalPath: original, handlerType: "sh" }], wrapperDir, CAPS);

		expect(result.success).toBe(true);
		expect(result.handlerType).toBe("sh");
		expect(result.wrapperPath.endsWith(".cjs")).toBe(true);
		expect(result.copiedScriptPath).toBeDefined();
		expect(existsSync(result.copiedScriptPath as string)).toBe(true);
		// The copied script lives under the wrapper tree's scripts/ dir.
		expect(result.copiedScriptPath as string).toContain(join(".codex", "hooks", "scripts"));
	});

	it("is self-contained — wrapper runs after the source .claude tree is deleted", () => {
		const original = writeShHook("session-init.sh", 'echo "hello from sh"');
		const [result] = generateCodexHookWrappers([{ originalPath: original, handlerType: "sh" }], wrapperDir, CAPS);
		expect(result.success).toBe(true);

		// Simulate deleting .claude/ after migration (self-contained requirement).
		rmSync(join(workDir, ".claude"), { recursive: true, force: true });

		const run = spawnSync(process.execPath, [result.wrapperPath], {
			input: JSON.stringify({ hook_event_name: "SessionStart" }),
			encoding: "utf8",
		});
		expect(run.status).toBe(0);
		expect(run.stdout).toContain("hello from sh");
	});

	it("passes a space-containing project root as one literal argument (argv-safe)", () => {
		const parent = mkdtempSync(join(tmpdir(), "codex-wrap-space-"));
		const spaceProject = join(parent, "untitled folder");
		const spaceSrc = join(spaceProject, ".claude", "hooks");
		const spaceWrap = join(spaceProject, ".codex", "hooks");
		spawnSync("mkdir", ["-p", spaceSrc, spaceWrap]);
		// Script echoes the bridged CLAUDE_PROJECT_DIR so we can assert on it.
		const original = join(spaceSrc, "probe.sh");
		writeFileSync(original, '#!/bin/sh\nprintf "%s" "$CLAUDE_PROJECT_DIR"\n', { mode: 0o755 });

		try {
			const [result] = generateCodexHookWrappers([{ originalPath: original, handlerType: "sh" }], spaceWrap, CAPS);
			expect(result.success).toBe(true);
			const run = spawnSync(process.execPath, [result.wrapperPath], {
				input: JSON.stringify({ hook_event_name: "PostToolUse" }),
				encoding: "utf8",
			});
			expect(run.status).toBe(0);
			// Computed root is the project dir (4 levels up from copied script),
			// which contains the space — proving it was passed literally.
			expect(run.stdout).toContain("untitled folder");
		} finally {
			rmSync(parent, { recursive: true, force: true });
		}
	});

	it("converts a safety-hook exit code 2 into a Codex deny decision on PreToolUse", () => {
		// gate-enforcement.sh style: exit 2 + reason on stderr = deny.
		const original = writeShHook("gate-enforcement.sh", 'echo "blocked: no contract" 1>&2\nexit 2');
		chmodSync(original, 0o755);
		const [result] = generateCodexHookWrappers([{ originalPath: original, handlerType: "sh" }], wrapperDir, CAPS);
		expect(result.success).toBe(true);

		const run = spawnSync(process.execPath, [result.wrapperPath], {
			input: JSON.stringify({ hook_event_name: "PreToolUse" }),
			encoding: "utf8",
		});
		// Wrapper emits the structured deny payload and exits 0 (Codex reads stdout).
		expect(run.status).toBe(0);
		const payload = JSON.parse(run.stdout);
		expect(payload.permissionDecision).toBe("deny");
		expect(payload.reason).toContain("blocked");
	});

	it("preserves a normal exit code for non-deny events", () => {
		const original = writeShHook("pre-ship.sh", "exit 0");
		const [result] = generateCodexHookWrappers([{ originalPath: original, handlerType: "sh" }], wrapperDir, CAPS);
		const run = spawnSync(process.execPath, [result.wrapperPath], {
			input: JSON.stringify({ hook_event_name: "Stop" }),
			encoding: "utf8",
		});
		expect(run.status).toBe(0);
	});
});

describe("generateCodexHookWrappers — js handler (unchanged behavior)", () => {
	it("generates a .cjs wrapper for a node handler without copying a script", () => {
		const original = join(srcDir, "dispatch.cjs");
		writeFileSync(original, "process.exit(0)\n", { mode: 0o755 });
		const [result] = generateCodexHookWrappers([{ originalPath: original, handlerType: "js" }], wrapperDir, CAPS);
		expect(result.success).toBe(true);
		expect(result.handlerType).toBe("js");
		expect(result.copiedScriptPath).toBeUndefined();
	});

	it("accepts the legacy string[] form and defaults to js", () => {
		const original = join(srcDir, "legacy.cjs");
		writeFileSync(original, "process.exit(0)\n", { mode: 0o755 });
		const [result] = generateCodexHookWrappers([original], wrapperDir, CAPS);
		expect(result.success).toBe(true);
		expect(result.handlerType).toBe("js");
	});
});
