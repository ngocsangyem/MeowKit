import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyAuthoredCodexBundle, resolveCodexModuleDir } from "../codex-authored-bundle.js";
import {
	expandSkillsEntry,
	packSelectionBudgetWarning,
	resolvePackSelection,
	validateSkillPackCatalog,
	type SkillPackCatalog,
} from "../codex-skill-packs.js";
import type { ArtifactManifestEntry } from "../artifact-manifest-schema.js";

const moduleDir = resolveCodexModuleDir();

// Minimal synthetic catalog for selection/expansion logic (independent of the shipped one).
const CAT: SkillPackCatalog = {
	budgetChars: 8000,
	defaultPack: "core",
	packs: {
		core: { description: "", dependsOn: [], skills: ["a", "b"] },
		review: { description: "", dependsOn: ["core"], skills: ["c"] },
		integrations: { description: "", dependsOn: ["core"], skills: ["d", "e"] },
	},
};

describe("resolvePackSelection", () => {
	it("empty selection resolves to the default pack", () => {
		expect(resolvePackSelection(CAT, [])).toEqual({ packs: ["core"], skills: ["a", "b"] });
	});
	it("follows dependsOn transitively (review pulls in core)", () => {
		expect(resolvePackSelection(CAT, ["review"])).toEqual({ packs: ["core", "review"], skills: ["a", "b", "c"] });
	});
	it('"all" unions every pack', () => {
		const r = resolvePackSelection(CAT, "all");
		expect(r.packs).toEqual(["core", "integrations", "review"]);
		expect(r.skills).toEqual(["a", "b", "c", "d", "e"]);
	});
	it("throws on an unknown pack name", () => {
		expect(() => resolvePackSelection(CAT, ["nope"])).toThrow(/unknown skill pack/);
	});
});

describe("expandSkillsEntry", () => {
	it("expands the aggregate skills entry into one per-skill entry", () => {
		const base: ArtifactManifestEntry = {
			sourcePath: "root/.agents/skills",
			targetPath: ".agents/skills",
			provider: "codex",
			mode: "0644",
			ownership: "managed-replace",
			mergeBehavior: "replace",
			scopeTags: ["managed-runtime"],
			active: false,
		};
		const out = expandSkillsEntry(base, ["cook", "fix"]);
		expect(out).toHaveLength(2);
		expect(out[0].sourcePath).toBe("root/.agents/skills/cook");
		expect(out[0].targetPath).toBe(".agents/skills/cook");
		expect(out[1].targetPath).toBe(".agents/skills/fix");
		expect(out[0].ownership).toBe("managed-replace"); // metadata preserved
	});
});

describe("validateSkillPackCatalog (shipped catalog)", () => {
	it("the shipped catalog is coherent — no FAIL checks", () => {
		const checks = validateSkillPackCatalog(moduleDir);
		const fails = checks.filter((c) => c.level === "fail");
		expect(fails, fails.map((f) => `${f.name}: ${f.detail}`).join("; ")).toEqual([]);
	});
	it("the default (core) pack fits the discovery budget", () => {
		const checks = validateSkillPackCatalog(moduleDir);
		const coreBudget = checks.find((c) => c.name.includes("budget: core"));
		expect(coreBudget?.level).toBe("pass");
	});

	it("the default (core) install warns nothing; a large pack combo warns over-budget", () => {
		expect(packSelectionBudgetWarning(moduleDir, [])).toBeNull(); // core
		const warn = packSelectionBudgetWarning(moduleDir, ["integrations"]); // core + integrations
		expect(warn).toMatch(/over Codex's \d+-char discovery budget/);
	});
});

describe("pack-filtered install", () => {
	let target: string;
	beforeEach(() => {
		target = mkdtempSync(join(tmpdir(), "codex-packs-"));
	});
	afterEach(() => rmSync(target, { recursive: true, force: true }));

	it("core-only install excludes a non-core (integrations) skill", () => {
		copyAuthoredCodexBundle(moduleDir, target, { packs: ["core"] });
		expect(existsSync(join(target, ".agents", "skills", "cook", "SKILL.md"))).toBe(true); // core
		expect(existsSync(join(target, ".agents", "skills", "jira-issue"))).toBe(false); // integrations
		expect(existsSync(join(target, "AGENTS.md"))).toBe(true); // non-skill surfaces still install
	});

	it("selecting integrations pulls in its core dependency too", () => {
		copyAuthoredCodexBundle(moduleDir, target, { packs: ["integrations"] });
		expect(existsSync(join(target, ".agents", "skills", "jira-issue", "SKILL.md"))).toBe(true);
		expect(existsSync(join(target, ".agents", "skills", "cook", "SKILL.md"))).toBe(true); // via dependsOn core
	});

	it("undefined selection copies the whole tree (backward compatible)", () => {
		copyAuthoredCodexBundle(moduleDir, target); // no packs
		expect(existsSync(join(target, ".agents", "skills", "jira-issue", "SKILL.md"))).toBe(true);
		expect(existsSync(join(target, ".agents", "skills", "cook", "SKILL.md"))).toBe(true);
	});
});
