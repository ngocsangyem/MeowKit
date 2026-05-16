import { describe, expect, it } from "vitest";
import {
	detectProviderPathCollisions,
	getAllProviderTypes,
	getProvidersSupporting,
} from "../provider-registry-utils.js";
import { providers } from "../provider-registry.js";
import { applyMewkitOverrides } from "../provider-overrides.js";

applyMewkitOverrides();

describe("provider registry", () => {
	it("contains exactly 16 providers (claude-code source + 15 targets)", () => {
		const all = getAllProviderTypes();
		expect(all).toHaveLength(16);
		expect(all).toContain("claude-code");
	});

	it("only advertises officially documented hook surfaces", () => {
		const hookProviders = getProvidersSupporting("hooks").sort();
		expect(hookProviders).toEqual(["claude-code"]);
	});

	it("does not advertise undocumented Codex custom commands", () => {
		expect(providers.codex.commands).toBeNull();
	});

	it("stops advertising the legacy shared .agents/skills path across targets", () => {
		const collisions = detectProviderPathCollisions(["codex", "cursor", "windsurf", "gemini-cli", "amp"], {
			global: false,
		});
		const skillsCollision = collisions.find((c) => c.path === ".agents/skills");
		expect(skillsCollision).toBeUndefined();
	});

	it("antigravity only retains the documented rules surface", () => {
		expect(providers.antigravity.rules?.projectPath).toBe(".agent/rules");
		expect(providers.antigravity.config).toBeNull();
		expect(providers.antigravity.commands).toBeNull();
		expect(providers.antigravity.skills).toBeNull();
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
	it("Override A: Kiro global paths are aligned to documented agent and steering locations", () => {
		expect(providers.kiro.agents?.projectPath).toBe(".kiro/agents");
		expect(providers.kiro.agents?.globalPath).toContain(".kiro/agents");
		expect(providers.kiro.config?.globalPath).toContain(".kiro/steering");
	});

	it("OpenCode keeps only the documented agent and command surfaces", () => {
		expect(providers.opencode.agents?.projectPath).toBe(".opencode/agents");
		expect(providers.opencode.commands?.projectPath).toBe(".opencode/commands");
		expect(providers.opencode.skills).toBeNull();
		expect(providers.opencode.config).toBeNull();
		expect(providers.opencode.rules).toBeNull();
	});

	it("Override B: Gemini CLI skills paths point to .gemini/skills", () => {
		expect(providers["gemini-cli"].skills?.projectPath).toBe(".gemini/skills");
		expect(providers["gemini-cli"].skills?.globalPath).toContain(".gemini/skills");
		expect(providers["gemini-cli"].agents).toBeNull();
		expect(providers["gemini-cli"].hooks).toBeNull();
	});

	it("Override C: Windsurf workflow charLimit = 12000", () => {
		expect(providers.windsurf.commands?.charLimit).toBe(12000);
	});

	it("Override D: Amp now uses AGENTS.md", () => {
		expect(providers.amp.config?.projectPath).toBe("AGENTS.md");
		expect(providers.amp.config?.globalPath).toContain(".config/amp/AGENTS.md");
		expect(providers.amp.agents).toBeNull();
		expect(providers.amp.skills).toBeNull();
	});

	it("Override G: Kilo flagged as _unverified", () => {
		expect(providers.kilo._unverified).toBe(true);
	});

	it("Kiro global steering path set after override", () => {
		expect(providers.kiro.config?.globalPath).toContain(".kiro/steering");
	});

	it("Roo is marked deprecated", () => {
		expect(providers.roo.supportLevel).toBe("deprecated");
		expect(providers.roo.supportReason).toMatch(/May 15, 2026/);
		expect(providers.roo.agents).toBeNull();
		expect(providers.roo.rules).toBeNull();
	});

	it("Codex is marked experimental", () => {
		expect(providers.codex.supportLevel).toBe("experimental");
		expect(providers.codex.agents).toBeNull();
		expect(providers.codex.rules).toBeNull();
		expect(providers.codex.hooks).toBeNull();
	});
});
