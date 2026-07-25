import { mkdtempSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { init } from "../init.js";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";

// `mewkit init --target cursor` is an offline path: it copies the authored Cursor bundle
// shipped with the package into a cursor-only project — no release download, no
// `.claude/`, no legacy converter.

let dir: string;
let orig: string;
beforeEach(() => {
	orig = process.cwd();
	dir = mkdtempSync(join(tmpdir(), "init-cursor-"));
	process.chdir(dir);
});
afterEach(() => {
	process.chdir(orig);
	rmSync(dir, { recursive: true, force: true });
});

describe("init --target cursor", () => {
	it("copies the authored Cursor bundle into a cursor-only project", async () => {
		await init({ target: "cursor" });
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
		expect(existsSync(join(dir, ".meowkit", "README.md"))).toBe(true);
		expect(existsSync(meowkitStatePaths(join(dir, ".meowkit")).cursorLedger)).toBe(true);
		// Cursor-only: no Claude Code kit is created.
		expect(existsSync(join(dir, ".claude"))).toBe(false);
	});

	it("--dry-run writes nothing", async () => {
		await init({ target: "cursor", dryRun: true });
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
		expect(existsSync(join(dir, ".meowkit"))).toBe(false);
	});

	it("re-run is a no-op (idempotent)", async () => {
		await init({ target: "cursor" });
		const before = readFileSync(join(dir, "AGENTS.md"), "utf-8");
		await init({ target: "cursor" });
		expect(readFileSync(join(dir, "AGENTS.md"), "utf-8")).toBe(before);
	});

	it("preserves an existing user AGENTS.md (adoption-as-conflict), never clobbering it", async () => {
		writeFileSync(join(dir, "AGENTS.md"), "# existing user content\n");
		await init({ target: "cursor" });
		// The pre-existing AGENTS.md differs from the bundle and has no ledger baseline,
		// so it is preserved as a conflict — not overwritten. Other surfaces still install.
		expect(readFileSync(join(dir, "AGENTS.md"), "utf-8")).toBe("# existing user content\n");
		expect(existsSync(join(dir, ".meowkit", "README.md"))).toBe(true);
	});
});

// Picker-vs-flag parity (mocked-picker driven) lives in init-provider-multiselect.test.ts,
// alongside the equivalent codex-only picker coverage.
