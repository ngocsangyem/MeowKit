// Acceptance test: an end-to-end install of the real authored Cursor bundle into a fresh
// temp project. Mirrors migrate-codex-acceptance.test.ts's intent (drive the real
// artifact-generation path, assert the resulting on-disk surfaces, prove idempotency) but
// adapted to Cursor's actual install path: `reconcileApplyCursorBundle` against the real
// bundle (no fixture corpus, no migration-report.json — Cursor has neither), which is
// exactly what `mewkit init --target cursor` calls (see commands/init.ts).
//
// This differs from cursor-bundle-lint.test.ts's "reconcile-install smoke" (default `core`
// pack only) by installing the FULL bundle (all 128 skills via packs: "all") and asserting
// every top-level surface category lands, not just the 3 core agents.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCursorModuleDir } from "../modules/cursor-authored-bundle.js";
import { reconcileApplyCursorBundle } from "../modules/cursor-reconcile-apply.js";

const moduleDir = resolveCursorModuleDir();

let projectDir: string;
beforeEach(async () => {
	projectDir = await mkdtemp(join(tmpdir(), "migrate-cursor-acceptance-"));
});
afterEach(async () => {
	await rm(projectDir, { recursive: true, force: true });
});

describe("migrate cursor acceptance — full-bundle install completeness", () => {
	it("installs every top-level surface with zero conflicts on a fresh project", async () => {
		const result = await reconcileApplyCursorBundle(moduleDir, projectDir, {
			packs: "all",
			adoptHomeRegistry: false,
			projectRoot: projectDir,
		});

		expect(result.conflicts).toEqual([]);
		expect(result.writes).toBeGreaterThan(0);

		expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
		expect(existsSync(join(projectDir, ".meowkit", "README.md"))).toBe(true);
		expect(existsSync(join(projectDir, ".cursor", "agents"))).toBe(true);
		expect(existsSync(join(projectDir, ".cursor", "rules"))).toBe(true);
		expect(existsSync(join(projectDir, ".cursor", "hooks.json"))).toBe(true);
		expect(existsSync(join(projectDir, ".cursor", "hooks"))).toBe(true);
		expect(existsSync(join(projectDir, ".cursor", "skills"))).toBe(true);

		// Cursor-only: no Claude Code kit is created alongside the native bundle.
		expect(existsSync(join(projectDir, ".claude"))).toBe(false);
	});

	it("installs all 41 agents and all 128 skills with the 'all' pack selection", async () => {
		await reconcileApplyCursorBundle(moduleDir, projectDir, {
			packs: "all",
			adoptHomeRegistry: false,
			projectRoot: projectDir,
		});

		const agentFiles = readdirSync(join(projectDir, ".cursor", "agents")).filter((f) => f.endsWith(".md"));
		expect(agentFiles.length).toBe(41);

		const skillDirs = readdirSync(join(projectDir, ".cursor", "skills"), { withFileTypes: true }).filter((d) =>
			d.isDirectory(),
		);
		expect(skillDirs.length).toBe(128);
	});

	it("is idempotent on a second run over the generated output — zero writes, zero conflicts", async () => {
		await reconcileApplyCursorBundle(moduleDir, projectDir, {
			packs: "all",
			adoptHomeRegistry: false,
			projectRoot: projectDir,
		});
		const agentsMdBefore = readFileSync(join(projectDir, "AGENTS.md"), "utf-8");

		const second = await reconcileApplyCursorBundle(moduleDir, projectDir, {
			packs: "all",
			adoptHomeRegistry: false,
			projectRoot: projectDir,
		});

		expect(second.writes).toBe(0);
		expect(second.conflicts).toEqual([]);
		expect(readFileSync(join(projectDir, "AGENTS.md"), "utf-8")).toBe(agentsMdBefore);
	});

	it("writes the project-local ledger under .meowkit/state — no global/home registry pollution", async () => {
		const result = await reconcileApplyCursorBundle(moduleDir, projectDir, {
			packs: "all",
			adoptHomeRegistry: false,
			projectRoot: projectDir,
		});

		expect(existsSync(result.ledgerPath)).toBe(true);
		expect(result.ledgerPath.startsWith(join(projectDir, ".meowkit"))).toBe(true);

		// No leftover top-level entries beyond the bundle's own managed surfaces.
		const topLevel = (await readdir(projectDir)).sort();
		// Skills live under `.cursor/skills` (not the cross-vendor `.agents/skills`) so a
		// co-installed Codex bundle owning `.agents/` can never collide with this tree.
		expect(topLevel).toEqual([".cursor", ".meowkit", "AGENTS.md"].sort());
	});
});
