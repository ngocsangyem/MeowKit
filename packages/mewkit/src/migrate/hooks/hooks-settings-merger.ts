// Adapted from claudekit-cli (MIT). Source: src/commands/portable/hooks-settings-merger.ts
// Patches each provider's settings.json to register migrated hooks. Snapshots existing
// settings.json before write so failures roll back cleanly (Red Team Finding 12).

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { providers } from "../provider-registry.js";
import type { PortableItem, ProviderType } from "../types.js";
import type { MigrationDecisionRecord } from "../validation/migration-record-types.js";

// Neutral marker: generated files must not carry toolkit branding.
const SENTINEL_KEY = "__managed_by_migration__";
const LEGACY_SENTINEL_KEY = "__mewkit_managed__";

/** One hook command entry, as stored in a settings.json `hooks` block. */
export interface HookEntry {
	type: string;
	command: string;
	timeout?: number;
	permissionDecision?: string;
	decision?: string;
	additionalContext?: string;
	[key: string]: unknown;
}

/** A matcher-scoped group of hook entries for one event. */
export interface HookGroup {
	matcher?: string;
	hooks: HookEntry[];
}

/** Full `hooks` block of a settings.json, keyed by event name. */
export type HooksSection = Record<string, HookGroup[]>;

export interface HooksMergeResult {
	provider: ProviderType;
	success: boolean;
	settingsPath?: string;
	hooksWritten: number;
	hooksDropped: number;
	error?: string;
	warnings: string[];
	/** Structured per-hook decisions for the Phase 6 run report (codex only today). */
	records?: MigrationDecisionRecord[];
}

interface HooksMergeOptions {
	global: boolean;
	sourceSettingsPath?: string;
}

interface SettingsSnapshot {
	path: string;
	existed: boolean;
	content: string | null;
}

async function snapshotSettings(path: string): Promise<SettingsSnapshot> {
	if (!existsSync(path)) return { path, existed: false, content: null };
	const content = await readFile(path, "utf-8");
	return { path, existed: true, content };
}

async function restoreSettings(snap: SettingsSnapshot): Promise<void> {
	if (snap.existed && snap.content !== null) {
		await writeFile(snap.path, snap.content, "utf-8");
	} else if (existsSync(snap.path)) {
		try {
			await unlink(snap.path);
		} catch {
			/* ignore */
		}
	}
}

async function atomicWrite(target: string, content: string): Promise<void> {
	const dir = dirname(target);
	if (!existsSync(dir)) await mkdir(dir, { recursive: true });
	const tmp = `${target}.mewkit-tmp-${process.pid}`;
	try {
		await writeFile(tmp, content, "utf-8");
		await rename(tmp, target);
	} catch (err) {
		try {
			await unlink(tmp);
		} catch {
			/* best-effort */
		}
		throw err;
	}
}

/**
 * Build a HooksSection where each migrated hook is registered as a single entry
 * keyed by hook event name. Source items represent the .cjs scripts already
 * installed at their target paths.
 */
function buildClaudeHooksSection(hooks: PortableItem[], hookTargetPaths: Map<string, string>): HooksSection {
	const section: HooksSection = {};
	for (const hook of hooks) {
		const event = inferEventFromName(hook.name);
		const targetPath = hookTargetPaths.get(hook.name) ?? hook.sourcePath;
		const group: HookGroup = {
			hooks: [
				{
					type: "command",
					command: `node ${targetPath}`,
				},
			],
		};
		const list = section[event] ?? [];
		list.push(group);
		section[event] = list;
	}
	return section;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteHookCommand(command: string, hook: PortableItem, hookTargetPaths: Map<string, string>): string {
	const targetPath = hookTargetPaths.get(hook.name) ?? hook.sourcePath;
	const sourcePath = hook.sourcePath;
	const relPath = `.claude/hooks/${hook.name}`;

	// Apply the MOST-SPECIFIC matching form ONCE and return immediately. Chaining
	// replaceAll calls doubled the root: once an early rule expands a relative form
	// to an absolute targetPath, a later rule re-matched the relative fragment now
	// embedded inside that absolute path and substituted a second absolute path
	// (produced `<root>/<root>/.claude/hooks/x.sh`). Ordered single-shot avoids it.
	if (sourcePath !== targetPath && command.includes(sourcePath)) {
		return command.replaceAll(sourcePath, targetPath);
	}
	const projectRelForm = `$CLAUDE_PROJECT_DIR/${relPath}`;
	if (command.includes(projectRelForm)) {
		return command.replaceAll(projectRelForm, targetPath);
	}
	if (command.includes(relPath)) {
		return command.replaceAll(relPath, targetPath);
	}
	if (command.includes(hook.name)) {
		return command.replace(new RegExp(escapeRegExp(hook.name), "g"), targetPath);
	}
	return command;
}

async function buildHooksSectionFromSettings(
	settingsPath: string | undefined,
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
): Promise<HooksSection | null> {
	if (!settingsPath || !existsSync(settingsPath)) return null;
	const settings = await readSettings(settingsPath);
	const rawHooks = settings.hooks;
	if (!rawHooks || typeof rawHooks !== "object" || Array.isArray(rawHooks)) return null;

	const migratedHookNames = hooks.map((hook) => hook.name).sort((a, b) => b.length - a.length);
	const migratedByName = new Map(hooks.map((hook) => [hook.name, hook]));
	const section: HooksSection = {};

	for (const [event, rawGroups] of Object.entries(rawHooks as Record<string, unknown>)) {
		if (!Array.isArray(rawGroups)) continue;
		const groups: HookGroup[] = [];

		for (const rawGroup of rawGroups) {
			if (!rawGroup || typeof rawGroup !== "object" || Array.isArray(rawGroup)) continue;
			const group = rawGroup as Record<string, unknown>;
			const rawEntries = group.hooks;
			if (!Array.isArray(rawEntries)) continue;

			const entries: HookEntry[] = [];
			for (const rawEntry of rawEntries) {
				if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) continue;
				const entry = rawEntry as HookEntry;
				if (typeof entry.command !== "string") continue;

				const matchedName = migratedHookNames.find((name) => entry.command.includes(name));
				if (!matchedName) continue;
				const hook = migratedByName.get(matchedName);
				if (!hook) continue;

				entries.push({
					...entry,
					command: rewriteHookCommand(entry.command, hook, hookTargetPaths),
				});
			}

			if (entries.length > 0) {
				const matcher = typeof group.matcher === "string" ? group.matcher : undefined;
				groups.push(matcher === undefined ? { hooks: entries } : { matcher, hooks: entries });
			}
		}

		if (groups.length > 0) section[event] = groups;
	}

	return Object.keys(section).length > 0 ? section : null;
}

