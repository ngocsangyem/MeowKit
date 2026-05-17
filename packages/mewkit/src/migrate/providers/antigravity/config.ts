import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const antigravityConfig: ProviderConfig = {
	name: "antigravity",
	displayName: "Antigravity",
	supportLevel: "experimental",
	supportReason: "Runtime support exists, but parts of this adapter are based on a younger and still-shifting tool surface.",
	subagents: "full",
	agents: null,
	commands: {
		projectPath: ".agent/workflows",
		globalPath: null,
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
		nestedCommands: false,
	},
	skills: {
		projectPath: ".agent/skills",
		globalPath: join(home, ".gemini/antigravity/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: "GEMINI.md",
		globalPath: join(home, ".gemini/GEMINI.md"),
		format: "md-strip",
		writeStrategy: "single-file",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".agent/rules",
		globalPath: null,
		format: "md-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasBinaryInPath("agy") ||
		hasBinaryInPath("antigravity") ||
		hasAnyInstallSignal([
			join(cwd, ".agent/rules"),
			join(cwd, ".agent/skills"),
			join(cwd, ".agent/workflows"),
			join(cwd, "GEMINI.md"),
			join(home, ".gemini/antigravity"),
			join(home, ".gemini/antigravity/skills"),
		]),
};
