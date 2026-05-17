import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const cursorConfig: ProviderConfig = {
	name: "cursor",
	displayName: "Cursor",
	supportLevel: "verified",
	subagents: "full",
	agents: {
		projectPath: ".cursor/rules",
		globalPath: join(home, ".cursor/rules"),
		format: "fm-to-fm",
		writeStrategy: "per-file",
		fileExtension: ".mdc",
	},
	commands: null,
	skills: {
		projectPath: ".agents/skills",
		globalPath: join(home, ".cursor/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: ".cursor/rules/project-config.mdc",
		globalPath: join(home, ".cursor/rules/project-config.mdc"),
		format: "md-to-mdc",
		writeStrategy: "single-file",
		fileExtension: ".mdc",
	},
	rules: {
		projectPath: ".cursor/rules",
		globalPath: join(home, ".cursor/rules"),
		format: "md-to-mdc",
		writeStrategy: "per-file",
		fileExtension: ".mdc",
	},
	hooks: null,
	settingsJsonPath: null,
	// Cursor v2.2+ moves toward .cursor/rules/<name>/RULE.md folder format. Per-file .mdc still works as of 2026-04. Track via drift detection.
	detect: async () =>
		hasBinaryInPath("cursor") ||
		hasAnyInstallSignal([join(cwd, ".cursor/rules"), join(home, ".cursor/rules"), join(home, ".cursor/skills")]),
};
