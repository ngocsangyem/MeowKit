import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { cwd, home, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const codexConfig: ProviderConfig = {
	name: "codex",
	displayName: "Codex",
	supportLevel: "experimental",
	supportReason:
		"Public runtime docs do not yet fully document every filesystem surface used by this adapter.",
	subagents: "full",
	agents: {
		projectPath: ".codex/agents",
		globalPath: join(home, ".codex/agents"),
		format: "fm-to-codex-toml",
		writeStrategy: "codex-toml",
		fileExtension: ".toml",
	},
	// Codex has documented built-in slash/app commands, but the current public docs do
	// not document a custom command directory. Do not emit unverified .codex/prompts files.
	commands: null,
	skills: {
		projectPath: ".agents/skills",
		globalPath: join(home, ".agents/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: "AGENTS.md",
		globalPath: join(home, ".codex/AGENTS.md"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".codex/rules",
		globalPath: join(home, ".codex/rules"),
		format: "md-to-codex-rules",
		writeStrategy: "per-file",
		fileExtension: ".rules",
	},
	hooks: {
		projectPath: ".codex/hooks",
		globalPath: join(home, ".codex/hooks"),
		format: "direct-copy",
		writeStrategy: "codex-hooks",
		fileExtension: "",
	},
	settingsJsonPath: {
		projectPath: ".codex/hooks.json",
		globalPath: join(home, ".codex/hooks.json"),
	},
	detect: async () =>
		hasBinaryInPath("codex") ||
		hasAnyInstallSignal([
			join(cwd, ".codex/config.toml"),
			join(cwd, ".codex/agents"),
			join(cwd, ".codex/rules"),
			join(cwd, ".codex/hooks.json"),
			join(home, ".codex/config.toml"),
			join(home, ".codex/agents"),
			join(home, ".codex/AGENTS.md"),
			join(home, ".codex/rules"),
			join(home, ".codex/instructions.md"),
			join(home, ".codex/hooks.json"),
		]),
};
