import { describe, expect, it } from "vitest";
import {
	detectProviderPathCollisions,
	getAllProviderTypes,
	getProvidersSupporting,
} from "../provider-registry-utils.js";
import { providers } from "../provider-registry.js";
import { applyMewkitOverrides } from "../provider-overrides.js";

describe("provider registry", () => {
	it("contains exactly 16 providers (claude-code source + 15 targets)", () => {
		const all = getAllProviderTypes();
		expect(all).toHaveLength(16);
		expect(all).toContain("claude-code");
	});

	it("hooks-supporting providers: exactly claude-code, codex, droid, gemini-cli", () => {
		const hookProviders = getProvidersSupporting("hooks").sort();
		expect(hookProviders).toEqual(["claude-code", "codex", "droid", "gemini-cli"]);
	});

	it(".agents/skills/ shared by codex+cursor+windsurf+gemini-cli+amp (5 providers)", () => {
		const collisions = detectProviderPathCollisions(
			["codex", "cursor", "windsurf", "gemini-cli", "amp"],
			{ global: false },
		);
		const skillsCollision = collisions.find((c) => c.path === ".agents/skills");
		expect(skillsCollision).toBeDefined();
		expect(skillsCollision?.providers.sort()).toEqual(
			["amp", "codex", "cursor", "gemini-cli", "windsurf"],
		);
	});

	it("antigravity uses .agent/skills (singular), distinct from .agents/skills", () => {
		expect(providers.antigravity.skills?.projectPath).toBe(".agent/skills");
	});

	it("every provider config has detect function", () => {
		for (const type of getAllProviderTypes()) {
			expect(typeof providers[type].detect).toBe("function");
		}
	});

	it("Windsurf charLimit set on rules (6K) and totalCharLimit (12K)", () => {
		expect(providers.windsurf.rules?.charLimit).toBe(6000);
		expect(providers.windsurf.rules?.totalCharLimit).toBe(12000);
	});
});

describe("provider overrides", () => {
	it("Override A: Kiro globalPath set after override", () => {
		applyMewkitOverrides();
		expect(providers.kiro.config?.globalPath).toContain(".kiro/steering");
	});

	it("Override D: OpenCode skills paths point to .opencode/skills", () => {
		applyMewkitOverrides();
		expect(providers.opencode.skills?.projectPath).toBe(".opencode/skills");
		expect(providers.opencode.skills?.globalPath).toContain(".opencode/skills");
	});

	it("Override C: Windsurf workflow charLimit = 12000", () => {
		applyMewkitOverrides();
		expect(providers.windsurf.commands?.charLimit).toBe(12000);
	});

	it("Override G: Kilo flagged as _unverified", () => {
		applyMewkitOverrides();
		expect(providers.kilo._unverified).toBe(true);
	});
});
