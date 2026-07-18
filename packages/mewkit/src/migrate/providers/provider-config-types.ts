// Canonical ProviderConfig + sub-interfaces. `../types.ts` re-exports these
// names so legacy import paths continue to work.

import type { ProviderType } from "../types.js";

/** Conversion format used to transform source files */
export type ConversionFormat =
	| "direct-copy"
	| "fm-to-fm"
	| "fm-to-yaml"
	| "fm-strip"
	| "fm-to-json"
	| "md-to-toml"
	| "skill-md"
	| "md-strip"
	| "md-to-mdc"
	| "md-to-kiro-steering"
	| "fm-to-codex-toml"
	| "command-to-codex-skill";

/** Write strategy for target files */
export type WriteStrategy =
	"per-file" | "merge-single" | "json-merge" | "yaml-merge" | "single-file" | "codex-toml" | "codex-hooks";

/** Provider path configuration for a specific portable type */
export interface ProviderPathConfig {
	projectPath: string | null;
	globalPath: string | null;
	format: ConversionFormat;
	writeStrategy: WriteStrategy;
	fileExtension: string;
	charLimit?: number;
	totalCharLimit?: number;
	nestedCommands?: boolean;
}

/** Provider's level of subagent/delegation support */
export type SubagentSupport = "full" | "partial" | "none" | "planned";
export type ProviderSupportLevel = "verified" | "experimental" | "deprecated";

/** Full provider configuration */
export interface ProviderConfig {
	name: ProviderType;
	displayName: string;
	supportLevel?: ProviderSupportLevel;
	supportReason?: string;
	subagents: SubagentSupport;
	agents: ProviderPathConfig | null;
	commands: ProviderPathConfig | null;
	skills: ProviderPathConfig | null;
	config: ProviderPathConfig | null;
	rules: ProviderPathConfig | null;
	hooks: ProviderPathConfig | null;
	settingsJsonPath: { projectPath: string; globalPath: string } | null;
	detect: () => Promise<boolean>;
	/** Optional patterns to exclude from discovery (mewkit-internal extension) */
	excludePatterns?: string[];
	/** Optional unverified marker — mewkit prints a runtime warning when set */
	_unverified?: boolean;
}
