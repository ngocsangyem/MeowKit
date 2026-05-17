import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";

const home = homedir();

// Point Gemini CLI skills at the native `.gemini/skills` directory documented
// in the Gemini CLI docs index.
export function applyGeminiCliOverrides(config: ProviderConfig): void {
	if (config.skills) {
		config.skills.projectPath = ".gemini/skills";
		config.skills.globalPath = join(home, ".gemini/skills");
	}
}
