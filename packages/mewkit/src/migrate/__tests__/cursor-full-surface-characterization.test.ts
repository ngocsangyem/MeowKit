// Characterization tests for the Cursor authored bundle's full surface shape. Mirrors
// codex-full-surface-characterization.test.ts's intent (pin the corpus shape so an
// unintended future change fails loudly) but adapted to what Cursor actually ships: a
// hand-authored bundle (manifest + catalogs + root/** tree), not a converter pipeline over
// a fixture corpus. Counts below are asserted explicitly (not a full-string snapshot) per
// the phase's "prefer explicit counts over brittle snapshot" guidance.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCursorBundleManifest, resolveCursorModuleDir } from "../modules/cursor-authored-bundle.js";
import { loadSkillPackCatalog, resolvePackSelection } from "../modules/codex-skill-packs.js";

const moduleDir = resolveCursorModuleDir();
const rootDir = join(moduleDir, "root");

interface AgentPackCatalog {
	packs: Record<string, { agents: string[] }>;
}

describe("cursor full-surface characterization: manifest inventory", () => {
	it("declares exactly the 7 top-level managed surfaces, all active", () => {
		const manifest = loadCursorBundleManifest(moduleDir);
		expect(manifest.provider).toBe("cursor");
		const targetPaths = manifest.entries.map((e) => e.targetPath).sort();
		expect(targetPaths).toEqual(
			[
				"AGENTS.md",
				".meowkit/README.md",
				".cursor/agents",
				".cursor/rules",
				".cursor/skills",
				".cursor/hooks.json",
				".cursor/hooks",
			].sort(),
		);
		expect(manifest.entries.every((e) => e.active)).toBe(true);
		expect(manifest.entries.every((e) => e.ownership === "managed-replace")).toBe(true);
	});
});

describe("cursor full-surface characterization: skill catalog inventory", () => {
	it("resolves exactly 126 skills across all packs, matching the on-disk skill dir count", () => {
		const catalog = loadSkillPackCatalog(moduleDir);
		expect(catalog).not.toBeNull();
		const { skills } = resolvePackSelection(catalog!, "all");
		expect(skills.length).toBe(126);

		const onDisk = readdirSync(join(rootDir, ".cursor", "skills"), { withFileTypes: true }).filter((d) =>
			d.isDirectory(),
		);
		expect(onDisk.length).toBe(126);
		expect([...skills].sort()).toEqual(onDisk.map((d) => d.name).sort());
	});

	it("the core pack (default install) is a strict 24-skill subset of the full 126", () => {
		const catalog = loadSkillPackCatalog(moduleDir);
		const { skills: core } = resolvePackSelection(catalog!, []); // [] = catalog default (core)
		const { skills: all } = resolvePackSelection(catalog!, "all");
		expect(core.length).toBe(24);
		for (const name of core) expect(all).toContain(name);
	});

	it("ships exactly 7 packs, each with a non-empty skills list except intentionally-empty extended packs are absent", () => {
		const catalog = loadSkillPackCatalog(moduleDir);
		const packNames = Object.keys(catalog!.packs).sort();
		expect(packNames).toEqual(
			["core", "development", "review", "product", "operations", "media", "integrations"].sort(),
		);
		for (const name of packNames) expect(catalog!.packs[name].skills.length).toBeGreaterThan(0);
	});
});

describe("cursor full-surface characterization: agent catalog inventory", () => {
	it("ships exactly 41 agent files, matching the union of every agent pack", () => {
		const onDisk = readdirSync(join(rootDir, ".cursor", "agents")).filter((f) => f.endsWith(".md"));
		expect(onDisk.length).toBe(41);

		const catalog = JSON.parse(
			readFileSync(join(moduleDir, "catalog", "agent-packs.json"), "utf-8"),
		) as AgentPackCatalog;
		const unionOfPacks = new Set(Object.values(catalog.packs).flatMap((p) => p.agents));
		expect(unionOfPacks.size).toBe(41);
		expect([...unionOfPacks].map((n) => `${n}.md`).sort()).toEqual(onDisk.sort());
	});

	it("the core agent pack is exactly {explore, planner, reviewer} — every core agent ships on disk", () => {
		const catalog = JSON.parse(
			readFileSync(join(moduleDir, "catalog", "agent-packs.json"), "utf-8"),
		) as AgentPackCatalog;
		expect(catalog.packs.core.agents.slice().sort()).toEqual(["explore", "planner", "reviewer"]);
		for (const name of catalog.packs.core.agents) {
			expect(existsSync(join(rootDir, ".cursor", "agents", `${name}.md`))).toBe(true);
		}
	});
});

describe("cursor full-surface characterization: rules + hooks inventory", () => {
	it("ships exactly 4 rules, with runtime-invariants.mdc as the sole Always Apply rule", () => {
		const names = readdirSync(join(rootDir, ".cursor", "rules")).filter((f) => f.endsWith(".mdc"));
		expect(names.length).toBe(4);
		expect(names).toContain("runtime-invariants.mdc");
	});

	it("hooks.json declares the full lifecycle-event set backed by real .cjs handlers", () => {
		const hooksJson = JSON.parse(readFileSync(join(rootDir, ".cursor", "hooks.json"), "utf-8")) as {
			hooks: Record<string, Array<{ command: string }>>;
		};
		const events = Object.keys(hooksJson.hooks).sort();
		expect(events).toEqual(
			[
				"sessionStart",
				"sessionEnd",
				"beforeReadFile",
				"beforeShellExecution",
				"beforeMCPExecution",
				"preToolUse",
				"postToolUse",
				"postToolUseFailure",
				"afterFileEdit",
				"afterShellExecution",
				"afterMCPExecution",
				"preCompact",
				"beforeSubmitPrompt",
				"subagentStart",
				"subagentStop",
				"stop",
			].sort(),
		);
		const commands = Object.values(hooksJson.hooks).flatMap((group) => group.map((h) => h.command));
		for (const command of commands) {
			const match = command.match(/node \.cursor\/hooks\/([\w-]+)\.cjs/);
			expect(match, `hook command has no resolvable handler path: ${command}`).not.toBeNull();
			expect(existsSync(join(rootDir, ".cursor", "hooks", `${match![1]}.cjs`)), match![1]).toBe(true);
		}
	});
});
