import { mkdtempSync, existsSync, writeFileSync, rmSync } from "node:fs";
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

	it("refuses to overwrite an existing AGENTS.md without --force", async () => {
		writeFileSync(join(dir, "AGENTS.md"), "# existing\n");
		const exit = viMockExit();
		await init({ target: "codex" }).catch(() => undefined);
		expect(exit.code).toBe(1);
		expect(existsSync(join(dir, ".codex"))).toBe(false); // nothing copied
		exit.restore();
	});
});

// Capture process.exit without killing the test runner.
function viMockExit(): { code: number | undefined; restore: () => void } {
	const original = process.exit;
	const state: { code: number | undefined; restore: () => void } = { code: undefined, restore: () => undefined };
	process.exit = ((c?: number) => {
		state.code = c;
		throw new Error(`process.exit(${c})`);
	}) as typeof process.exit;
	state.restore = () => {
		process.exit = original;
	};
	return state;
}
