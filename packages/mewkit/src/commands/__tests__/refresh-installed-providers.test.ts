// `upgrade` refreshes a Codex or Cursor install only when that install wrote a ledger.
// A provider directory without one is an export made by the retired `migrate` verb; it
// is left byte-for-byte alone and the user is pointed at `init --target`.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitCodexTarget } from "../../emit/emit-bundle-target.js";
import { resolveCodexModuleDir } from "../../migrate/modules/codex-authored-bundle.js";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";
import { refreshInstalledProviders } from "../upgrade.js";

let dir: string;
let logs: string[];

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "refresh-providers-"));
	logs = [];
	vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
		logs.push(args.join(" "));
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	rmSync(dir, { recursive: true, force: true });
});

describe("refreshInstalledProviders", () => {
	for (const [tool, dirName] of [
		["codex", ".codex"],
		["cursor", ".cursor"],
	] as const) {
		it(`leaves a ledger-less ${dirName}/ untouched and names init --target ${tool}`, async () => {
			mkdirSync(join(dir, dirName));
			writeFileSync(join(dir, dirName, "exported.md"), "# old export\n");

			await refreshInstalledProviders(dir);

			expect(readFileSync(join(dir, dirName, "exported.md"), "utf8")).toBe("# old export\n");
			const paths = meowkitStatePaths(join(dir, ".meowkit"));
			expect(existsSync(tool === "codex" ? paths.codexLedger : paths.cursorLedger)).toBe(false);
			expect(logs.join("\n")).toContain(`mewkit init --target ${tool}`);
		});
	}

	it("refreshes an authored Codex install that has a ledger through its reconciler", async () => {
		const moduleDir = resolveCodexModuleDir();
		await emitCodexTarget("init", dir, moduleDir);
		expect(existsSync(meowkitStatePaths(join(dir, ".meowkit")).codexLedger)).toBe(true);
		rmSync(join(dir, "AGENTS.md"));

		await refreshInstalledProviders(dir);

		// Reconciled, not recopied: a managed file the user deleted stays deleted.
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
		expect(logs.join("\n")).toContain("Codex toolkit refreshed");
		expect(logs.join("\n")).not.toContain("retired");
	});

	it("does nothing when no provider is installed", async () => {
		await refreshInstalledProviders(dir);
		expect(logs).toEqual([]);
	});
});
