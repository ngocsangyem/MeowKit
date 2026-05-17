import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { cwd, home, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const ampConfig: ProviderConfig = {
	name: "amp",
	displayName: "Amp",
	supportLevel: "experimental",
	supportReason:
		"Amp supports AGENTS.md natively, but this adapter still relies on shared skills conventions for part of the export.",
	subagents: "full",
	agents: {
		projectPath: "AGENT.md",
		globalPath: join(home, ".config/AGENT.md"),
		format: "fm-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
	},
	commands: null,
	skills: {
		projectPath: ".agents/skills",
		globalPath: join(home, ".config/agents/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: "AGENT.md",
		globalPath: join(home, ".config/AGENT.md"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".amp/rules",
		globalPath: join(home, ".config/amp/rules"),
		format: "md-strip",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasBinaryInPath("amp") ||
		hasAnyInstallSignal([
			join(cwd, ".amp/rules"),
			join(cwd, "AGENT.md"),
			join(home, ".config/amp/rules"),
			join(home, ".config/AGENT.md"),
		]),
};
