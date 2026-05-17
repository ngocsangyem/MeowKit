import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";

const home = homedir();

// Re-point Kiro's global path roots at the documented steering/agents/skills
// directories. Source: https://kiro.dev/docs/steering/
export function applyKiroOverrides(config: ProviderConfig): void {
	if (config.agents) {
		config.agents.projectPath = ".kiro/agents";
		config.agents.globalPath = join(home, ".kiro/agents");
	}
	if (config.config) config.config.globalPath = join(home, ".kiro/steering/project.md");
	if (config.rules) config.rules.globalPath = join(home, ".kiro/steering");
	if (config.skills) config.skills.globalPath = join(home, ".kiro/skills");
}
