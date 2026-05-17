import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";

const home = homedir();

// Re-point Windsurf to native workflow / skill / global memory paths and force
// the workflow charLimit. Setting `rules.globalPath = null` is intentional —
// the per-rule files migrate per-project; the global rules go through the
// config surface as a single memories file.
//
// Sources:
//   https://docs.windsurf.com/windsurf/cascade/workflows
//   https://docs.windsurf.com/windsurf/cascade/skills
//   https://docs.windsurf.com/windsurf/cascade/memories
export function applyWindsurfOverrides(config: ProviderConfig): void {
	if (config.commands) {
		config.commands.globalPath = join(home, ".codeium/windsurf/global_workflows");
		config.commands.charLimit = 12000;
	}
	if (config.skills) {
		config.skills.projectPath = ".windsurf/skills";
		config.skills.globalPath = join(home, ".codeium/windsurf/skills");
	}
	if (config.config) {
		config.config.globalPath = join(home, ".codeium/windsurf/memories/global_rules.md");
	}
	if (config.rules) {
		config.rules.globalPath = null;
	}
}
