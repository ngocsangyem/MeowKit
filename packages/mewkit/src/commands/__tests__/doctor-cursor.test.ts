import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkCursor } from "../doctor-cursor.js";
import type { PortableInstallationV3, PortableRegistryV3 } from "../../migrate/reconcile/portable-registry.js";

let dir: string | null = null;
let moduleDir: string | null = null;
afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
	if (moduleDir) rmSync(moduleDir, { recursive: true, force: true });
	dir = null;
	moduleDir = null;
});

const VALID_HOOKS_JSON = {
	version: 1,
	hooks: {
		beforeReadFile: [{ command: "node .cursor/hooks/privacy-read-gate.cjs", failClosed: true }],
		beforeShellExecution: [{ command: "node .cursor/hooks/shell-gate.cjs", failClosed: true }],
		beforeMCPExecution: [{ command: "node .cursor/hooks/mcp-gate.cjs", failClosed: true }],
		preToolUse: [
			{ matcher: "^(?:write|edit|create|delete|remove|apply_patch|str_replace|update)", command: "node .cursor/hooks/tool-gate.cjs", failClosed: true },
			{ matcher: "^(?:read|search|grep|glob|list|find|view)", command: "node .cursor/hooks/tool-gate.cjs", failClosed: false },
			{ matcher: ".*", command: "node .cursor/hooks/tool-gate.cjs", failClosed: true },
		],
	},
};

function makeTarget(hooksJson: unknown = VALID_HOOKS_JSON): string {
	dir = mkdtempSync(join(tmpdir(), "cursor-doctor-"));
	mkdirSync(join(dir, ".cursor"), { recursive: true });
	writeFileSync(join(dir, ".cursor", "hooks.json"), JSON.stringify(hooksJson));
	return dir;
}

function writeLedger(targetDir: string, installations: PortableInstallationV3[]): void {
	mkdirSync(join(targetDir, ".meowkit", "state"), { recursive: true });
	const registry: PortableRegistryV3 = { version: "3.0", installations };
	writeFileSync(join(targetDir, ".meowkit", "state", "cursor-ledger.json"), JSON.stringify(registry));
}

function makeModuleDir(): string {
	moduleDir = mkdtempSync(join(tmpdir(), "cursor-module-"));
	return moduleDir;
}

describe("checkCursor: hooks.json shape", () => {
	it("returns [] when there is no .cursor/hooks.json (nothing to check)", async () => {
		dir = mkdtempSync(join(tmpdir(), "cursor-doctor-"));
		expect(await checkCursor(dir, makeModuleDir())).toEqual([]);
	});

	it("reports schema version 1 as pass", async () => {
		const d = makeTarget();
		const results = await checkCursor(d, makeModuleDir());
		const versionCheck = results.find((r) => r.name === "Cursor hooks.json schema version");
		expect(versionCheck?.status).toBe("pass");
	});

	it("fails a wrong schema version", async () => {
		const d = makeTarget({ ...VALID_HOOKS_JSON, version: 2 });
		const results = await checkCursor(d, makeModuleDir());
		const versionCheck = results.find((r) => r.name === "Cursor hooks.json schema version");
		expect(versionCheck?.status).toBe("fail");
	});

	it("reports a parse error as FAIL, never a silent pass", async () => {
		dir = mkdtempSync(join(tmpdir(), "cursor-doctor-"));
		mkdirSync(join(dir, ".cursor"), { recursive: true });
		writeFileSync(join(dir, ".cursor", "hooks.json"), "{ not valid json");
		const results = await checkCursor(dir, makeModuleDir());
		expect(results).toHaveLength(1);
		expect(results[0].status).toBe("fail");
	});

	it("fails a security-critical event missing failClosed:true", async () => {
		const d = makeTarget({
			version: 1,
			hooks: { beforeReadFile: [{ command: "node .cursor/hooks/privacy-read-gate.cjs" }] },
		});
		const results = await checkCursor(d, makeModuleDir());
		const failClosedCheck = results.find((r) => r.name.startsWith("Cursor hook failClosed: beforeReadFile"));
		expect(failClosedCheck?.status).toBe("fail");
	});

	it("passes the deliberately fail-open preToolUse read-only matcher", async () => {
		const d = makeTarget();
		const results = await checkCursor(d, makeModuleDir());
		const readOnlyCheck = results.find((r) => r.name.includes("read|search|grep"));
		expect(readOnlyCheck?.status).toBe("pass");
	});

	it("flags a duplicate (event, matcher) entry (AgentKit anti-pattern)", async () => {
		const d = makeTarget({
			version: 1,
			hooks: {
				beforeReadFile: [
					{ command: "node .cursor/hooks/privacy-read-gate.cjs", failClosed: true },
					{ command: "node .cursor/hooks/privacy-read-gate.cjs", failClosed: true },
				],
			},
		});
		const results = await checkCursor(d, makeModuleDir());
		expect(results.some((r) => r.name.startsWith("Cursor hook dedupe") && r.status === "fail")).toBe(true);
	});
});

