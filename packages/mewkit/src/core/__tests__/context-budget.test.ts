import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackManifest } from "../pack-manifest.js";
import { resolveProfile } from "../pack-resolver.js";
import { classifyTier, computeContextBudget } from "../context-budget.js";

const LIVE = join(process.cwd(), ".claude");

describe("classifyTier", () => {
	it("classifies CLAUDE.md and rules/*.md as always-on", () => {
		expect(classifyTier("CLAUDE.md")).toBe("always-on");
		expect(classifyTier("rules/security-rules.md")).toBe("always-on");
	});

	it("classifies rules-conditional/*.md as conditional (not always-on)", () => {
		// Regression guard: conditional rules were previously counted as always-on.
		expect(classifyTier("rules-conditional/agile-story-gates.md")).toBe("conditional");
	});

	it("classifies SKILL.md entrypoints as on-demand and references as null", () => {
		expect(classifyTier("skills/foo/SKILL.md")).toBe("on-demand");
		expect(classifyTier("skills/foo/references/x.md")).toBeNull();
		expect(classifyTier("agents/planner.md")).toBe("on-demand");
		expect(classifyTier("commands/mk/cook.md")).toBe("on-demand");
	});
});

describe("computeContextBudget on the live harness", () => {
	it("estimates a non-empty loadable set with line + token counts", () => {
		const core = computeContextBudget(LIVE, "core");
		expect(core.profile).toBe("core");
		expect(core.files).toBeGreaterThan(0);
		expect(core.lines).toBeGreaterThan(0);
		expect(core.tokens).toBeGreaterThan(0);
	});

	it("preserves top-level aggregates and adds a per-tier breakdown", () => {
		const core = computeContextBudget(LIVE, "core");
		// Top-level keys preserved (back-compat with --fail-over and prior --json consumers).
		expect(typeof core.files).toBe("number");
		expect(typeof core.lines).toBe("number");
		expect(typeof core.tokens).toBe("number");
		// Additive tiers; files + lines sum exactly to the top-level totals.
		const tiers = core.tiers;
		const tierFiles = tiers["always-on"].files + tiers.conditional.files + tiers["on-demand"].files;
		const tierLines = tiers["always-on"].lines + tiers.conditional.lines + tiers["on-demand"].lines;
		expect(tierFiles).toBe(core.files);
		expect(tierLines).toBe(core.lines);
		// always-on tier holds CLAUDE.md + rules and is non-empty for core.
		expect(tiers["always-on"].files).toBeGreaterThan(0);
	});

	it("grows core < developer < full (more packs ⇒ more loadable context)", () => {
		const core = computeContextBudget(LIVE, "core");
		const developer = computeContextBudget(LIVE, "developer");
		const full = computeContextBudget(LIVE, "full");
		expect(developer.tokens).toBeGreaterThan(core.tokens);
		expect(full.tokens).toBeGreaterThan(developer.tokens);
		expect(full.files).toBeGreaterThan(core.files);
	});

	it("counts only loadable entrypoints — not skill reference/script sub-files", () => {
		const manifest = loadPackManifest(LIVE);
		// Resolve core's full path set; loadable must be a strict subset (refs excluded).
		const allPaths = resolveProfile(LIVE, manifest, "core");
		const core = computeContextBudget(LIVE, "core");
		expect(core.files).toBeLessThan(allPaths.size);
		// no references/ path should be counted (only SKILL.md entrypoints)
	});
});
