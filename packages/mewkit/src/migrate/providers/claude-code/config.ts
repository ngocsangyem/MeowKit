import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { home, cwd, hasAnyInstallSignal, hasBinaryInPath } from "../detection-helpers.js";

export const claudeCodeConfig: ProviderConfig = {
	name: "claude-code",
	displayName: "Claude Code",
	subagents: "full",
	agents: {
		projectPath: ".claude/agents",
		globalPath: join(home, ".claude/agents"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	commands: {
		projectPath: ".claude/commands",
		globalPath: join(home, ".claude/commands"),
		format: "direct-copy",
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
		projectPath: "CLAUDE.md",
		globalPath: join(home, ".claude/CLAUDE.md"),
		format: "direct-copy",
		writeStrategy: "single-file",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".claude/rules",
		globalPath: join(home, ".claude/rules"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	hooks: {
		projectPath: ".claude/hooks",
		globalPath: join(home, ".claude/hooks"),
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: "",
	},
	settingsJsonPath: { projectPath: ".claude/settings.json", globalPath: join(home, ".claude/settings.json") },
	detect: async () =>
		hasBinaryInPath("claude") ||
		hasAnyInstallSignal([
			join(cwd, ".claude/agents"),
			join(cwd, ".claude/commands"),
			join(cwd, ".claude/skills"),
			join(cwd, ".claude/rules"),
			join(cwd, ".claude/hooks"),
			join(cwd, "CLAUDE.md"),
			join(home, ".claude/agents"),
			join(home, ".claude/commands"),
			join(home, ".claude/skills"),
			join(home, ".claude/rules"),
			join(home, ".claude/hooks"),
			join(home, ".claude/CLAUDE.md"),
		]),
};
