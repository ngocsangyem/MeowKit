import { mkdtempSync, mkdirSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upgrade } from "../upgrade.js";

// A codex-only project (from `init --target codex`) has no `.claude/`. `mewkit
// upgrade` there refreshes the authored Codex bundle from the installed package
// instead of running the `.claude/` release flow.

let dir: string;
let orig: string;
beforeEach(() => {
	orig = process.cwd();
	dir = mkdtempSync(join(tmpdir(), "upgrade-codex-"));
	process.chdir(dir);
});
afterEach(() => {
	process.chdir(orig);
	rmSync(dir, { recursive: true, force: true });
});

describe("upgrade — codex-only project", () => {
	it("refreshes the authored Codex bundle (no .claude/ release flow)", async () => {
		// Simulate an existing codex-only toolkit with a stale, hand-modified AGENTS.md.
		mkdirSync(join(dir, ".codex"), { recursive: true });
		writeFileSync(join(dir, "AGENTS.md"), "# stale\n");
		await upgrade({});
		// Bundle re-copied: AGENTS.md restored to the authored content, skills present.
		expect(readFileSync(join(dir, "AGENTS.md"), "utf-8")).toContain("Authored Codex instruction surface");
		expect(existsSync(join(dir, ".codex", "config.toml"))).toBe(true);
		expect(existsSync(join(dir, ".agents", "skills"))).toBe(true);
		// It did NOT create a Claude Code kit.
		expect(existsSync(join(dir, ".claude"))).toBe(false);
	});
});
