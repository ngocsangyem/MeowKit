// MeowKit-side patches to the vendored claudekit-cli registry. Each override is annotated
// with the verifying source. Apply once at startup via applyMewkitOverrides() before any migration.

import { homedir } from "node:os";
import { join } from "node:path";
import { providers } from "./provider-registry.js";

const home = homedir();

let overridesApplied = false;

export interface OverrideOptions {
	/** When true (Antigravity), write rules to AGENTS.md instead of GEMINI.md */
	preferAgentsMd?: boolean;
}

export function applyMewkitOverrides(options: OverrideOptions = {}): void {
	if (overridesApplied) return;

	// Override A — Kiro globalPath. Source: https://kiro.dev/docs/steering/
	if (providers.kiro.agents) providers.kiro.agents.globalPath = join(home, ".kiro/steering");
	if (providers.kiro.config) providers.kiro.config.globalPath = join(home, ".kiro/steering/project.md");
	if (providers.kiro.rules) providers.kiro.rules.globalPath = join(home, ".kiro/steering");
	// kiro.skills.globalPath stays null until verified via dogfood

	// Override C — Windsurf workflow charLimit (12K). Source: https://docs.windsurf.com/windsurf/cascade/workflows
	if (providers.windsurf.commands) providers.windsurf.commands.charLimit = 12000;

	// Override D — OpenCode skills path. Source: https://opencode.ai/docs/skills/
	if (providers.opencode.skills) {
		providers.opencode.skills.projectPath = ".opencode/skills";
		providers.opencode.skills.globalPath = join(home, ".opencode/skills");
	}

	// Override G — Kilo Code unverified marker. Triggers runtime warning when selected.
	providers.kilo._unverified = true;

	// Override B — Antigravity: --prefer-agents-md flag opts in to AGENTS.md instead of GEMINI.md.
	// Source: https://antigravity.codes/blog/user-rules
	if (options.preferAgentsMd && providers.antigravity.config) {
		providers.antigravity.config.projectPath = "AGENTS.md";
	}

	overridesApplied = true;
}

/** Reset for tests. */
export function _resetOverridesForTest(): void {
	overridesApplied = false;
}
