import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { cwd, hasAnyInstallSignal } from "../detection-helpers.js";

export const githubCopilotConfig: ProviderConfig = {
	name: "github-copilot",
	displayName: "GitHub Copilot",
	supportLevel: "verified",
	subagents: "full",
	agents: {
		projectPath: ".github/agents",
		globalPath: null,
		format: "fm-to-fm",
		writeStrategy: "per-file",
		fileExtension: ".agent.md",
	},
	commands: null,
	skills: {
		projectPath: ".github/skills",
		globalPath: null,
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: ".github/copilot-instructions.md",
		globalPath: null,
		format: "md-strip",
		writeStrategy: "single-file",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".github/instructions",
		globalPath: null,
		format: "md-strip",
		writeStrategy: "per-file",
		fileExtension: ".instructions.md",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasAnyInstallSignal([
			join(cwd, ".github/agents"),
			join(cwd, ".github/skills"),
			join(cwd, ".github/instructions"),
			join(cwd, ".github/copilot-instructions.md"),
		]),
};
