// MeowKit-side patches to the vendored claudekit-cli registry. Each override is annotated
// with the verifying source. Apply once at startup via applyMewkitOverrides() before any migration.

import { homedir } from "node:os";
import { join } from "node:path";
import { providerDocumentationContracts } from "./provider-documentation-contracts.js";
import { providers } from "./provider-registry.js";
import type { PortableType, ProviderType, ProviderConfig } from "./types.js";

const home = homedir();

let overridesApplied = false;

const portableTypes: PortableType[] = ["agent", "command", "skill", "config", "rules", "hooks"];

function disablePortableSurface(provider: ProviderConfig, portableType: PortableType): void {
	switch (portableType) {
		case "agent":
			provider.agents = null;
			return;
		case "command":
			provider.commands = null;
			return;
		case "skill":
			provider.skills = null;
			return;
		case "config":
			provider.config = null;
			return;
		case "rules":
			provider.rules = null;
			return;
		case "hooks":
			provider.hooks = null;
			return;
	}
}

export interface OverrideOptions {
	/** When true (Antigravity), write rules to AGENTS.md instead of GEMINI.md */
	preferAgentsMd?: boolean;
}

export function applyMewkitOverrides(options: OverrideOptions = {}): void {
	if (overridesApplied) return;

	// Disable undocumented or approximation-only surfaces. Migration should only emit
	// files that are backed by official tool documentation.
	for (const [provider, contract] of Object.entries(providerDocumentationContracts) as [
		ProviderType,
		(typeof providerDocumentationContracts)[ProviderType],
	][]) {
		for (const portableType of portableTypes) {
			const surface = contract.surfaces[portableType];
			if (surface?.status === "documented") continue;
			disablePortableSurface(providers[provider], portableType);
		}
	}

	providers.kilo._unverified = true;

	// Override A — Kiro paths. Source: https://kiro.dev/docs/steering/
	if (providers.kiro.agents) {
		providers.kiro.agents.projectPath = ".kiro/agents";
		providers.kiro.agents.globalPath = join(home, ".kiro/agents");
	}
	if (providers.kiro.config) providers.kiro.config.globalPath = join(home, ".kiro/steering/project.md");
	if (providers.kiro.rules) providers.kiro.rules.globalPath = join(home, ".kiro/steering");
	if (providers.kiro.skills) providers.kiro.skills.globalPath = join(home, ".kiro/skills");

	// Override B — Gemini CLI skills. Source: official Gemini CLI docs index.
	if (providers["gemini-cli"].skills) {
		providers["gemini-cli"].skills.projectPath = ".gemini/skills";
		providers["gemini-cli"].skills.globalPath = join(home, ".gemini/skills");
	}

	// Override C — Windsurf native workflow + skill + global rule paths.
	// Sources: https://docs.windsurf.com/windsurf/cascade/workflows
	//          https://docs.windsurf.com/windsurf/cascade/skills
	//          https://docs.windsurf.com/windsurf/cascade/memories
	if (providers.windsurf.commands) {
		providers.windsurf.commands.globalPath = join(home, ".codeium/windsurf/global_workflows");
		providers.windsurf.commands.charLimit = 12000;
	}
	if (providers.windsurf.skills) {
		providers.windsurf.skills.projectPath = ".windsurf/skills";
		providers.windsurf.skills.globalPath = join(home, ".codeium/windsurf/skills");
	}
	if (providers.windsurf.config) {
		providers.windsurf.config.globalPath = join(home, ".codeium/windsurf/memories/global_rules.md");
	}
	if (providers.windsurf.rules) {
		providers.windsurf.rules.globalPath = null;
	}

	// Override D — Amp now documents AGENTS.md (plural) as the active filename.
	// Source: https://ampcode.com/manual
	if (providers.amp.config) {
		providers.amp.config.projectPath = "AGENTS.md";
		providers.amp.config.globalPath = join(home, ".config/amp/AGENTS.md");
	}

	void options.preferAgentsMd;

	overridesApplied = true;
}

/** Reset for tests. */
export function _resetOverridesForTest(): void {
	overridesApplied = false;
}
