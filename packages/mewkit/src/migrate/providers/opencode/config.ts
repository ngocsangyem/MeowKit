import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal, hasBinaryInPath, OPENCODE_BINARY_NAME } from "../detection-helpers.js";

function hasOpenCodeInstallSignal(): boolean {
	return (
		hasBinaryInPath("opencode") ||
		hasAnyInstallSignal([
			join(cwd, "opencode.json"),
			join(cwd, "opencode.jsonc"),
			join(cwd, ".opencode/agents"),
			join(cwd, ".opencode/commands"),
			join(home, ".config/opencode/AGENTS.md"),
			join(home, ".config/opencode/agents"),
			join(home, ".config/opencode/commands"),
			join(home, ".opencode/bin", OPENCODE_BINARY_NAME),
		])
	);
}

export const opencodeConfig: ProviderConfig = {
	name: "opencode",
	displayName: "OpenCode",
	subagents: "full",
	agents: {
		projectPath: ".opencode/agents",
		globalPath: join(home, ".config/opencode/agents"),
		format: "fm-to-fm",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	commands: {
		projectPath: ".opencode/commands",
		globalPath: join(home, ".config/opencode/commands"),
		format: "fm-to-fm",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	skills: {
		projectPath: ".claude/skills",
		globalPath: join(home, ".claude/skills"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: "AGENTS.md",
		globalPath: join(home, ".config/opencode/AGENTS.md"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
	},
	rules: {
		projectPath: "AGENTS.md",
		globalPath: join(home, ".config/opencode/AGENTS.md"),
		format: "md-strip",
		writeStrategy: "merge-single",
		fileExtension: ".md",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () => hasOpenCodeInstallSignal(),
};
