// Discovery wrapper for orchestrator: walks .claude/ for all enabled types.

import {
	discoverAgents,
	discoverCommands,
	discoverConfig,
	discoverHooks,
	discoverRules,
	discoverSkills,
	resolveSourcePaths,
	type SourcePaths,
} from "./discovery/index.js";
import type { MigrationScope } from "./migrate-scope-resolver.js";
import type { PortableItem, PortableType, SkillInfo } from "./types.js";

export interface DiscoveredItems {
	agents: PortableItem[];
	commands: PortableItem[];
	skills: SkillInfo[];
	config: PortableItem | null;
	rules: PortableItem[];
	hooks: PortableItem[];
	skippedShellHooks: string[];
	source: SourcePaths;
}

/**
 * Resolve source paths and walk every enabled type.
 * Returns empty arrays for types disabled by the resolved scope.
 */
export async function discoverAll(
	scope: MigrationScope,
	options: { source?: string; bundledKitDir: string },
): Promise<DiscoveredItems> {
	const source = resolveSourcePaths(options.source, options.bundledKitDir);

	const agents = scope.agents ? await discoverAgents(source.agents) : [];
	const commands = scope.commands ? await discoverCommands(source.commands) : [];
	const skills = scope.skills ? await discoverSkills(source.skills) : [];
	const config = scope.config ? await discoverConfig(source.configFile) : null;
	const rules = scope.rules ? await discoverRules(source.rules) : [];
	const hookResult = scope.hooks
		? await discoverHooks(source.hooks)
		: { items: [], skippedShellHooks: [] };

	return {
		agents,
		commands,
		skills,
		config,
		rules,
		hooks: hookResult.items,
		skippedShellHooks: hookResult.skippedShellHooks,
		source,
	};
}

/**
 * Flatten discovered items into a single PortableItem array (for source-state building).
 * Skill directories are NOT included — they go through installSkillDirectory directly.
 */
export function flattenForReconcile(d: DiscoveredItems): PortableItem[] {
	const items: PortableItem[] = [];
	items.push(...d.agents);
	items.push(...d.commands);
	items.push(...d.rules);
	items.push(...d.hooks);
	if (d.config) items.push(d.config);
	return items;
}

export function itemsByType(d: DiscoveredItems): Record<PortableType, PortableItem[]> {
	return {
		agent: d.agents,
		command: d.commands,
		skill: [],
		config: d.config ? [d.config] : [],
		rules: d.rules,
		hooks: d.hooks,
	};
}
