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
import {
	CODEX_MIN_SUPPORTED_VERSION,
	detectCodexCapabilities,
	detectCodexVersion,
	isCodexVersionSupported,
} from "../codex-capabilities.js";
import { providers } from "../provider-registry.js";
import type { PortableItem, ProviderType } from "../types.js";
import type { MigrationDecisionRecord } from "../validation/migration-record-types.js";
import { ensureCodexHooksFeatureFlag } from "./codex-features-flag.js";
import { generateCodexHookWrappers, type WrapperGenerateInput } from "./codex-hook-wrapper.js";
import { getCodexRoot } from "./codex-path-safety.js";

// Neutral marker: generated files must not carry toolkit branding.
const SENTINEL_KEY = "__managed_by_migration__";
const LEGACY_SENTINEL_KEY = "__mewkit_managed__";

// Safety hooks that are never-prune class — dropping them silently is the defect
// this phase fixes. Used to elevate their skip/narrow records to CRITICAL detail.
const SAFETY_HOOK_NAMES = ["gate-enforcement.sh", "privacy-block.sh"];

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

function isSafetyHook(name: string): boolean {
	return SAFETY_HOOK_NAMES.some((s) => name.endsWith(s));
}

/** Runtime handler type stored on the discovered hook's frontmatter. */
function handlerTypeOf(hook: PortableItem): "js" | "sh" {
	const t = hook.frontmatter?.handlerType;
	if (t === "sh" || t === "js") return t;
	return hook.name.toLowerCase().endsWith(".sh") ? "sh" : "js";
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

async function mergeGeminiCli(
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
	options: HooksMergeOptions,
): Promise<HooksMergeResult> {
	const settingsCfg = providers["gemini-cli"].settingsJsonPath;
	if (!settingsCfg) return badResult("gemini-cli");
	const settingsPath = options.global ? settingsCfg.globalPath : settingsCfg.projectPath;

	const snapshot = await snapshotSettings(settingsPath);
	try {
		const claudeSection =
			(await buildHooksSectionFromSettings(options.sourceSettingsPath, hooks, hookTargetPaths)) ??
			buildClaudeHooksSection(hooks, hookTargetPaths);
		const section = requiresHookMapping("gemini-cli") ? applyGeminiMapping(claudeSection) : claudeSection;
		await mergeIntoSettingsJson(settingsPath, section);
		return {
			provider: "gemini-cli",
			success: true,
			settingsPath,
			hooksWritten: hooks.length,
			hooksDropped: 0,
			warnings: [],
		};
	} catch (err) {
		await restoreSettings(snapshot);
		return errResult("gemini-cli", err, hooks.length);
	}
}

async function mergeDroid(
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
	options: HooksMergeOptions,
): Promise<HooksMergeResult> {
	const settingsCfg = providers.droid.settingsJsonPath;
	if (!settingsCfg) return badResult("droid");
	const settingsPath = options.global ? settingsCfg.globalPath : settingsCfg.projectPath;

	const snapshot = await snapshotSettings(settingsPath);
	try {
		const section =
			(await buildHooksSectionFromSettings(options.sourceSettingsPath, hooks, hookTargetPaths)) ??
			buildClaudeHooksSection(hooks, hookTargetPaths);
		await mergeIntoSettingsJson(settingsPath, section);
		return {
			provider: "droid",
			success: true,
			settingsPath,
			hooksWritten: hooks.length,
			hooksDropped: 0,
			warnings: [],
		};
	} catch (err) {
		await restoreSettings(snapshot);
		return errResult("droid", err, hooks.length);
	}
}

async function mergeCodex(
	hooks: PortableItem[],
	hookTargetPaths: Map<string, string>,
	options: HooksMergeOptions,
): Promise<HooksMergeResult> {
	const settingsCfg = providers.codex.settingsJsonPath;
	if (!settingsCfg || !providers.codex.hooks) return badResult("codex");
	// Centralized single-rooted Codex root/dirs — never string-concatenated with a
	// project root, which was the source of the doubled-root command bug.
	const codexRoot = getCodexRoot({ global: options.global });
	const hooksDir = join(codexRoot, "hooks");
	const hooksJsonPath = join(codexRoot, "hooks.json");

	const warnings: string[] = [];
	const records: MigrationDecisionRecord[] = [];
	const snapshot = await snapshotSettings(hooksJsonPath);

	try {
		const capabilities = await detectCodexCapabilities();

		// Version detection: warn + record when the installed Codex predates the
		// supported hook tier. Deny-capable safety hooks are named explicitly.
		const installedVersion = await detectCodexVersion();
		if (installedVersion && !isCodexVersionSupported(installedVersion)) {
			const affected = hooks.filter((h) => isSafetyHook(h.name)).map((h) => h.name);
			const affectedNote = affected.length > 0 ? ` Deny-capable hooks affected: ${affected.join(", ")}.` : "";
			warnings.push(
				`Codex ${installedVersion} < ${CODEX_MIN_SUPPORTED_VERSION}: migrated hooks may be ignored by this version.${affectedNote}`,
			);
		}

		// Generate one wrapper per handler, carrying each handler's runtime type so
		// .sh handlers copy their script under the tree + get a shell-exec wrapper.
		const wrapperInputs: WrapperGenerateInput[] = hooks.map((h) => ({
			originalPath: hookTargetPaths.get(h.name) ?? h.sourcePath,
			handlerType: handlerTypeOf(h),
		}));
		const wrappers = generateCodexHookWrappers(wrapperInputs, hooksDir, capabilities);

		const successfulWrappers = wrappers.filter((w) => w.success);
		for (const w of wrappers.filter((w) => !w.success)) {
			warnings.push(`Wrapper failed for ${w.originalPath}: ${w.error}`);
			records.push(hookRecord(w.originalPath, "failed", "conversion-error", `Wrapper generation failed: ${w.error}`));
		}

		const commandSubstitutions = new Map<string, string>();
		for (const w of successfulWrappers) {
			commandSubstitutions.set(w.originalPath, w.wrapperPath);
		}

		const claudeSection =
			(await buildHooksSectionFromSettings(options.sourceSettingsPath, hooks, hookTargetPaths)) ??
			buildClaudeHooksSection(hooks, hookTargetPaths);
		const firstSource = wrapperInputs[0]?.originalPath ?? "";
		const pathRewrite: PathRewriteMap = {
			sourceDir: dirname(firstSource),
			targetDir: hooksDir,
			commandSubstitutions,
		};
		const codexSection = convertClaudeHooksToCodex(claudeSection, capabilities, pathRewrite);

		// Every generated wrapper is a .cjs (node) file. Ensure the emitted command
		// invokes node on it even when the source command had no `node ` prefix
		// (e.g. a bare `$CLAUDE_PROJECT_DIR/.claude/hooks/gate-enforcement.sh`).
		const wrapperPaths = new Set(successfulWrappers.map((w) => w.wrapperPath));
		normalizeWrapperCommands(codexSection, wrapperPaths);

		// Emit event-drop + matcher-narrow records by diffing source vs migrated.
		emitEventAndMatcherRecords(claudeSection, codexSection, hooks, warnings, records);

		// Migrated records: every successful wrapper whose event survived.
		const survivingEvents = new Set(Object.keys(codexSection));
		for (const w of successfulWrappers) {
			const hook = hooks.find((h) => (hookTargetPaths.get(h.name) ?? h.sourcePath) === w.originalPath);
			const name = hook?.name ?? w.originalPath;
			const targetEvent = eventForHookName(claudeSection, name, hook);
			if (targetEvent && !survivingEvents.has(targetEvent)) continue; // dropped-event, already recorded
			records.push(hookRecord(name, "migrated", "converted", `Wrapper: ${w.wrapperPath}`, w.wrapperPath));
		}

		const droppedEvents = Object.keys(claudeSection).filter((e) => !codexSection[e]);
		const hooksDropped = droppedEvents.length;

		// Merge into hooks.json (Codex has standalone hooks.json, not embedded in settings.json)
		const settings = await readSettings(hooksJsonPath);
		settings.hooks = codexSection;
		settings[SENTINEL_KEY] = { hooks: true };
		delete settings[LEGACY_SENTINEL_KEY];
		await atomicWrite(hooksJsonPath, `${JSON.stringify(settings, null, 2)}\n`);

		// Set [features] codex_hooks = true in config.toml
		if (capabilities.requiresFeatureFlag) {
			const configTomlPath = join(codexRoot, "config.toml");
			const featureResult = await ensureCodexHooksFeatureFlag(configTomlPath, options.global);
			if (featureResult.status === "failed") {
				warnings.push(`Feature flag write failed: ${featureResult.error}`);
			}
		}

		return {
			provider: "codex",
			success: true,
			settingsPath: hooksJsonPath,
			hooksWritten: hooks.length - hooksDropped,
			hooksDropped,
			warnings,
			records,
		};
	} catch (err) {
		await restoreSettings(snapshot);
		return errResult("codex", err, hooks.length, warnings);
	}
}

/** Build a hook decision record; safety hooks carry a CRITICAL prefix in detail. */
function hookRecord(
	name: string,
	outcome: MigrationDecisionRecord["outcome"],
	reason: MigrationDecisionRecord["reason"],
	detail?: string,
	target?: string,
): MigrationDecisionRecord {
	const critical = isSafetyHook(name) && (outcome === "skipped" || outcome === "failed" || outcome === "partial");
	return {
		source: name,
		type: "hooks",
		provider: "codex",
		outcome,
		reason,
		detail: critical ? `CRITICAL (never-prune safety hook): ${detail ?? ""}`.trim() : detail,
		target,
	};
}

/** Find which event a hook belongs to in the source section (by command match). */
function eventForHookName(section: HooksSection, name: string, hook?: PortableItem): string | undefined {
	const needle = hook?.name ?? name;
	for (const [event, groups] of Object.entries(section)) {
		for (const g of groups) {
			if (g.hooks.some((e) => typeof e.command === "string" && e.command.includes(needle))) return event;
		}
	}
	return undefined;
}

/** Diff source vs migrated section → event-unsupported + matcher-narrowed records. */
function emitEventAndMatcherRecords(
	source: HooksSection,
	migrated: HooksSection,
	hooks: PortableItem[],
	warnings: string[],
	records: MigrationDecisionRecord[],
): void {
	for (const [event, groups] of Object.entries(source)) {
		if (!migrated[event]) {
			warnings.push(`Codex does not support event '${event}' — dropped`);
			for (const hook of hooksInEvent(groups, hooks)) {
				records.push(hookRecord(hook, "skipped", "event-unsupported", `Event '${event}' unsupported on Codex`));
			}
			continue;
		}
		const srcMatchers = new Set(groups.flatMap((g) => (g.matcher ? g.matcher.split("|").map((p) => p.trim()) : [])));
		const migMatchers = new Set(
			migrated[event].flatMap((g) => (g.matcher ? g.matcher.split("|").map((p) => p.trim()) : [])),
		);
		const narrowed = [...srcMatchers].filter((m) => !migMatchers.has(m));
		if (narrowed.length > 0) {
			warnings.push(`Event '${event}' matcher narrowed: dropped ${narrowed.join(", ")} (Codex support limit)`);
			for (const hook of hooksInEvent(groups, hooks)) {
				records.push(
					hookRecord(hook, "partial", "matcher-narrowed", `Event '${event}' dropped matchers: ${narrowed.join(", ")}`),
				);
			}
		}
	}
}

/**
 * Ensure every command that points at a generated .cjs wrapper is invoked with
 * `node`. Uses an argv-shape command string (`node <path>`); the wrapper itself
 * spawns the copied .sh via an argv array, so a space-containing path stays safe.
 */
function normalizeWrapperCommands(section: HooksSection, wrapperPaths: Set<string>): void {
	for (const groups of Object.values(section)) {
		for (const g of groups) {
			for (const entry of g.hooks) {
				if (typeof entry.command !== "string") continue;
				const bare = entry.command.replace(/^node\s+/, "").trim();
				if (wrapperPaths.has(bare) && !/^node\s/.test(entry.command)) {
					entry.command = `node ${bare}`;
				}
			}
		}
	}
}

/** Source hook names referenced by any command in the given groups. */
function hooksInEvent(groups: HookGroup[], hooks: PortableItem[]): string[] {
	const names: string[] = [];
	for (const hook of hooks) {
		const referenced = groups.some((g) =>
			g.hooks.some((e) => typeof e.command === "string" && e.command.includes(hook.name)),
		);
		if (referenced) names.push(hook.name);
	}
	return names;
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
		case "gemini-cli":
			return mergeGeminiCli(hooks, hookTargetPaths, options);
		case "droid":
			return mergeDroid(hooks, hookTargetPaths, options);
		case "codex":
			return mergeCodex(hooks, hookTargetPaths, options);
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
// Suppress unused-import warning for HookEntry (re-exported for downstream consumers).
export type { HookEntry };
