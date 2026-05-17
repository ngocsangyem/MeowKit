import { join } from "node:path";
import type { ProviderConfig } from "../provider-config-types.js";
import { cwd, hasAnyInstallSignal } from "../detection-helpers.js";

// Kiro paths intentionally start aligned with documented locations.
// The overrides callback (see ./overrides.ts) re-points global paths to the
// `.kiro/agents` and `.kiro/steering` directories the Kiro docs prescribe.
export const kiroConfig: ProviderConfig = {
	name: "kiro",
	displayName: "Kiro IDE",
	supportLevel: "verified",
	subagents: "none",
	agents: {
		projectPath: ".kiro/steering",
		globalPath: null,
		format: "md-to-kiro-steering",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	commands: null,
	skills: {
		projectPath: ".kiro/skills",
		globalPath: null,
		format: "direct-copy",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	config: {
		projectPath: ".kiro/steering/project.md",
		globalPath: null,
		format: "md-to-kiro-steering",
		writeStrategy: "single-file",
		fileExtension: ".md",
	},
	rules: {
		projectPath: ".kiro/steering",
		globalPath: null,
		format: "md-to-kiro-steering",
		writeStrategy: "per-file",
		fileExtension: ".md",
	},
	hooks: null,
	settingsJsonPath: null,
	detect: async () =>
		hasAnyInstallSignal([
			join(cwd, ".kiro/steering"),
			join(cwd, ".kiro/skills"),
			join(cwd, ".kiro/hooks"),
			join(cwd, ".kiro/agents"),
			join(cwd, ".kiro/settings/mcp.json"),
		]),
};
