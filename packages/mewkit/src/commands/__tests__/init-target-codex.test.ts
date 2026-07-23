import { mkdtempSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { init } from "../init.js";

// `mewkit init --target codex` is an offline path: it copies the authored Codex
// bundle shipped with the package into a codex-only project — no release download,
// no `.claude/`, no conversion.

let dir: string;
let orig: string;
beforeEach(() => {
	orig = process.cwd();
	dir = mkdtempSync(join(tmpdir(), "init-codex-"));
	process.chdir(dir);
});
afterEach(() => {
	process.chdir(orig);
	rmSync(dir, { recursive: true, force: true });
});

describe("init --target codex", () => {
	it("copies the authored Codex bundle into a codex-only project", async () => {
		await init({ target: "codex" });
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
		expect(existsSync(join(dir, ".codex", "config.toml"))).toBe(true);
		expect(existsSync(join(dir, ".codex", "agents"))).toBe(true);
		expect(existsSync(join(dir, ".codex", "hooks.json"))).toBe(true);
		expect(existsSync(join(dir, ".agents", "skills"))).toBe(true);
		// Codex-only: no Claude Code kit is created.
		expect(existsSync(join(dir, ".claude"))).toBe(false);
	});

	it("--dry-run writes nothing", async () => {
		await init({ target: "codex", dryRun: true });
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
		expect(existsSync(join(dir, ".codex"))).toBe(false);
	});

	it("preserves an existing user AGENTS.md (adoption-as-conflict), never clobbering it", async () => {
		writeFileSync(join(dir, "AGENTS.md"), "# existing user content\n");
		await init({ target: "codex" });
		// The pre-existing AGENTS.md differs from the bundle and has no ledger baseline,
		// so it is preserved as a conflict — not overwritten. Other surfaces still install.
		expect(readFileSync(join(dir, "AGENTS.md"), "utf-8")).toBe("# existing user content\n");
		expect(existsSync(join(dir, ".codex", "config.toml"))).toBe(true);
	});
});
