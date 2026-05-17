import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const gooseConfig: ProviderConfig = {
	name: "goose",
	displayName: "Goose",
	supportLevel: "experimental",
	supportReason: "Goose customization is extension-driven; this adapter only covers a subset of native surfaces.",
	subagents: "full",
	agents: {
		projectPath: "AGENTS.md",
		globalPath: null,
		format: "fm-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
	},
	commands: null,
	skills: {
		projectPath: ".goose/skills",
		globalPath: join(home, ".config/goose/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: ".goosehints",
		globalPath: join(home, ".config/goose/.goosehints"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: "",
	},
	rules: {
		projectPath: ".goosehints",
		globalPath: join(home, ".config/goose/.goosehints"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: "",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasBinaryInPath("goose") ||
		hasAnyInstallSignal([
			join(cwd, ".goosehints"),
			join(cwd, ".goose/skills"),
			join(home, ".config/goose/.goosehints"),
			join(home, ".config/goose/skills"),
		]),
};
