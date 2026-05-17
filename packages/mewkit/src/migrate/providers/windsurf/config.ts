import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { cwd, home, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const windsurfConfig: ProviderConfig = {
	name: "windsurf",
	displayName: "Windsurf",
	supportLevel: "verified",
	subagents: "none",
	agents: {
		projectPath: ".windsurf/rules",
		globalPath: join(home, ".codeium/windsurf/rules"),
		format: "fm-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
		charLimit: 12000,
	},
	commands: {
		projectPath: ".windsurf/workflows",
		globalPath: join(home, ".codeium/windsurf/workflows"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
		nestedCommands: false,
	},
	skills: {
		projectPath: ".agents/skills",
		globalPath: join(home, ".agents/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: ".windsurf/rules/rules.md",
		globalPath: join(home, ".codeium/windsurf/rules/rules.md"),
		format: "md-strip",
		writeStrategy: "single-file",
		fileExtension: ".md",
		charLimit: 6000,
	},
	rules: {
		projectPath: ".windsurf/rules",
		globalPath: join(home, ".codeium/windsurf/rules"),
		format: "md-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
		charLimit: 6000,
		totalCharLimit: 12000,
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasBinaryInPath("windsurf") ||
		hasAnyInstallSignal([
			join(cwd, ".windsurf/rules"),
			join(cwd, ".windsurf/workflows"),
			join(home, ".codeium/windsurf/rules"),
			join(home, ".codeium/windsurf/workflows"),
		]),
};
