// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/claude-to-codex-hooks.ts
// Pure transform: Claude Code hooks → Codex-compatible hooks. Drops unsupported events,
// filters matchers, scrubs permissionDecision, rewrites command paths.
import { homedir } from "node:os";
import type { CodexCapabilities } from "../codex-capabilities.js";

export interface HookEntry {
	type: string;
	command: string;
	timeout?: number;
	permissionDecision?: string;
	decision?: string;
	additionalContext?: string;
	[key: string]: unknown;
}

export interface HookGroup {
	matcher?: string;
	hooks: HookEntry[];
}

export type HooksSection = Record<string, HookGroup[]>;

export interface PathRewriteMap {
	sourceDir: string;
	targetDir: string;
	commandSubstitutions?: Map<string, string>;
}

export function convertClaudeHooksToCodex(
	sourceHooks: HooksSection,
	capabilities: CodexCapabilities,
	pathRewrite?: PathRewriteMap,
): HooksSection {
	const result: HooksSection = {};

	for (const [event, groups] of Object.entries(sourceHooks)) {
		const eventCaps = capabilities.events[event];
		if (!eventCaps?.supported) continue;

		const filteredGroups = filterGroupsByMatcher(groups, event, capabilities);

		const scrubbedGroups = filteredGroups.map((group) => ({
			...group,
			hooks: group.hooks.map((entry) => scrubHookEntry(entry, event, capabilities, pathRewrite)),
		}));

		const nonEmptyGroups = scrubbedGroups.filter((g) => g.hooks.length > 0);
		if (nonEmptyGroups.length > 0) result[event] = nonEmptyGroups;
	}

	return result;
}

function filterGroupsByMatcher(
	groups: HookGroup[],
	event: string,
	capabilities: CodexCapabilities,
): HookGroup[] {
	const eventCaps = capabilities.events[event];
	if (!eventCaps) return [];

	const allowedMatchers = eventCaps.allowedMatchers;
	if (!allowedMatchers) return groups;

	const allowedSet = new Set(allowedMatchers);

	return groups.filter((group) => {
		if (!group.matcher) return true;
		const parts = group.matcher.split("|").map((p) => p.trim());
		return parts.some((part) => allowedSet.has(part));
	});
}

function scrubHookEntry(
	entry: HookEntry,
	event: string,
	capabilities: CodexCapabilities,
	pathRewrite?: PathRewriteMap,
): HookEntry {
	const { additionalContext: _stripped, ...rest } = entry;
	void _stripped;
	const scrubbed: HookEntry = { ...rest };

	if (pathRewrite) scrubbed.command = rewriteCommandPath(scrubbed.command, pathRewrite);

	const eventCaps = capabilities.events[event];
	if (eventCaps?.permissionDecisionValues) {
		const allowed = new Set(eventCaps.permissionDecisionValues);
		if (scrubbed.permissionDecision && !allowed.has(scrubbed.permissionDecision)) {
			scrubbed.permissionDecision = undefined;
		}
		if (scrubbed.decision && !allowed.has(scrubbed.decision)) scrubbed.decision = undefined;
	}

	return scrubbed;
}

export function rewriteCommandPath(command: string, pathRewrite: PathRewriteMap): string {
	if (pathRewrite.commandSubstitutions && pathRewrite.commandSubstitutions.size > 0) {
		const home = homedir();

		for (const [originalAbsPath, wrapperAbsPath] of pathRewrite.commandSubstitutions) {
			const candidates = new Set<string>([
				originalAbsPath,
				originalAbsPath.replace(home, "$HOME"),
				originalAbsPath.replace(home, "~"),
			]);

			for (const candidate of candidates) {
				if (command.includes(candidate)) {
					return command.replaceAll(candidate, wrapperAbsPath);
				}
			}
		}
	}

	const src = pathRewrite.sourceDir.endsWith("/")
		? pathRewrite.sourceDir
		: `${pathRewrite.sourceDir}/`;
	const tgt = pathRewrite.targetDir.endsWith("/")
		? pathRewrite.targetDir
		: `${pathRewrite.targetDir}/`;
	if (src === tgt) return command;
	return command.replaceAll(src, tgt);
}
