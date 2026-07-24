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
	it("contains exactly 3 providers (claude-code source + 2 targets)", () => {
		const all = getAllProviderTypes();
		expect(all).toHaveLength(3);
		expect(all).toContain("claude-code");
		expect(all).toEqual(["claude-code", "codex", "cursor"]);
	});

	it("only advertises officially documented hook surfaces", () => {
		// Codex hooks conversion is nulled — the toolkit's own hooks ship via the
		// native authored bundle + reconciler, not the generic runtime converter.
		const hookProviders = getProvidersSupporting("hooks").sort();
		expect(hookProviders).toEqual(["claude-code"]);
	});

	it("nulls the Codex agents/commands/hooks conversion surfaces", () => {
		// Toolkit agents/commands/hooks ship via the authored bundle + reconciler;
		// a downstream project's own .claude/agents|commands|hooks are no longer
		// auto-converted for Codex (advisory surfaced in the migrate summary instead).
		expect(providers.codex.agents).toBeNull();
		expect(providers.codex.commands).toBeNull();
		expect(providers.codex.hooks).toBeNull();
	});

	it("stops advertising the legacy shared .agents/skills path across targets", () => {
		const collisions = detectProviderPathCollisions(["codex", "cursor"], {
			global: false,
		});
		const skillsCollision = collisions.find((c) => c.path === ".agents/skills");
		expect(skillsCollision).toBeUndefined();
	});

	it("every provider config has detect function", () => {
		for (const type of getAllProviderTypes()) {
			expect(typeof providers[type].detect).toBe("function");
		}
	});
});

describe("provider overrides", () => {
	it("Codex is marked experimental", () => {
		expect(providers.codex.supportLevel).toBe("experimental");
		expect(providers.codex.agents).toBeNull();
		expect(providers.codex.skills?.projectPath).toBe(".agents/skills");
		expect(providers.codex.config?.projectPath).toBe("AGENTS.md");
		expect(providers.codex.rules?.projectPath).toBe("AGENTS.md");
		expect(providers.codex.rules?.format).toBe("md-strip");
		expect(providers.codex.rules?.fileExtension).toBe(".md");
		expect(providers.codex.hooks).toBeNull();
		expect(providers.codex.commands).toBeNull();
	});
});
