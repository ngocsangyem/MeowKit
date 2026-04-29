// Adapted from claudekit-cli (MIT). Source: src/commands/portable/hooks-settings-merger.ts
// Patches each provider's settings.json to register migrated hooks. Snapshots existing
// settings.json before write so failures roll back cleanly (Red Team Finding 12).

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	convertClaudeHooksToCodex,
	mapEventName,
	rewriteMatcherToolNames,
	requiresHookMapping,
	type HookEntry,
	type HookGroup,
	type HooksSection,
	type PathRewriteMap,
} from "../converters/index.js";
import { detectCodexCapabilities } from "../codex-capabilities.js";
import { providers } from "../provider-registry.js";
import type { PortableItem, ProviderType } from "../types.js";
import { ensureCodexHooksFeatureFlag } from "./codex-features-flag.js";
import { generateCodexHookWrappers } from "./codex-hook-wrapper.js";

const SENTINEL_KEY = "__mewkit_managed__";

export interface HooksMergeResult {
	provider: ProviderType;
	success: boolean;
	settingsPath?: string;
	hooksWritten: number;
	hooksDropped: number;
	error?: string;
	warnings: string[];
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
		try { await unlink(snap.path); } catch { /* ignore */ }
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
		try { await unlink(tmp); } catch { /* best-effort */ }
		throw err;
	}
}

/**
 * Build a HooksSection where each migrated hook is registered as a single entry
 * keyed by hook event name. Source items represent the .cjs scripts already
 * installed at their target paths.
 */
function buildClaudeHooksSection(
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
): HooksSection {
	const section: HooksSection = {};
	for (const hook of hooks) {
		const event = inferEventFromName(hook.name);
		const targetPath = hookTargetPaths.get(hook.name) ?? hook.sourcePath;
		const group: HookGroup = {
			hooks: [{
				type: "command",
				command: `node ${targetPath}`,
			}],
		};
		const list = section[event] ?? [];
		list.push(group);
		section[event] = list;
	}
	return section;
}

/**
 * Heuristic: derive hook event from hook script filename. mewkit conventions use
 * names like `pretooluse-foo.cjs` or `session-init.cjs`. Falls back to UserPromptSubmit.
 */
function inferEventFromName(name: string): string {
	const lower = name.toLowerCase();
	if (lower.includes("pretooluse") || lower.includes("pre-tool")) return "PreToolUse";
	if (lower.includes("posttooluse") || lower.includes("post-tool")) return "PostToolUse";
	if (lower.includes("sessionstart") || lower.includes("session-start") || lower.includes("session-init")) return "SessionStart";
	if (lower.includes("stop")) return "Stop";
	if (lower.includes("notification")) return "Notification";
	if (lower.includes("userpromptsubmit") || lower.includes("user-prompt")) return "UserPromptSubmit";
	if (lower.includes("subagentstart")) return "SubagentStart";
	if (lower.includes("subagentstop")) return "SubagentStop";
	if (lower.includes("precompact") || lower.includes("pre-compact")) return "PreCompact";
	return "UserPromptSubmit";
}

