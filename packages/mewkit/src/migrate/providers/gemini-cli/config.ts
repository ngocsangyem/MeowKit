import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { cwd, home, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const geminiCliConfig: ProviderConfig = {
	name: "gemini-cli",
	displayName: "Gemini CLI",
	supportLevel: "verified",
	subagents: "planned",
	agents: {
		projectPath: "AGENTS.md",
		globalPath: join(home, ".gemini/GEMINI.md"),
		format: "fm-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
	},
	commands: {
		projectPath: ".gemini/commands",
		globalPath: join(home, ".gemini/commands"),
		format: "md-to-toml",
		writeStrategy: "per-file",
		fileExtension: ".toml",
	},
	skills: {
		projectPath: ".agents/skills",
		globalPath: join(home, ".agents/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: "GEMINI.md",
		globalPath: join(home, ".gemini/GEMINI.md"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
	},
	rules: {
		projectPath: "GEMINI.md",
		globalPath: join(home, ".gemini/GEMINI.md"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
	},
	hooks: {
		projectPath: ".gemini/hooks",
		globalPath: join(home, ".gemini/hooks"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: "",
	},
	settingsJsonPath: {
		projectPath: ".gemini/settings.json",
		globalPath: join(home, ".gemini/settings.json"),
	},
	detect: async () =>
		hasBinaryInPath("gemini") ||
		hasAnyInstallSignal([
			join(cwd, ".gemini/commands"),
			join(cwd, "GEMINI.md"),
			join(home, ".gemini/commands"),
			join(home, ".gemini/GEMINI.md"),
		]),
};
