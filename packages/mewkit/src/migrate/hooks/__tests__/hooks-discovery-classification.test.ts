// Discovery no longer skips .sh hooks wholesale — it classifies each handler by
// runtime type so .sh handlers migrate via a copied script + generated wrapper.
// Only truly-unrunnable handler types (.ps1/.bat/.cmd/.py) are reported as skipped.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classifyHookHandler, discoverHooks } from "../../discovery/hooks-discovery.js";

let hooksDir: string;

beforeEach(() => {
	hooksDir = mkdtempSync(join(tmpdir(), "hook-discovery-"));
});

afterEach(() => {
	rmSync(hooksDir, { recursive: true, force: true });
});

function write(name: string, body = "noop"): void {
	writeFileSync(join(hooksDir, name), body);
}

describe("classifyHookHandler", () => {
	it("classifies node-runnable extensions as js", () => {
		for (const ext of [".cjs", ".mjs", ".js", ".ts"]) {
			expect(classifyHookHandler(`hook${ext}`)).toBe("js");
		}
	});

	it("classifies .sh as sh (no longer unsupported)", () => {
		expect(classifyHookHandler("gate-enforcement.sh")).toBe("sh");
	});

	it("returns null for handler types with no portable execution path", () => {
		for (const ext of [".ps1", ".bat", ".cmd", ".py"]) {
			expect(classifyHookHandler(`hook${ext}`)).toBeNull();
		}
	});
});

describe("discoverHooks", () => {
	it("migrates .sh handlers instead of skipping them (the fixed bug)", async () => {
		// This test previously would have asserted .sh hooks are skipped; that
		// expectation encoded the bug this phase fixes.
		write("gate-enforcement.sh", "#!/bin/sh\nexit 2");
		write("privacy-block.sh", "#!/bin/sh\nexit 0");
		write("dispatch.cjs", "process.exit(0)");

		const result = await discoverHooks(hooksDir);
		const names = result.items.map((i) => i.name).sort();
		expect(names).toEqual(["dispatch.cjs", "gate-enforcement.sh", "privacy-block.sh"]);
		expect(result.skippedShellHooks).toEqual([]);
	});

	it("tags each discovered hook with its handlerType on frontmatter", async () => {
		write("post-write.sh", "#!/bin/sh\nexit 0");
		write("dispatch.cjs", "process.exit(0)");
		const result = await discoverHooks(hooksDir);
		const sh = result.items.find((i) => i.name === "post-write.sh");
		const js = result.items.find((i) => i.name === "dispatch.cjs");
		expect(sh?.frontmatter.handlerType).toBe("sh");
		expect(js?.frontmatter.handlerType).toBe("js");
	});

	it("still reports .py/.ps1/.bat/.cmd as skipped (no portable execution path)", async () => {
		write("probe.py", "print('x')");
		write("legacy.ps1", "Write-Host x");
		write("dispatch.cjs", "process.exit(0)");
		const result = await discoverHooks(hooksDir);
		expect(result.skippedShellHooks.sort()).toEqual(["legacy.ps1", "probe.py"]);
		expect(result.items.map((i) => i.name)).toEqual(["dispatch.cjs"]);
	});
});
