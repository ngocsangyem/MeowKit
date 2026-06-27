// Translate the kit's flat-copy hook wiring into a plugin `hooks/hooks.json`.
//
// Flat-copy installs read hooks from `.claude/settings.json`, whose command
// paths are rooted at `$CLAUDE_PROJECT_DIR/.claude/`. A plugin install reads
// `hooks/hooks.json` from the plugin root and exposes that root as
// `${CLAUDE_PLUGIN_ROOT}`. Because the plugin payload is a copy of `.claude` at
// its root, the only transform needed is the command-path prefix swap — the hook
// scripts, the `handlers.json` dispatch manifest, and its relative handler paths
// all travel unchanged inside `hooks/`.
import { existsSync, readFileSync } from "node:fs";

/** Path prefix used by flat-copy hook commands (both quoted and bare forms). */
const SOURCE_PREFIX = "$CLAUDE_PROJECT_DIR/.claude/";
/** Plugin-root env var the host sets when running plugin hooks. */
const PLUGIN_PREFIX = "${CLAUDE_PLUGIN_ROOT}/";

/** Rewrite one hook command string from flat-copy roots to plugin roots. */
export function rewriteHookCommand(command: string): string {
	return command.split(SOURCE_PREFIX).join(PLUGIN_PREFIX);
}

/** The `hooks` object from a parsed settings.json (event → matcher groups). */
export type HookConfig = Record<string, unknown>;

/** Read the `hooks` object from a settings.json file, or null if absent. */
export function readSettingsHooks(settingsPath: string): HookConfig | null {
	if (!existsSync(settingsPath)) return null;
	let parsed: { hooks?: HookConfig };
	try {
		parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
	} catch {
		return null;
	}
	return parsed.hooks ?? null;
}

/**
 * Build the plugin `hooks/hooks.json` payload from a settings.json hooks object.
 * Deep-clones the structure and rewrites every `command` string to plugin roots,
 * preserving matchers, timeouts, and status messages.
 */
export function buildPluginHooks(settingsHooks: HookConfig): { hooks: HookConfig } {
	const cloned: HookConfig = JSON.parse(JSON.stringify(settingsHooks));
	rewriteCommands(cloned);
	return { hooks: cloned };
}

/** Recursively rewrite every `command` field found in the structure. */
function rewriteCommands(node: unknown): void {
	if (Array.isArray(node)) {
		for (const item of node) rewriteCommands(item);
		return;
	}
	if (node && typeof node === "object") {
		const record = node as Record<string, unknown>;
		if (typeof record.command === "string") {
			record.command = rewriteHookCommand(record.command);
		}
		for (const value of Object.values(record)) rewriteCommands(value);
	}
}