function applyGeminiMapping(section: HooksSection): HooksSection {
	const mapped: HooksSection = {};
	for (const [event, groups] of Object.entries(section)) {
		const mappedEvent = mapEventName(event);
		const mappedGroups = groups.map((g) => ({
			...g,
			matcher: g.matcher ? rewriteMatcherToolNames(g.matcher) : g.matcher,
		}));
		mapped[mappedEvent] = mapped[mappedEvent] ? [...mapped[mappedEvent], ...mappedGroups] : mappedGroups;
	}
	return mapped;
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

async function mergeIntoSettingsJson(
	settingsPath: string,
	section: HooksSection,
): Promise<void> {
	const settings = await readSettings(settingsPath);
	settings.hooks = section;
	settings[SENTINEL_KEY] = { hooks: true };
	await atomicWrite(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

async function mergeClaudeCode(
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
	options: { global: boolean },
): Promise<HooksMergeResult> {
	const settingsCfg = providers["claude-code"].settingsJsonPath;
	if (!settingsCfg) return badResult("claude-code");
	const settingsPath = options.global ? settingsCfg.globalPath : settingsCfg.projectPath;

	const snapshot = await snapshotSettings(settingsPath);
	try {
		const section = buildClaudeHooksSection(hooks, hookTargetPaths);
		await mergeIntoSettingsJson(settingsPath, section);
		return {
			provider: "claude-code", success: true, settingsPath,
			hooksWritten: hooks.length, hooksDropped: 0, warnings: [],
		};
	} catch (err) {
		await restoreSettings(snapshot);
		return errResult("claude-code", err, hooks.length);
	}
}

async function mergeGeminiCli(
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
	options: { global: boolean },
): Promise<HooksMergeResult> {
	const settingsCfg = providers["gemini-cli"].settingsJsonPath;
	if (!settingsCfg) return badResult("gemini-cli");
	const settingsPath = options.global ? settingsCfg.globalPath : settingsCfg.projectPath;

	const snapshot = await snapshotSettings(settingsPath);
	try {
		const claudeSection = buildClaudeHooksSection(hooks, hookTargetPaths);
		const section = requiresHookMapping("gemini-cli")
			? applyGeminiMapping(claudeSection)
			: claudeSection;
		await mergeIntoSettingsJson(settingsPath, section);
		return {
			provider: "gemini-cli", success: true, settingsPath,
			hooksWritten: hooks.length, hooksDropped: 0, warnings: [],
		};
	} catch (err) {
		await restoreSettings(snapshot);
		return errResult("gemini-cli", err, hooks.length);
	}
}

async function mergeDroid(
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
	options: { global: boolean },
): Promise<HooksMergeResult> {
	const settingsCfg = providers.droid.settingsJsonPath;
	if (!settingsCfg) return badResult("droid");
	const settingsPath = options.global ? settingsCfg.globalPath : settingsCfg.projectPath;

	const snapshot = await snapshotSettings(settingsPath);
	try {
		const section = buildClaudeHooksSection(hooks, hookTargetPaths);
		await mergeIntoSettingsJson(settingsPath, section);
		return {
			provider: "droid", success: true, settingsPath,
			hooksWritten: hooks.length, hooksDropped: 0, warnings: [],
		};
	} catch (err) {
		await restoreSettings(snapshot);
		return errResult("droid", err, hooks.length);
	}
}

async function mergeCodex(
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
	options: { global: boolean },
): Promise<HooksMergeResult> {
	const settingsCfg = providers.codex.settingsJsonPath;
	const hooksDir = options.global ? providers.codex.hooks?.globalPath : providers.codex.hooks?.projectPath;
	if (!settingsCfg || !hooksDir) return badResult("codex");
	const hooksJsonPath = options.global ? settingsCfg.globalPath : settingsCfg.projectPath;

	const warnings: string[] = [];
	const snapshot = await snapshotSettings(hooksJsonPath);

	try {
		const capabilities = await detectCodexCapabilities();

		// Generate wrappers for each hook
		const hookSourcePaths = hooks.map((h) => hookTargetPaths.get(h.name) ?? h.sourcePath);
		const wrappers = generateCodexHookWrappers(hookSourcePaths, hooksDir, capabilities);

		const successfulWrappers = wrappers.filter((w) => w.success);
		for (const w of wrappers.filter((w) => !w.success)) {
			warnings.push(`Wrapper failed for ${w.originalPath}: ${w.error}`);
		}

		const commandSubstitutions = new Map<string, string>();
		for (const w of successfulWrappers) {
			commandSubstitutions.set(w.originalPath, w.wrapperPath);
		}

		const claudeSection = buildClaudeHooksSection(hooks, hookTargetPaths);
		const pathRewrite: PathRewriteMap = {
			sourceDir: dirname(hookSourcePaths[0] ?? ""),
			targetDir: hooksDir,
			commandSubstitutions,
		};
		const codexSection = convertClaudeHooksToCodex(claudeSection, capabilities, pathRewrite);

		const droppedEvents = Object.keys(claudeSection).filter((e) => !codexSection[e]);
		const hooksDropped = droppedEvents.length;
		for (const e of droppedEvents) warnings.push(`Codex does not support event '${e}' — dropped`);

		// Merge into hooks.json (Codex has standalone hooks.json, not embedded in settings.json)
		const settings = await readSettings(hooksJsonPath);
		settings.hooks = codexSection;
		settings[SENTINEL_KEY] = { hooks: true };
		await atomicWrite(hooksJsonPath, `${JSON.stringify(settings, null, 2)}\n`);

		// Set [features] codex_hooks = true in config.toml
		if (capabilities.requiresFeatureFlag) {
			const codexRoot = options.global ? join(dirname(hooksDir)) : dirname(hooksDir);
			const configTomlPath = join(codexRoot, "config.toml");
			const featureResult = await ensureCodexHooksFeatureFlag(configTomlPath, options.global);
			if (featureResult.status === "failed") {
				warnings.push(`Feature flag write failed: ${featureResult.error}`);
			}
		}

		return {
			provider: "codex", success: true, settingsPath: hooksJsonPath,
			hooksWritten: hooks.length - hooksDropped, hooksDropped, warnings,
		};
	} catch (err) {
		await restoreSettings(snapshot);
		return errResult("codex", err, hooks.length, warnings);
	}
}

function badResult(provider: ProviderType): HooksMergeResult {
	return { provider, success: false, hooksWritten: 0, hooksDropped: 0, warnings: [], error: `${provider} hook merge not configured` };
}

function errResult(provider: ProviderType, err: unknown, hooksCount: number, warnings: string[] = []): HooksMergeResult {
	return {
		provider, success: false, hooksWritten: 0, hooksDropped: hooksCount,
		warnings, error: err instanceof Error ? err.message : String(err),
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
	options: { global: boolean },
): Promise<HooksMergeResult> {
	if (hooks.length === 0) {
		return { provider, success: true, hooksWritten: 0, hooksDropped: 0, warnings: [] };
	}

	switch (provider) {
		case "claude-code": return mergeClaudeCode(hooks, hookTargetPaths, options);
		case "gemini-cli": return mergeGeminiCli(hooks, hookTargetPaths, options);
		case "droid": return mergeDroid(hooks, hookTargetPaths, options);
		case "codex": return mergeCodex(hooks, hookTargetPaths, options);
		default:
			return {
				provider, success: true, hooksWritten: 0, hooksDropped: hooks.length,
				warnings: [`${provider} does not support hooks; ${hooks.length} hook(s) skipped`],
			};
	}
}
// Suppress unused-import warning for HookEntry (re-exported for downstream consumers).
export type { HookEntry };
