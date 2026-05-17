import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal } from "../detection-helpers.js";

export const rooConfig: ProviderConfig = {
	name: "roo",
	displayName: "Roo Code",
	supportLevel: "deprecated",
	supportReason: "Roo Code docs announce product shutdown effective May 15, 2026.",
	subagents: "full",
	agents: {
		projectPath: ".roomodes",
		globalPath: join(home, ".roo/custom_modes.yaml"),
		format: "fm-to-yaml",
		writeStrategy: "yaml-merge",
		fileExtension: ".yaml",
	},
	commands: null,
	skills: {
		projectPath: ".roo/skills",
		globalPath: join(home, ".roo/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: ".roo/rules/project-config.md",
		globalPath: join(home, ".roo/rules/project-config.md"),
		format: "md-strip",
		writeStrategy: "single-file",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".roo/rules",
		globalPath: join(home, ".roo/rules"),
		format: "md-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasAnyInstallSignal([
			join(cwd, ".roomodes"),
			join(cwd, ".roo/rules"),
			join(cwd, ".roo/skills"),
			join(home, ".roo/custom_modes.yaml"),
			join(home, ".roo/rules"),
			join(home, ".roo/skills"),
		]),
};
