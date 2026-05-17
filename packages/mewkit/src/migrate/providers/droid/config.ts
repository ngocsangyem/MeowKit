import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const droidConfig: ProviderConfig = {
	name: "droid",
	displayName: "Droid",
	supportLevel: "verified",
	subagents: "full",
	agents: {
		projectPath: ".factory/droids",
		globalPath: join(home, ".factory/droids"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	commands: {
		projectPath: ".factory/commands",
		globalPath: join(home, ".factory/commands"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	skills: {
		projectPath: ".factory/skills",
		globalPath: join(home, ".factory/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: "AGENTS.md",
		globalPath: join(home, ".factory/AGENTS.md"),
		format: "md-strip",
		writeStrategy: "single-file",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".factory/rules",
		globalPath: join(home, ".factory/rules"),
		format: "md-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	hooks: {
		projectPath: ".factory/hooks",
		globalPath: join(home, ".factory/hooks"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: "",
	},
	settingsJsonPath: { projectPath: ".factory/settings.json", globalPath: join(home, ".factory/settings.json") },
	detect: async () =>
		hasBinaryInPath("droid") ||
		hasAnyInstallSignal([
			join(cwd, ".factory/droids"),
			join(cwd, ".factory/commands"),
			join(cwd, ".factory/skills"),
			join(cwd, ".factory/rules"),
			join(cwd, ".factory/hooks"),
			join(cwd, ".factory/settings.json"),
			join(home, ".factory/droids"),
			join(home, ".factory/commands"),
			join(home, ".factory/skills"),
			join(home, ".factory/rules"),
			join(home, ".factory/hooks"),
			join(home, ".factory/AGENTS.md"),
			join(home, ".factory/settings.json"),
		]),
};
