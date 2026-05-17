import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";

const home = homedir();

// Amp moved to AGENTS.md (plural) as the active instruction filename per the
// current Amp manual. Earlier docs used the singular AGENT.md.
// Source: https://ampcode.com/manual
export function applyAmpOverrides(config: ProviderConfig): void {
	if (config.config) {
		config.config.projectPath = "AGENTS.md";
		config.config.globalPath = join(home, ".config/amp/AGENTS.md");
	}
}
