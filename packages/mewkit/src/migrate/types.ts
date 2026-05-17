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

// ProviderConfig + path/format/strategy types moved into per-provider module
// at `./providers/provider-config-types.ts`. Re-exported here so legacy import
// paths (`./types.js`) continue to resolve unchanged.
export type {
	ConversionFormat,
	WriteStrategy,
	ProviderPathConfig,
	SubagentSupport,
	ProviderSupportLevel,
	ProviderConfig,
} from "./providers/provider-config-types.js";

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
	sourceVersion: z.string().optional(),
});
export type MigrateOptions = z.infer<typeof MigrateOptionsSchema>;
