// CLI-level characterization: the Cursor install path in dry-run mode must plan every
// manifest action accurately and write nothing into the target project. Mirrors
// codex-full-surface-cli-dry-run.test.ts's intent, adapted to Cursor's actual entrypoint:
// there is no `runMigrate({ tool: "cursor" })` — Cursor installs via
// `reconcileApplyCursorBundle` (the same function `mewkit init --target cursor
// --dry-run` calls, see commands/init.ts's initCursorTarget), so this drives that
// reconciler directly in dry-run mode over the real authored bundle.
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCursorModuleDir } from "../modules/cursor-authored-bundle.js";
import { reconcileApplyCursorBundle } from "../modules/cursor-reconcile-apply.js";

const moduleDir = resolveCursorModuleDir();

let target: string;
beforeEach(() => {
	target = mkdtempSync(join(tmpdir(), "cursor-cli-dry-run-"));
});
afterEach(async () => {
	await rm(target, { recursive: true, force: true });
});

describe("cursor install --dry-run over the real authored bundle", () => {
	it("plans every manifest surface as an install action and writes no provider files", async () => {
		const plan = await reconcileApplyCursorBundle(moduleDir, target, { dryRun: true, projectRoot: target });

		expect(plan.dryRun).toBe(true);
		expect(plan.writes).toBe(0);
		expect(plan.conflicts).toEqual([]);
		// Fresh empty target -> every planned entry is a real, non-skipped install action.
		expect(plan.entries.length).toBeGreaterThan(0);
		for (const entry of plan.entries) {
			expect(entry.wrote, `${entry.targetPath} reported wrote:true during dry-run`).toBe(false);
		}

		// Dry run must not write any provider surface into the target project.
		expect(existsSync(join(target, "AGENTS.md"))).toBe(false);
		expect(existsSync(join(target, ".cursor"))).toBe(false);
		expect(existsSync(join(target, ".agents"))).toBe(false);
		expect(existsSync(join(target, ".meowkit"))).toBe(false);
		expect(readdirSync(target)).toEqual([]);
	});

	it("the dry-run plan matches the real write outcome of a subsequent non-dry-run apply", async () => {
		const plan = await reconcileApplyCursorBundle(moduleDir, target, { dryRun: true, projectRoot: target });
		const plannedInstalls = plan.entries.filter((e) => e.action !== "conflict" && e.action !== "skip").length;

		const applied = await reconcileApplyCursorBundle(moduleDir, target, { projectRoot: target });
		expect(applied.writes).toBe(plannedInstalls);
		expect(existsSync(join(target, "AGENTS.md"))).toBe(true);
	});
});
