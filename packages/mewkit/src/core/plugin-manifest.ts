// Pure builders + schemas for the generated plugin manifests.
//
// Two runtimes, two manifest shapes — both verified against the live CLIs
// (`claude plugin init` and the Codex `plugin-creator` scaffold):
//   - Claude Code: `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`
//   - Codex:       `.codex-plugin/plugin.json`  + `.agents/plugins/marketplace.json`
// The version is the SINGLE source of truth (root package version at release),
// staged into the release commit so the manifest version never lags the release.
import { z } from "zod";

/** Plugin identity shared by every manifest. */
export const PLUGIN_NAME = "mk";

export interface PluginIdentity {
	/** Plugin name; defaults to `mk`. The runtime prefixes agents/skills with it. */
	name?: string;
	/** Release version (root package.json version at release time). */
	version: string;
	description: string;
	author?: { name: string; email?: string };
}

// ---------------------------------------------------------------------------
// Claude Code
// ---------------------------------------------------------------------------

export const ClaudePluginJsonSchema = z.object({
	$schema: z.string().optional(),
	name: z.string(),
	version: z.string(),
	description: z.string(),
	author: z.object({ name: z.string(), email: z.string().optional() }).optional(),
	skills: z.array(z.string()),
});
export type ClaudePluginJson = z.infer<typeof ClaudePluginJsonSchema>;

export function buildClaudePluginJson(id: PluginIdentity): ClaudePluginJson {
	return {
		$schema: "https://anthropic.com/claude-code/plugin.schema.json",
		name: id.name ?? PLUGIN_NAME,
		version: id.version,
		description: id.description,
		...(id.author ? { author: id.author } : {}),
		// Plugin root holds the transformed `.claude` payload; skills auto-discover
		// from the `skills/` subtree, agents from `agents/`.
		skills: ["./skills"],
	};
}

export interface ClaudeMarketplaceOptions extends PluginIdentity {
	marketplaceName: string;
	owner: { name: string; email?: string; url?: string };
	/** Plugin source path relative to the marketplace root (e.g. `./` or `./mk`). */
	source: string;
}

export const ClaudeMarketplaceJsonSchema = z.object({
	$schema: z.string().optional(),
	name: z.string(),
	owner: z.object({ name: z.string() }).passthrough(),
	plugins: z
		.array(
			z.object({
				name: z.string(),
				source: z.string(),
				description: z.string().optional(),
			}),
		)
		.min(1),
});
export type ClaudeMarketplaceJson = z.infer<typeof ClaudeMarketplaceJsonSchema>;

export function buildClaudeMarketplaceJson(opts: ClaudeMarketplaceOptions): ClaudeMarketplaceJson {
	return {
		$schema: "https://anthropic.com/claude-code/marketplace.schema.json",
		name: opts.marketplaceName,
		owner: opts.owner,
		plugins: [{ name: opts.name ?? PLUGIN_NAME, source: opts.source, description: opts.description }],
	};
}

// ---------------------------------------------------------------------------
// Codex
// ---------------------------------------------------------------------------

export const CodexPluginJsonSchema = z.object({
	name: z.string(),
	version: z.string(),
	description: z.string(),
	author: z.object({ name: z.string() }).passthrough().optional(),
	// Codex `skills` is a STRING path (not an array, unlike Claude).
	skills: z.string(),
	interface: z
		.object({
			displayName: z.string(),
			shortDescription: z.string(),
			longDescription: z.string(),
			developerName: z.string(),
			category: z.string(),
			capabilities: z.array(z.string()),
			defaultPrompt: z.string(),
		})
		.passthrough(),
});
export type CodexPluginJson = z.infer<typeof CodexPluginJsonSchema>;

export interface CodexPluginOptions extends PluginIdentity {
	displayName?: string;
	category?: string;
}

export function buildCodexPluginJson(opts: CodexPluginOptions): CodexPluginJson {
	const name = opts.name ?? PLUGIN_NAME;
	const display = opts.displayName ?? "MeowKit";
	return {
		name,
		version: opts.version,
		description: opts.description,
		...(opts.author ? { author: { name: opts.author.name } } : {}),
		skills: "./skills/",
		interface: {
			displayName: display,
			shortDescription: `Use ${display} in Codex.`,
			longDescription: opts.description,
			developerName: opts.author?.name ?? "MeowKit",
			category: opts.category ?? "Productivity",
			capabilities: [],
			defaultPrompt: `Help me use ${display}.`,
		},
	};
}

export const CodexMarketplaceJsonSchema = z.object({
	name: z.string(),
	interface: z.object({ displayName: z.string() }).passthrough(),
	plugins: z
		.array(
			z.object({
				name: z.string(),
				source: z.object({ source: z.string(), path: z.string().optional() }).passthrough(),
				policy: z.record(z.string()).optional(),
				category: z.string().optional(),
			}),
		)
		.min(1),
});
export type CodexMarketplaceJson = z.infer<typeof CodexMarketplaceJsonSchema>;

export interface CodexMarketplaceOptions {
	name?: string;
	marketplaceName: string;
	marketplaceDisplayName?: string;
	/** Plugin source path relative to the marketplace/repo root. */
	sourcePath: string;
	category?: string;
}

export function buildCodexMarketplaceJson(opts: CodexMarketplaceOptions): CodexMarketplaceJson {
	return {
		name: opts.marketplaceName,
		interface: { displayName: opts.marketplaceDisplayName ?? opts.marketplaceName },
		plugins: [
			{
				name: opts.name ?? PLUGIN_NAME,
				source: { source: "local", path: opts.sourcePath },
				policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
				category: opts.category ?? "Productivity",
			},
		],
	};
}
