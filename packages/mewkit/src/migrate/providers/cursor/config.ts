import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const cursorConfig: ProviderConfig = {
	name: "cursor",
	displayName: "Cursor",
	// Legacy .claude→.cursor converter. It projects delegation into rules
	// (.cursor/rules/*.mdc), not native custom agents (.cursor/agents/*.md), and
	// emits no hooks — so it is an honest "experimental" export, not a verified
	// native harness. The authored native Cursor bundle (native agents/hooks/skills)
	// lands in later phases; this label lifts to reflect it only once that ships.
	supportLevel: "experimental",
	supportReason:
		"Legacy exporter converts .claude/ to Cursor rules; native agents/hooks are authored in the native bundle, not yet installed here.",
	// Converter emits rules-as-agents (delegation preserved in .mdc rules), not the
	// native .cursor/agents/*.md custom-agent contract — partial, not full.
	subagents: "partial",
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
	// Converter emits no hooks. Cursor DOES support native hooks via
	// .cursor/hooks.json (version: 1, failClosed) — that is the authored-bundle
	// target for a later phase, not something this legacy converter installs.
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasBinaryInPath("cursor") ||
		hasAnyInstallSignal([join(cwd, ".cursor/rules"), join(home, ".cursor/rules"), join(home, ".cursor/skills")]),
};