describe("checkCursor: bundle checksum re-verification", () => {
	it("passes when there are no hooks/agent ledger rows yet (not manifest-wired)", async () => {
		const d = makeTarget();
		const results = await checkCursor(d, makeModuleDir());
		const check = results.find((r) => r.name === "Cursor bundle checksum re-verification");
		expect(check?.status).toBe("pass");
	});

	it("passes when the live file matches the currently shipped bundle", async () => {
		const d = makeTarget();
		const m = makeModuleDir();
		mkdirSync(join(m, "root", ".cursor", "hooks"), { recursive: true });
		writeFileSync(join(m, "root", ".cursor", "hooks", "privacy-read-gate.cjs"), "console.log('shipped');\n");
		mkdirSync(join(d, ".cursor", "hooks"), { recursive: true });
		writeFileSync(join(d, ".cursor", "hooks", "privacy-read-gate.cjs"), "console.log('shipped');\n");
		writeLedger(d, [
			{
				item: "privacy-read-gate.cjs",
				type: "hooks",
				provider: "cursor",
				global: false,
				path: join(d, ".cursor", "hooks", "privacy-read-gate.cjs"),
				installedAt: new Date().toISOString(),
				sourcePath: "root/.cursor/hooks/privacy-read-gate.cjs",
				sourceChecksum: "abc",
				targetChecksum: "abc",
				installSource: "kit",
			},
		]);
		const results = await checkCursor(d, m);
		const check = results.find((r) => r.name.includes("privacy-read-gate.cjs"));
		expect(check?.status).toBe("pass");
	});

	it("FAILS a live file that diverged from the shipped bundle even when the ledger claims no drift", async () => {
		const d = makeTarget();
		const m = makeModuleDir();
		mkdirSync(join(m, "root", ".cursor", "hooks"), { recursive: true });
		writeFileSync(join(m, "root", ".cursor", "hooks", "shell-gate.cjs"), "console.log('NEW shipped content');\n");
		mkdirSync(join(d, ".cursor", "hooks"), { recursive: true });
		writeFileSync(join(d, ".cursor", "hooks", "shell-gate.cjs"), "console.log('OLD installed content — tampered or stale');\n");
		writeLedger(d, [
			{
				item: "shell-gate.cjs",
				type: "hooks",
				provider: "cursor",
				global: false,
				path: join(d, ".cursor", "hooks", "shell-gate.cjs"),
				installedAt: new Date().toISOString(),
				sourcePath: "root/.cursor/hooks/shell-gate.cjs",
				// Ledger self-reports "no drift" (source === target) — the check must not trust this.
				sourceChecksum: "same-forged-value",
				targetChecksum: "same-forged-value",
				installSource: "kit",
			},
		]);
		const results = await checkCursor(d, m);
		const check = results.find((r) => r.name.includes("shell-gate.cjs"));
		expect(check?.status).toBe("fail");
		expect(check?.detail).toMatch(/ledger claims no drift/);
	});

	it("reports a corrupt ledger as FAIL, never a silent pass", async () => {
		const d = makeTarget();
		mkdirSync(join(d, ".meowkit", "state"), { recursive: true });
		writeFileSync(join(d, ".meowkit", "state", "cursor-ledger.json"), "{ not valid json");
		const results = await checkCursor(d, makeModuleDir());
		const check = results.find((r) => r.name === "Cursor reconciliation ledger");
		expect(check?.status).toBe("fail");
	});
});

describe("checkCursor: kill-switch hint", () => {
	it("always names the env var and flag path", async () => {
		const d = makeTarget();
		const results = await checkCursor(d, makeModuleDir());
		const hint = results.find((r) => r.name === "Cursor hooks kill switch");
		expect(hint?.detail).toContain("MEWKIT_CURSOR_HOOKS_KILL_SWITCH");
		expect(hint?.detail).toContain(".meowkit/state/cursor-hooks-kill-switch");
	});

	// Regression (security-review finding #5): an ACTIVE kill switch means every
	// security-critical gate is downgraded to warn-and-allow — that must never
	// read as a clean "pass".
	it("reports status:pass when the kill switch is inactive", async () => {
		const d = makeTarget();
		const results = await checkCursor(d, makeModuleDir());
		const hint = results.find((r) => r.name === "Cursor hooks kill switch");
		expect(hint?.status).toBe("pass");
	});

	it("reports status:warn (never pass) when the kill switch is ACTIVE via flag file", async () => {
		const d = makeTarget();
		mkdirSync(join(d, ".meowkit", "state"), { recursive: true });
		writeFileSync(join(d, ".meowkit", "state", "cursor-hooks-kill-switch"), "");
		const results = await checkCursor(d, makeModuleDir());
		const hint = results.find((r) => r.name === "Cursor hooks kill switch");
		expect(hint?.status).toBe("warn");
		expect(hint?.detail).toMatch(/^ACTIVE/);
	});

	it("reports status:warn (never pass) when the kill switch is ACTIVE via env var", async () => {
		const d = makeTarget();
		const prev = process.env.MEWKIT_CURSOR_HOOKS_KILL_SWITCH;
		process.env.MEWKIT_CURSOR_HOOKS_KILL_SWITCH = "1";
		try {
			const results = await checkCursor(d, makeModuleDir());
			const hint = results.find((r) => r.name === "Cursor hooks kill switch");
			expect(hint?.status).toBe("warn");
		} finally {
			if (prev === undefined) delete process.env.MEWKIT_CURSOR_HOOKS_KILL_SWITCH;
			else process.env.MEWKIT_CURSOR_HOOKS_KILL_SWITCH = prev;
		}
	});
});
