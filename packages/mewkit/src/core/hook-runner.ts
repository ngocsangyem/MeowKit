import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Replays a Claude Code hook exactly as `.claude/settings.json` configures it:
 * same interpreter, same script, JSON on stdin (NOT positional args). This is the
 * single source of truth shared by the configured-hook integration tests and the
 * `doctor --hard-gates` probes — neither hardcodes `bash`, so both reproduce the
 * real invocation (and would catch an `sh`/dash runtime mismatch).
 */

export interface HookCommand {
	/** The raw command string from settings.json. */
	raw: string;
	/** First token of the command — e.g. "bash", "sh", "node". */
	interpreter: string;
	/** Script path as written in settings.json (may contain `$CLAUDE_PROJECT_DIR`). */
	scriptRef: string;
	/** Basename of the script, for filtering/identification. */
	script: string;
}

export interface HookRunResult {
	script: string;
	interpreter: string;
	status: number | null;
	stdout: string;
	stderr: string;
}

export interface HookToolInput {
	file_path?: string;
	command?: string;
	[key: string]: unknown;
}

export interface RunConfiguredHookOptions {
	projectDir: string;
	event: string;
	/** Concrete tool name (e.g. "Write") matched against each group's `matcher` regex. */
	tool?: string;
	/** tool_name field in the stdin JSON; defaults to `tool`. */
	toolName?: string;
	toolInput?: HookToolInput;
	extraEnv?: Record<string, string>;
	/** Skip non-shell (e.g. node) commands. Default true — shell hooks are the runtime-mismatch surface. */
	shellOnly?: boolean;
	/** If set, only run the command whose script basename equals this value. */
	only?: string;
	/** Script basenames to skip (e.g. a slow bootstrap hook irrelevant to the probe). */
	exclude?: string[];
}

interface HookEntry {
	type?: string;
	command?: string;
}
interface HookGroup {
	matcher?: string;
	hooks?: HookEntry[];
}
interface SettingsShape {
	hooks?: Record<string, HookGroup[]>;
}

const SHELL_INTERPRETERS = new Set(["sh", "bash", "dash", "zsh"]);

// Per-hook subprocess ceiling. Hooks here shell out to real interpreters, and
// several parse stdin JSON via `python3` — which can resolve to a slow launcher
// (e.g. a pyenv shim) whose cold start balloons under load. A healthy hook runs
// in ~1s, but the config that drives these (vitest.config.ts) already documents
// that such subprocesses "legitimately take 6-30s" and sets testTimeout to 30000ms;
// doctor --hard-gates tolerates the same. This ceiling was left at 15000ms and so
// force-killed slow-but-healthy runs to `status: null` (a false timeout). Align it
// with that documented 30s tolerance so only a truly hung hook is killed.
const HOOK_TIMEOUT_MS = 30_000;

/** First token + first double-quoted argument of a hook command string. */
function parseCommand(raw: string): HookCommand | null {
	const interpMatch = raw.match(/^(\S+)\s+"([^"]+)"/);
	if (!interpMatch) return null;
	const interpreter = interpMatch[1] ?? "";
	const scriptRef = interpMatch[2] ?? "";
	return { raw, interpreter, scriptRef, script: path.basename(scriptRef) };
}

/** Does a concrete tool name satisfy a group's matcher regex (e.g. "Edit|Write")? */
function matcherMatches(groupMatcher: string | undefined, tool: string | undefined): boolean {
	// Matcher-less groups (SessionStart, Stop, …) apply to the event unconditionally.
	if (!groupMatcher) return true;
	// A matcher present but no concrete tool requested → include (caller wants all).
	if (!tool) return true;
	try {
		return new RegExp(`^(?:${groupMatcher})$`).test(tool);
	} catch {
		return groupMatcher === tool;
	}
}

/**
 * Walk settings.hooks[event], returning every command whose group matches `tool`.
 * Pure — does not expand `$CLAUDE_PROJECT_DIR` (that happens at run time).
 */
export function parseHookCommands(settings: SettingsShape, event: string, tool?: string): HookCommand[] {
	const groups = settings.hooks?.[event];
	if (!Array.isArray(groups)) return [];
	const out: HookCommand[] = [];
	for (const group of groups) {
		if (!matcherMatches(group.matcher, tool)) continue;
		for (const entry of group.hooks ?? []) {
			if (typeof entry.command !== "string") continue;
			const parsed = parseCommand(entry.command);
			if (parsed) out.push(parsed);
		}
	}
	return out;
}

function expandScriptRef(scriptRef: string, projectDir: string): string {
	return scriptRef.replace(/\$\{?CLAUDE_PROJECT_DIR\}?/g, projectDir);
}

/**
 * Reconstruct and run the configured hook commands for one event/tool against
 * `projectDir`, feeding the canonical JSON-on-stdin payload. Returns one result
 * per executed command (in settings order).
 */
export function runConfiguredHook(settings: SettingsShape, opts: RunConfiguredHookOptions): HookRunResult[] {
	const shellOnly = opts.shellOnly !== false;
	const commands = parseHookCommands(settings, opts.event, opts.tool);

	const input = JSON.stringify({
		hook_event_name: opts.event,
		tool_name: opts.toolName ?? opts.tool ?? "",
		tool_input: opts.toolInput ?? {},
		session_id: "hook-runner",
		cwd: opts.projectDir,
		transcript_path: "",
	});

	const results: HookRunResult[] = [];
	for (const cmd of commands) {
		if (shellOnly && !SHELL_INTERPRETERS.has(cmd.interpreter)) continue;
		if (opts.only && cmd.script !== opts.only) continue;
		if (opts.exclude?.includes(cmd.script)) continue;

		const scriptPath = expandScriptRef(cmd.scriptRef, opts.projectDir);
		const proc = spawnSync(cmd.interpreter, [scriptPath], {
			cwd: opts.projectDir,
			input,
			encoding: "utf8",
			timeout: HOOK_TIMEOUT_MS,
			env: { ...process.env, CLAUDE_PROJECT_DIR: opts.projectDir, ...opts.extraEnv },
		});
		results.push({
			script: cmd.script,
			interpreter: cmd.interpreter,
			status: proc.status,
			stdout: proc.stdout ?? "",
			stderr: proc.stderr ?? "",
		});
	}
	return results;
}
