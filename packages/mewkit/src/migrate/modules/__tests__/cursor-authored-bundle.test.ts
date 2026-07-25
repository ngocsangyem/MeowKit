// Content-shape tests for the Cursor bundle's core skill pack (deferred from Phase 3 part A
// — cursor-bundle-lint.test.ts asserted the shape contract before any skill existed; this
// file asserts the real content once it landed). Covers: the 24 named core skills are
// present, the manifest resolves them, and pack-selection expansion works end to end
// through `reconcileApplyCursorBundle` — mirrors codex-skill-packs.test.ts's
// "pack-filtered install" section, adapted to the reconciler-backed cursor install path
// (cursor has no plain `copyAuthoredCursorBundle`; the reconciler IS the install path).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCursorBundleManifest, resolveCursorModuleDir } from "../cursor-authored-bundle.js";
import { reconcileApplyCursorBundle } from "../cursor-reconcile-apply.js";
import { loadSkillPackCatalog, packSelectionBudgetWarning, resolvePackSelection } from "../codex-skill-packs.js";

const moduleDir = resolveCursorModuleDir();

// The 24 core skills named in the phase spec (codex `core` pack, adapted 1:1 under the
// mk- namespace). Kept as a literal list so a regression drops a name loudly instead of
// silently shrinking the install.
const CORE_SKILLS = [
	"mk-agent-detector",
	"mk-brainstorming",
	"mk-cook",
	"mk-development",
	"mk-docs-init",
	"mk-document-release",
	"mk-fix",
	"mk-help",
	"mk-investigate",
	"mk-lint-and-validate",
	"mk-memory",
	"mk-plan-creator",
	"mk-project-context",
	"mk-project-organization",
	"mk-research",
	"mk-review",
	"mk-scout",
	"mk-sequential-thinking",
	"mk-ship",
	"mk-simplify",
	"mk-testing",
	"mk-validate-plan",
	"mk-verify",
	"mk-workflow-orchestrator",
].sort();

// disable-model-invocation: true is expected on these command-like (explicit-invocation-only)
// skills; every other core skill stays model-invocable (auto-routable by description).
const DISABLE_MODEL_INVOCATION = new Set([
	"mk-cook",
	"mk-ship",
	"mk-plan-creator",
	"mk-fix",
	"mk-review",
	"mk-simplify",
	"mk-verify",
	"mk-validate-plan",
	"mk-testing",
	"mk-document-release",
	"mk-docs-init",
	"mk-lint-and-validate",
]);

describe("cursor bundle: manifest + catalog resolve the 24-skill core pack", () => {
	it("the manifest has a schema-valid .cursor/skills entry with the source dir present", () => {
		const manifest = loadCursorBundleManifest(moduleDir);
		expect(manifest.provider).toBe("cursor");
		const skillsEntry = manifest.entries.find((e) => e.targetPath === ".cursor/skills");
		expect(skillsEntry, "no .cursor/skills manifest entry").toBeDefined();
		expect(skillsEntry?.active).toBe(true);
		expect(existsSync(join(moduleDir, skillsEntry!.sourcePath))).toBe(true);
	});

	it("the core pack resolves to exactly the 24 named skills", () => {
		const catalog = loadSkillPackCatalog(moduleDir);
		expect(catalog).not.toBeNull();
		const { skills } = resolvePackSelection(catalog!, []); // [] = catalog default (core)
		expect(skills).toEqual(CORE_SKILLS);
	});

	it("every core skill dir exists on disk with a SKILL.md", () => {
		const skillsRoot = join(moduleDir, "root", ".cursor", "skills");
		for (const name of CORE_SKILLS) {
			expect(existsSync(join(skillsRoot, name, "SKILL.md")), `${name} missing SKILL.md`).toBe(true);
		}
	});

	it("exactly the designated command-like skills carry disable-model-invocation: true", () => {
		const skillsRoot = join(moduleDir, "root", ".cursor", "skills");
		const flagged: string[] = [];
		for (const name of CORE_SKILLS) {
			const body = readFileSync(join(skillsRoot, name, "SKILL.md"), "utf-8");
			if (/^disable-model-invocation:\s*true\s*$/m.test(body)) flagged.push(name);
		}
		expect(flagged.sort()).toEqual([...DISABLE_MODEL_INVOCATION].sort());
	});
});

