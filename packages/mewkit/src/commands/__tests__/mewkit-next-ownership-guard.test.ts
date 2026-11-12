import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { init } from "../init.js";
import { uninstall } from "../uninstall.js";
import { refreshInstalledProviders } from "../upgrade.js";
import { MewkitNextOwnedError, mewkitNextIndex } from "../mewkit-next-ownership-guard.js";

// A runtime installed by the Rust `mewkit-next` CLI carries its ownership index;
// this CLI must refuse to write over it, naming mewkit-next.

let dir: string;
let orig: string;
beforeEach(() => {
	orig = process.cwd();
	dir = mkdtempSync(join(tmpdir(), "mewkit-next-guard-"));
	process.chdir(dir);
});
afterEach(() => {
	process.chdir(orig);
	rmSync(dir, { recursive: true, force: true });
	vi.restoreAllMocks();
});

function ownedByMewkitNext(runtime: string): string {
	const file = join(dir, ".meowkit", "state", "ownership", `${runtime}.json`);
	mkdirSync(join(dir, ".meowkit", "state", "ownership"), { recursive: true });
	writeFileSync(file, JSON.stringify({ schema_version: 1, kit_version: "v2.16.0", paths: {} }));
	return file;
}

describe("mewkit-next ownership guard", () => {
	it("finds the index only for the runtime it names", () => {
		ownedByMewkitNext("codex");
		expect(mewkitNextIndex(dir, "codex")).toBeDefined();
		expect(mewkitNextIndex(dir, "cursor")).toBeUndefined();
	});

	it("init --target codex refuses a mewkit-next codex and writes nothing", async () => {
		ownedByMewkitNext("codex");
		await expect(init({ target: "codex" })).rejects.toThrow(MewkitNextOwnedError);
		await expect(init({ target: "codex" })).rejects.toThrow(/mewkit-next/);
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
		expect(existsSync(join(dir, ".codex"))).toBe(false);
		expect(readdirSync(join(dir, ".meowkit", "state")).sort()).toEqual(["ownership"]);
	});

	it("init --target cursor still works when only codex belongs to mewkit-next", async () => {
		ownedByMewkitNext("codex");
		await init({ target: "cursor" });
		expect(existsSync(join(dir, ".cursor"))).toBe(true);
	});

	it("uninstall refuses a mewkit-next claude-code install and exits 1", () => {
		ownedByMewkitNext("claude-code");
		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(uninstall(dir, {})).toBe(1);
		expect(err.mock.calls.flat().join("\n")).toMatch(/mewkit-next/);
	});

	it("a stray or corrupt index file does not lock the runtime out", () => {
		mkdirSync(join(dir, ".meowkit", "state", "ownership"), { recursive: true });
		writeFileSync(join(dir, ".meowkit", "state", "ownership", "codex.json"), "");
		writeFileSync(join(dir, ".meowkit", "state", "ownership", "cursor.json"), "{}");
		expect(mewkitNextIndex(dir, "codex")).toBeUndefined();
		expect(mewkitNextIndex(dir, "cursor")).toBeUndefined();
	});

	it("an npm upgrade skips a mewkit-next runtime instead of failing after .claude is written", async () => {
		// Mixed project: the npm cursor ledger is still on disk, but cursor belongs to mewkit-next.
		mkdirSync(join(dir, ".meowkit", "state"), { recursive: true });
		writeFileSync(join(dir, ".meowkit", "state", "cursor-ledger.json"), '{"version":"3.0","installations":[]}\n');
		mkdirSync(join(dir, ".cursor"), { recursive: true });
		writeFileSync(join(dir, ".cursor", "mine.md"), "mine\n");
		ownedByMewkitNext("cursor");
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		await expect(refreshInstalledProviders(dir)).resolves.toBeUndefined();
		expect(log.mock.calls.flat().join("\n")).toMatch(/managed by mewkit-next/);
		expect(readdirSync(join(dir, ".cursor"))).toEqual(["mine.md"]);
	});
});
