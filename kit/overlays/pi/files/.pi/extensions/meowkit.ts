// Kit hooks for Pi.
// - Every tool call is judged by .agents/meowkit/hooks/guard.cjs before it runs (the privacy
//   guard on every call, the ship check on a shell command). Pi logs an extension error and
//   lets the call run, so every failure here is caught and returned as a block.
// - The opt-in completion check and the plan-state sync run through
//   .agents/meowkit/hooks/completion.cjs on session_start, on a bash tool_result and on
//   agent_end. A block comes back as a follow-up message that starts another turn. Every
//   failure there lets the session go on.
//
// The guard was written against @earendil-works/pi-coding-agent 1.5.2, docs/extensions.md: a
// default-exported factory, `pi.on("tool_call")` with `event.toolName` and `event.input`, a
// handler that returns `{ block: true, reason }`, and `pi.exec(command, args, options)` returning
// `stdout` and `code`. The completion handlers follow docs/extensions.md at 1.7.0:
// `pi.on("tool_result")` with `isError` and `structuredContent.exit_code`, `pi.on("agent_end")`,
// `pi.sendMessage(message, { triggerTurn, deliverAs })`, `ctx.sessionManager.getSessionId()` and
// `ctx.ui.notify()`.
const GUARD = ".agents/meowkit/hooks/guard.cjs";
const COMPLETION = ".agents/meowkit/hooks/completion.cjs";
// The ship check runs lint, related tests and a type-check and stops at its own deadline first.
const GUARD_TIMEOUT_MS = 300_000;
const COMPLETION_TIMEOUT_MS = 30_000;

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The few extension API members this module uses, typed here so the module needs no import from Pi.
interface ExecResult { stdout: string; stderr?: string; code: number }
interface HookContext {
	cwd?: string;
	ui?: { notify?(message: string, type?: "info" | "warning" | "error"): void };
	sessionManager?: { getSessionId?(): string };
}
interface HookEvent {
	toolName?: string;
	input?: Record<string, unknown>;
	isError?: boolean;
	structuredContent?: { exit_code?: unknown };
}
interface HookAPI {
	on(event: string, handler: (event: HookEvent, ctx: HookContext) => Promise<unknown>): void;
	exec(command: string, args: string[], options: { cwd: string; timeout: number }): Promise<ExecResult>;
	sendMessage(message: { customType: string; content: string; display: boolean }, options: { triggerTurn: boolean; deliverAs: "followUp" }): void;
}
/** What guard.cjs and completion.cjs print. */
interface KitAnswer { block?: boolean; reason?: string; action?: string; message?: string; planLine?: string }

/** The project this module is installed in: two folders up from this file; the session's cwd when that cannot be read. */
function projectRoot(cwd: string): string {
	try {
		return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
	} catch {
		return cwd;
	}
}

/** Run a kit script on `payload`, passed as a file: a call that writes a large file is larger than one argument may be. */
async function runScript(pi: HookAPI, cwd: string, script: string, payload: object, timeout: number): Promise<{ code: number; answer: KitAnswer }> {
	const scratch = mkdtempSync(join(tmpdir(), "meowkit-hook-"));
	try {
		const file = join(scratch, "call.json");
		writeFileSync(file, JSON.stringify(payload), { mode: 0o600 });
		const path = join(projectRoot(cwd), script);
		const result = await pi.exec("node", [path, "--file", file], { cwd, timeout });
		try {
			return { code: result.code, answer: JSON.parse(result.stdout) as KitAnswer };
		} catch {
			throw new Error(`no answer from ${path} (exit ${result.code}): ${String(result.stderr).trim()}`);
		}
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}

function session(ctx: HookContext): { cwd: string; sessionId: string } {
	let sessionId = "";
	try {
		sessionId = String(ctx.sessionManager?.getSessionId?.() ?? "");
	} catch {}
	return { cwd: ctx.cwd ?? process.cwd(), sessionId };
}

/** The completion script's answer, or null when it could not run. Never throws. */
async function completion(pi: HookAPI, ctx: HookContext, call: object): Promise<KitAnswer | null> {
	try {
		const s = session(ctx);
		const { answer } = await runScript(pi, s.cwd, COMPLETION, { ...s, ...call }, COMPLETION_TIMEOUT_MS);
		return answer;
	} catch {
		return null;
	}
}

export default function (pi: HookAPI) {
	pi.on("tool_call", async (event, ctx) => {
		try {
			const cwd = ctx.cwd ?? process.cwd();
			const { code, answer } = await runScript(pi, cwd, GUARD, { toolName: event.toolName, input: event.input, cwd }, GUARD_TIMEOUT_MS);
			if (code === 0 && answer.block === false) return undefined;
			return { block: true, reason: answer.reason || "Kit guard blocked this call." };
		} catch (error) {
			return { block: true, reason: `Kit guard could not run, so the call is not allowed: ${error}` };
		}
	});

	pi.on("session_start", async (_event, ctx) => {
		await completion(pi, ctx, { event: "session_start" });
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;
		const raw = event.input?.command;
		const command = typeof raw === "string" ? raw : "";
		const exit = event.structuredContent?.exit_code;
		const passed = event.isError !== true && (typeof exit !== "number" || exit === 0);
		if (command && passed) await completion(pi, ctx, { event: "tool_result", command, passed });
		return undefined;
	});

	pi.on("agent_end", async (_event, ctx) => {
		const answer = await completion(pi, ctx, { event: "agent_end" });
		if (!answer) return;
		try {
			if (answer.planLine) ctx.ui?.notify?.(answer.planLine, "info");
			if (answer.action === "notice" && answer.message) ctx.ui?.notify?.(answer.message, "warning");
			if (answer.action === "block" && answer.reason) {
				pi.sendMessage({ customType: "meowkit-completion-check", content: answer.reason, display: true }, { triggerTurn: true, deliverAs: "followUp" });
			}
		} catch {}
	});
}