describe("cursor bundle: pack-expansion installs each skill as an independent reconciled item", () => {
	let target: string;
	beforeEach(() => {
		target = mkdtempSync(join(tmpdir(), "cursor-packs-"));
	});
	afterEach(() => rmSync(target, { recursive: true, force: true }));

	it("packs: ['core'] installs all 24 skill dirs plus the non-skill surfaces", async () => {
		const result = await reconcileApplyCursorBundle(moduleDir, target, {
			packs: ["core"],
			adoptHomeRegistry: false,
			projectRoot: target,
		});
		expect(result.conflicts).toEqual([]);
		for (const name of CORE_SKILLS) {
			expect(existsSync(join(target, ".cursor", "skills", name, "SKILL.md")), `${name} not installed`).toBe(true);
		}
		// Non-skill surfaces from the manifest still install alongside the expanded skills.
		expect(existsSync(join(target, "AGENTS.md"))).toBe(true);
		expect(existsSync(join(target, ".cursor", "agents", "explorer.md"))).toBe(true);
		expect(existsSync(join(target, ".cursor", "rules", "runtime-invariants.mdc"))).toBe(true);
	});

	it("a second run with the same pack selection is a no-op (idempotent per-skill)", async () => {
		await reconcileApplyCursorBundle(moduleDir, target, { packs: ["core"], adoptHomeRegistry: false, projectRoot: target });
		const second = await reconcileApplyCursorBundle(moduleDir, target, {
			packs: ["core"],
			adoptHomeRegistry: false,
			projectRoot: target,
		});
		expect(second.writes).toBe(0);
		expect(second.conflicts).toEqual([]);
	});

	it("undefined pack selection copies the whole skills tree (backward compatible, pre-pack behavior)", async () => {
		const result = await reconcileApplyCursorBundle(moduleDir, target, { adoptHomeRegistry: false, projectRoot: target });
		expect(result.conflicts).toEqual([]);
		for (const name of CORE_SKILLS) {
			expect(existsSync(join(target, ".cursor", "skills", name, "SKILL.md"))).toBe(true);
		}
	});
});

describe("cursor bundle: pack-selection budget warning", () => {
	it("the real core install (24 skills + 3 agents) stays under the catalog's budget — no warning", () => {
		expect(packSelectionBudgetWarning(moduleDir, [])).toBeNull();
	});

	// The shipped `core` pack fits comfortably under budget by design, so there is no real
	// oversized combination to select today (extended packs are empty). To prove the warning
	// path actually fires — not just that it stays silent — this builds a throwaway module
	// dir with the SAME generic catalog shape (catalog/skill-packs.json + root/.cursor/skills)
	// but a deliberately tiny budgetChars, reusing the real `packSelectionBudgetWarning`
	// function unmodified against synthetic content sized to exceed it.
	describe("synthetic oversized selection", () => {
		let synthModuleDir: string;
		beforeEach(() => {
			synthModuleDir = mkdtempSync(join(tmpdir(), "cursor-budget-synth-"));
			const skillsRoot = join(synthModuleDir, "root", ".cursor", "skills");
			for (const name of ["mk-a", "mk-b"]) {
				const dir = join(skillsRoot, name);
				mkdirSync(dir, { recursive: true });
				writeFileSync(
					join(dir, "SKILL.md"),
					`---\nname: "${name}"\ndescription: "${"x".repeat(80)}"\n---\n\n# ${name}\n`,
				);
			}
			mkdirSync(join(synthModuleDir, "catalog"), { recursive: true });
			writeFileSync(
				join(synthModuleDir, "catalog", "skill-packs.json"),
				JSON.stringify({
					budgetChars: 10, // deliberately tiny — two ~90-char skills blow past this
					defaultPack: "core",
					packs: { core: { description: "", dependsOn: [], skills: ["mk-a", "mk-b"] } },
				}),
			);
		});
		afterEach(() => rmSync(synthModuleDir, { recursive: true, force: true }));

		it("an over-budget selection returns a warning naming the offending pack(s)", () => {
			const warn = packSelectionBudgetWarning(synthModuleDir, []);
			expect(warn).toMatch(/over Codex's 10-char discovery budget/);
			expect(warn).toContain("core");
		});
	});
});
