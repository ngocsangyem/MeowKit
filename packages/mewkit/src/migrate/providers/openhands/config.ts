import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal } from "../detection-helpers.js";

export const openhandsConfig: ProviderConfig = {
	name: "openhands",
	displayName: "OpenHands",
	supportLevel: "experimental",
	supportReason: "OpenHands is microagent/setup-script centric; this adapter only approximates that model today.",
	subagents: "full",
	agents: {
		projectPath: ".openhands/skills",
		globalPath: join(home, ".openhands/skills"),
		format: "skill-md",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	commands: null,
	skills: {
		projectPath: ".openhands/skills",
		globalPath: join(home, ".openhands/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: ".openhands/instructions.md",
		globalPath: join(home, ".openhands/instructions.md"),
		format: "md-strip",
		writeStrategy: "single-file",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".openhands/rules",
		globalPath: join(home, ".openhands/rules"),
		format: "md-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasAnyInstallSignal([
			join(cwd, ".openhands/skills"),
			join(cwd, ".openhands/rules"),
			join(cwd, ".openhands/instructions.md"),
			join(home, ".openhands/skills"),
			join(home, ".openhands/rules"),
			join(home, ".openhands/instructions.md"),
		]),
};