/**
 * Heuristic: derive hook event from hook script filename. mewkit conventions use
 * names like `pretooluse-foo.cjs` or `session-init.cjs`. Falls back to UserPromptSubmit.
 */
function inferEventFromName(name: string): string {
	const lower = name.toLowerCase();
	if (lower.includes("pretooluse") || lower.includes("pre-tool")) return "PreToolUse";
	if (lower.includes("posttooluse") || lower.includes("post-tool")) return "PostToolUse";
	if (lower.includes("sessionstart") || lower.includes("session-start") || lower.includes("session-init"))
		return "SessionStart";
	if (lower.includes("stop")) return "Stop";
	if (lower.includes("notification")) return "Notification";
	if (lower.includes("userpromptsubmit") || lower.includes("user-prompt")) return "UserPromptSubmit";
	if (lower.includes("subagentstart")) return "SubagentStart";
	if (lower.includes("subagentstop")) return "SubagentStop";
	if (lower.includes("precompact") || lower.includes("pre-compact")) return "PreCompact";
	return "UserPromptSubmit";
}

async function readSettings(path: string): Promise<Record<string, unknown>> {
	if (!existsSync(path)) return {};
	try {
		const content = await readFile(path, "utf-8");
		const parsed = JSON.parse(content) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// Will be overwritten if unparseable
	}
	return {};
}

async function mergeIntoSettingsJson(settingsPath: string, section: HooksSection): Promise<void> {
	const settings = await readSettings(settingsPath);
	settings.hooks = section;
	settings[SENTINEL_KEY] = { hooks: true };
	delete settings[LEGACY_SENTINEL_KEY];
	await atomicWrite(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

async function mergeClaudeCode(
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
	options: HooksMergeOptions,
): Promise<HooksMergeResult> {
	const settingsCfg = providers["claude-code"].settingsJsonPath;
	if (!settingsCfg) return badResult("claude-code");
	const settingsPath = options.global ? settingsCfg.globalPath : settingsCfg.projectPath;

	const snapshot = await snapshotSettings(settingsPath);
	try {
		const section =
			(await buildHooksSectionFromSettings(options.sourceSettingsPath, hooks, hookTargetPaths)) ??
			buildClaudeHooksSection(hooks, hookTargetPaths);
		await mergeIntoSettingsJson(settingsPath, section);
		return {
			provider: "claude-code",
			success: true,
			settingsPath,
			hooksWritten: hooks.length,
			hooksDropped: 0,
			warnings: [],
		};
	} catch (err) {
		await restoreSettings(snapshot);
		return errResult("claude-code", err, hooks.length);
	}
}

function badResult(provider: ProviderType): HooksMergeResult {
	return {
		provider,
		success: false,
		hooksWritten: 0,
		hooksDropped: 0,
		warnings: [],
		error: `${provider} hook merge not configured`,
	};
}

function errResult(
	provider: ProviderType,
	err: unknown,
	hooksCount: number,
	warnings: string[] = [],
): HooksMergeResult {
	return {
		provider,
		success: false,
		hooksWritten: 0,
		hooksDropped: hooksCount,
		warnings,
		error: err instanceof Error ? err.message : String(err),
	};
}

/**
 * Top-level dispatch. Routes to the per-provider merger.
 * `hookTargetPaths` maps source hook name → installed target path (per-file installer).
 */
export async function mergeHooksSettings(
	provider: ProviderType,
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
	options: HooksMergeOptions,
): Promise<HooksMergeResult> {
	if (hooks.length === 0) {
		return { provider, success: true, hooksWritten: 0, hooksDropped: 0, warnings: [] };
	}

	switch (provider) {
		case "claude-code":
			return mergeClaudeCode(hooks, hookTargetPaths, options);
		default:
			return {
				provider,
				success: true,
				hooksWritten: 0,
				hooksDropped: hooks.length,
				warnings: [`${provider} does not support hooks; ${hooks.length} hook(s) skipped`],
			};
	}
}
