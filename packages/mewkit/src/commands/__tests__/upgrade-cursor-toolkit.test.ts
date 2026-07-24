import { mkdirSync, mkdtempSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";

// A cursor-only project (from `init --target cursor`) has no `.claude/`. `mewkit upgrade`
// there refreshes the authored Cursor bundle from the installed package instead of running
// the `.claude/` release flow — mirrors upgrade-codex-toolkit.test.ts.
//
// The second describe block covers the red-team-flagged mixed case: a `.claude/` +
// authored-`.cursor/` project must never re-run the LEGACY `.claude/` → `.cursor/` converter
// over the authored bundle. That path runs the full `.claude/` release flow, so network calls
// are mocked out; `runMigrate` is spied on to prove it is never invoked for "cursor".

const runMigrateSpy = vi.fn(async () => 0);
vi.mock("../../migrate/migrate-orchestrator.js", () => ({
	runMigrate: (...args: unknown[]) => runMigrateSpy(...args),
}));

vi.mock("../../core/index.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../core/index.js")>();
	return {
		...actual,
		fetchReleases: async () => [
			{
				tag: "v9.9.9",
				version: "9.9.9",
				isBeta: false,
				downloadUrl: "https://example.invalid/release.zip",
				publishedAt: "2026-01-01T00:00:00.000Z",
			},
		],
		downloadRelease: async () => mkdtempSync(join(tmpdir(), "upgrade-cursor-src-")),
		smartUpdate: async () => ({
			added: 0,
			updated: 0,
			skipped: 0,
			userModified: [],
			orphansDeleted: [],
			orphansSkipped: [],
			deletionsDeleted: [],
		}),
	};
});

let dir: string;
let orig: string;
beforeEach(() => {
	orig = process.cwd();
	dir = mkdtempSync(join(tmpdir(), "upgrade-cursor-"));
	process.chdir(dir);
	runMigrateSpy.mockClear();
});
afterEach(() => {
	process.chdir(orig);
	rmSync(dir, { recursive: true, force: true });
});

describe("upgrade — cursor-only project", () => {
	it("refreshes managed surfaces but preserves a hand-edited AGENTS.md (no blind overwrite)", async () => {
		const { upgrade } = await import("../upgrade.js");
		// Simulate an existing cursor-only toolkit (ledger present — the authored-install
		// marker) with a hand-modified AGENTS.md and no ledger baseline for it yet.
		mkdirSync(join(dir, ".meowkit", "state"), { recursive: true });
		writeFileSync(meowkitStatePaths(join(dir, ".meowkit")).cursorLedger, '{"version":"3.0","installations":[]}\n');
		writeFileSync(join(dir, "AGENTS.md"), "# stale user edit\n");
		await upgrade({});
		// The hand-edited AGENTS.md has no ledger baseline and differs from the bundle, so it
		// is PRESERVED (conflict), not clobbered — the whole point of the reconciler.
		expect(readFileSync(join(dir, "AGENTS.md"), "utf-8")).toBe("# stale user edit\n");
		// The rest of the bundle still installs.
		expect(existsSync(join(dir, ".meowkit", "README.md"))).toBe(true);
		// It did NOT create a Claude Code kit, and never touched the network layer.
		expect(existsSync(join(dir, ".claude"))).toBe(false);
		expect(runMigrateSpy).not.toHaveBeenCalled();
	});
});

describe("upgrade — mixed .claude/ + authored .cursor/ project", () => {
	it("never re-runs the legacy .claude→.cursor exporter over the authored bundle", async () => {
		mkdirSync(join(dir, ".claude"), { recursive: true });
		// A pre-existing `.cursor/` dir (as a legacy-converter export, or simply coexisting
		// content) is present alongside the authored install. Dir presence alone must not
		// trigger the legacy re-export once the cursor ledger marks this as an authored install.
		mkdirSync(join(dir, ".cursor"), { recursive: true });
		writeFileSync(join(dir, ".cursor", "legacy-marker.mdc"), "# legacy converter output\n");
		mkdirSync(join(dir, ".meowkit", "state"), { recursive: true });
		writeFileSync(meowkitStatePaths(join(dir, ".meowkit")).cursorLedger, '{"version":"3.0","installations":[]}\n');

		const { upgrade } = await import("../upgrade.js");
		await upgrade({});

		// The legacy exporter was never invoked for cursor (nor for codex — no .codex/ here).
		expect(runMigrateSpy).not.toHaveBeenCalled();
		// The pre-existing legacy `.cursor/` content is left completely untouched.
		expect(readFileSync(join(dir, ".cursor", "legacy-marker.mdc"), "utf-8")).toBe("# legacy converter output\n");
		// The authored bundle WAS refreshed via the reconciler (not the legacy converter).
		expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
		expect(existsSync(join(dir, ".meowkit", "README.md"))).toBe(true);
	});
});
