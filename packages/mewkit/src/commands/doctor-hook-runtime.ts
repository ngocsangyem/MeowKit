import fs from "node:fs";
import path from "node:path";
import type { DiagResult } from "./doctor-checks.js";
import { runConfiguredHook } from "../core/hook-runner.js";

/**
 * Two runtime questions the behavioural gate probes cannot answer: does every
 * registration actually start, and is anything left behind that cannot start at
 * all on a host without a shell.
 *
 * A hook that fails to load is the dangerous case, because a crash exits
 * non-blocking — so an unloadable guard reads as permission. The sweep therefore
 * treats a module-resolution error the same as a shell syntax error.
 */

/** Every skill directory, so each one's `bin/` can be swept too. */
function skillDirs(srcRoot: string): string[] {
	const skillsRoot = path.join(srcRoot, ".claude", "skills");
	try {
		return fs
			.readdirSync(skillsRoot, { withFileTypes: true })
			.filter((e) => e.isDirectory() && e.name !== ".venv")
			.map((e) => path.join(skillsRoot, e.name));
	} catch {
		return [];
	}
}

/**
 * Shell and interpreter scripts allowed to remain on a hook path. The list is
 * empty, and that is the claim: every hook starts on node, so anything the
 * sweep finds here is a leftover and gets reported rather than excused.
 */
const SWEEP_EXCLUDE: string[] = [];

const RUNTIME_ERROR = /Syntax error|Bad substitution|unexpected|Cannot find module/i;

/** Events and tool inputs that between them reach every registration. */
const SWEEP_EVENTS: Array<{ event: string; tool?: string; toolInput?: Record<string, unknown> }> = [
	{ event: "SessionStart" },
	{ event: "PreToolUse", tool: "Write", toolInput: { file_path: "src/app.ts" } },
	{ event: "PreToolUse", tool: "Read", toolInput: { file_path: "README.md" } },
	{ event: "PreToolUse", tool: "Bash", toolInput: { command: "ls -la" } },
	{ event: "PostToolUse", tool: "Write", toolInput: { file_path: "src/app.ts" } },
	{ event: "Stop" },
	{ event: "UserPromptSubmit" },
];

/**
 * A shell or interpreter script under a hook path is a finding: the runtime is
 * node, and such a script cannot run on a host without that runtime installed,
 * so it is a gate that silently does nothing there — and a gate that does
 * nothing reads as permission.
 *
 * `.py` is swept alongside `.sh` because an optional interpreter is the weaker
 * assumption of the two: a host without a shell is unusual, a host without
 * Python is ordinary.
 */
const SWEPT_SUFFIXES = [".sh", ".py"];

function checkNoLeftoverInterpreterHooks(srcRoot: string): DiagResult {
	const leftovers: string[] = [];
	const walk = (dir: string) => {
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (SWEPT_SUFFIXES.some((s) => entry.name.endsWith(s)) && !SWEEP_EXCLUDE.includes(entry.name)) {
				leftovers.push(path.relative(srcRoot, full));
			}
		}
	};
	// Both trees a hook can live in: the hooks directory, and a skill's own bin/,
	// where the skill-scoped guards sit.
	walk(path.join(srcRoot, ".claude", "hooks"));
	for (const skill of skillDirs(srcRoot)) walk(path.join(skill, "bin"));
	return leftovers.length === 0
		? {
				name: "Runtime: no leftover shell or interpreter hooks",
				status: "pass",
				detail: `No ${SWEPT_SUFFIXES.join("/")} file on any hook path.`,
			}
		: {
				name: "Runtime: no leftover shell or interpreter hooks",
				status: "fail",
				detail: `Still present: ${leftovers.join(", ")}.`,
				fix: "Port the hook or guard to a .cjs module and delete the script.",
			};
}

/** Every configured registration starts cleanly, and nothing unrunnable is left behind. */
export function checkHookRuntime(settings: Record<string, unknown>, srcRoot: string, projectDir: string): DiagResult[] {
	const offenders: string[] = [];
	for (const ev of SWEEP_EVENTS) {
		const runs = runConfiguredHook(settings, {
			projectDir,
			event: ev.event,
			tool: ev.tool,
			toolName: ev.tool,
			toolInput: ev.toolInput,
			exclude: SWEEP_EXCLUDE,
		});
		for (const r of runs) {
			if (r.status === null || r.status === 126 || r.status === 127 || RUNTIME_ERROR.test(r.stderr)) {
				offenders.push(`${ev.event}${ev.tool ? `/${ev.tool}` : ""}:${r.script} (exit ${r.status})`);
			}
		}
	}
	const sweep: DiagResult =
		offenders.length === 0
			? {
					name: "Runtime: every configured hook executes cleanly",
					status: "pass",
					detail: "Every registration started and returned cleanly.",
				}
			: {
					name: "Runtime: every configured hook executes cleanly",
					status: "fail",
					detail: `Load or runtime error in: ${offenders.join("; ")}.`,
					fix: "Fix the offending hook, or correct its registration in settings.json.",
				};
	return [sweep, checkNoLeftoverInterpreterHooks(srcRoot)];
}
