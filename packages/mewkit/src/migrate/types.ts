// Vendored from claudekit-cli (MIT). Source: src/commands/portable/types.ts
// Shared types for portable items (agents, commands, skills, config, rules, hooks).
import { z } from "zod";

/** Type of portable item */
export type PortableType = "agent" | "command" | "skill" | "config" | "rules" | "hooks";

/** Supported coding agent/provider identifiers */
export const ProviderType = z.enum([
	"claude-code",
	"cursor",
	"codex",
	"droid",
	"opencode",
	"goose",
	"gemini-cli",
	"antigravity",
	"github-copilot",
	"amp",
	"kilo",
	"kiro",
	"roo",
	"windsurf",
	"cline",
	"openhands",
]);
export type ProviderType = z.infer<typeof ProviderType>;

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
	| "fm-to-codex-toml";

/** Write strategy for target files */
export type WriteStrategy =
	| "per-file"
	| "merge-single"
	| "json-merge"
	| "yaml-merge"
	| "single-file"
	| "codex-toml"
	| "codex-hooks";

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

/** Full provider configuration */
export interface ProviderConfig {
	name: ProviderType;
	displayName: string;
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

/** Parsed frontmatter data from a source file */
export interface ParsedFrontmatter {
	name?: string;
	description?: string;
	model?: string;
	tools?: string;
	memory?: string;
	argumentHint?: string;
	[key: string]: unknown;
}

/** Result of frontmatter parsing */
export interface FrontmatterParseResult {
	frontmatter: ParsedFrontmatter;
	body: string;
	warnings: string[];
}

/** A portable item (agent, command, config, rule, hook) discovered from source */
export interface PortableItem {
	name: string;
	displayName?: string;
	description: string;
	type: PortableType;
	sourcePath: string;
	frontmatter: ParsedFrontmatter;
	body: string;
	/** For nested commands: relative path segments (e.g., ["docs", "init"]) */
	segments?: string[];
}

/** Result of converting a portable item for a target provider */
export interface ConversionResult {
	content: string;
	filename: string;
	warnings: string[];
	error?: string;
}

/** Result of installing a portable item to a provider */
export interface PortableInstallResult {
	provider: ProviderType;
	providerDisplayName: string;
	success: boolean;
	path: string;
	operation?: "apply" | "delete";
	error?: string;
	overwritten?: boolean;
	skipped?: boolean;
	skipReason?: string;
	warnings?: string[];
	portableType?: PortableType;
	itemName?: string;
	collidingProviders?: ProviderType[];
}

/** Skill metadata for directory-based skill items */
export interface SkillInfo {
	/** Canonical skill id derived from frontmatter (e.g., "mk:cook"). Required. */
	id: string;
	/** Sanitized canonical name (colon-free) — e.g., "cook" or legacy "meow-cook" */
	name: string;
	/** Original directory name (post-rename: bare "cook"; pre-rename: "mk:cook") */
	dirName: string;
	/** Display name from frontmatter `name:` field */
	displayName?: string;
	description: string;
	version?: string;
	author?: string;
	license?: string;
	/** Full path to skill directory */
	sourcePath: string;
}

/** Command options schema for migrate */
export const MigrateOptionsSchema = z.object({
	tool: z.string().optional(),
	/** Preset list of provider names (used by init --migrate-to). Skips the interactive picker. */
	tools: z.array(z.string()).optional(),
	all: z.boolean().optional(),
	global: z.boolean().optional(),
	yes: z.boolean().optional(),
	dryRun: z.boolean().optional(),
	force: z.boolean().optional(),
	source: z.string().optional(),
	only: z.string().optional(),
	skipConfig: z.boolean().optional(),
	skipRules: z.boolean().optional(),
	skipHooks: z.boolean().optional(),
	install: z.boolean().optional(),
	reconcile: z.boolean().optional(),
	reinstallEmptyDirs: z.boolean().optional(),
	respectDeletions: z.boolean().optional(),
	preferAgentsMd: z.boolean().optional(),
	sourceVersion: z.string().optional(),
});
export type MigrateOptions = z.infer<typeof MigrateOptionsSchema>;
