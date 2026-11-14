import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Replays a Claude Code hook exactly as `.claude/settings.json` configures it:
 * same executable, same arguments, JSON on stdin (NOT positional args). This is
 * the single source of truth shared by the configured-hook integration tests and
 * the `doctor --hard-gates` probes — neither hardcodes an interpreter, so both
 * reproduce the real invocation.
 *
 * Two registration shapes exist and both are honoured. Exec form puts the
 * executable in `command` and its arguments in `args`, each passed through
 * verbatim with no shell involved. Shell form is one `command` string handed to
 * a shell. Reconstructing only one of them would silently skip every hook
 * registered the other way, which is how a probe set ends up probing nothing.
 */

export interface HookCommand {
	/** The command as written in settings.json, for reporting. */
	raw: string;
	/** The executable — e.g. "node", "bash". */
	interpreter: string;
	/** Script path as written in settings.json (may contain `$CLAUDE_PROJECT_DIR`). */
	scriptRef: string;
	/** Basename of the script, for filtering and identification. */
	script: string;
	/** Arguments after the script, as written — e.g. the event a dispatcher receives. */
	extraArgs: string[];
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
	/** If set, only run the command whose script basename equals this value. */
	only?: string;
	/** Script basenames to skip (e.g. a slow bootstrap hook irrelevant to the probe). */
	exclude?: string[];
}

interface HookEntry {
	type?: string;
	command?: string;
	args?: string[];
}
interface HookGroup {
	matcher?: string;
	hooks?: HookEntry[];
}
interface SettingsShape {
	hooks?: Record<string, HookGroup[]>;
}

// Per-hook subprocess ceiling. Hooks here run as real node subprocesses, and
// some spawn git or the project's own build/test commands, whose cold start
// balloons under load. A healthy hook runs
// in ~1s, but the config that drives these (vitest.config.ts) already documents
// that such subprocesses "legitimately take 6-30s" and sets testTimeout to 30000ms;
// doctor --hard-gates tolerates the same. This ceiling was left at 15000ms and so
// force-killed slow-but-healthy runs to `status: null` (a false timeout). Align it
// with that documented 30s tolerance so only a truly hung hook is killed.
const HOOK_TIMEOUT_MS = 30_000;

/**
 * Reconstruct one registration. In exec form the first `args` element is the
 * script and the rest are its arguments; in shell form the script is the first
 * double-quoted token of the command string.
 */
function parseEntry(entry: HookEntry): HookCommand | null {
	const command = entry.command ?? "";
	if (!command) return null;

	if (Array.isArray(entry.args)) {
		const [scriptRef, ...extraArgs] = entry.args;
		if (typeof scriptRef !== "string") return null;
		return {
			raw: `${command} ${entry.args.join(" ")}`,
			interpreter: command,
			scriptRef,
			script: path.basename(scriptRef),
			extraArgs,
		};
	}

	const shellForm = command.match(/^(\S+)\s+"([^"]+)"/);
	if (!shellForm) return null;
	const scriptRef = shellForm[2] ?? "";
	return {
		raw: command,
		interpreter: shellForm[1] ?? "",
		scriptRef,
		script: path.basename(scriptRef),
		extraArgs: [],
	};
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
			const parsed = parseEntry(entry);
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
		if (opts.only && cmd.script !== opts.only) continue;
		if (opts.exclude?.includes(cmd.script)) continue;

		const scriptPath = expandScriptRef(cmd.scriptRef, opts.projectDir);
		const argv = [scriptPath, ...cmd.extraArgs.map((a) => expandScriptRef(a, opts.projectDir))];
		const proc = spawnSync(cmd.interpreter, argv, {
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
