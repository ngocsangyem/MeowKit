import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal } from "../detection-helpers.js";

export const clineConfig: ProviderConfig = {
	name: "cline",
	displayName: "Cline",
	supportLevel: "experimental",
	supportReason: "Cline has richer native concepts than this adapter currently models, especially around modes and workflows.",
	subagents: "full",
	agents: {
		projectPath: ".clinerules",
		globalPath: null,
		format: "fm-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	commands: null,
	skills: {
		projectPath: ".cline/skills",
		globalPath: join(home, ".cline/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: ".clinerules/project-config.md",
		globalPath: null,
		format: "md-strip",
		writeStrategy: "single-file",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".clinerules",
		globalPath: null,
		format: "md-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasAnyInstallSignal([join(cwd, ".clinerules"), join(cwd, ".cline/skills"), join(home, ".cline/skills")]),
};
