import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackManifest } from "../pack-manifest.js";
import { resolveProfile } from "../pack-resolver.js";
import { computeContextBudget } from "../context-budget.js";

const LIVE = join(process.cwd(), ".claude");

describe("computeContextBudget on the live harness", () => {
	it("estimates a non-empty loadable set with line + token counts", () => {
		const core = computeContextBudget(LIVE, "core");
		expect(core.profile).toBe("core");
		expect(core.files).toBeGreaterThan(0);
		expect(core.lines).toBeGreaterThan(0);
		expect(core.tokens).toBeGreaterThan(0);
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
