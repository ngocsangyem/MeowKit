import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal } from "../detection-helpers.js";

export const kiloConfig: ProviderConfig = {
	name: "kilo",
	displayName: "Kilo Code",
	supportLevel: "experimental",
	supportReason: "Adapter is kept for compatibility, but exact file-level migration contract is not fully verified.",
	subagents: "full",
	agents: {
		projectPath: ".kilocodemodes",
		globalPath: join(home, ".kilocode/custom_modes.yaml"),
		format: "fm-to-yaml",
		writeStrategy: "yaml-merge",
		fileExtension: ".yaml",
	},
	commands: null,
	skills: {
		projectPath: ".kilocode/skills",
		globalPath: join(home, ".kilocode/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: ".kilocode/rules/project-config.md",
		globalPath: join(home, ".kilocode/rules/project-config.md"),
		format: "md-strip",
		writeStrategy: "single-file",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".kilocode/rules",
		globalPath: join(home, ".kilocode/rules"),
		format: "md-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasAnyInstallSignal([
			join(cwd, ".kilocodemodes"),
			join(cwd, ".kilocode/rules"),
			join(cwd, ".kilocode/skills"),
			join(home, ".kilocode/custom_modes.yaml"),
			join(home, ".kilocode/rules"),
			join(home, ".kilocode/skills"),
		]),
};
