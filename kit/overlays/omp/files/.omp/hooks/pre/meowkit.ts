// Kit guards for OMP: every tool call is judged by .agents/meowkit/hooks/guard.cjs before it
// runs (the privacy guard on every call, the ship check on a shell command).
//
// Written against @oh-my-pi/pi-coding-agent 18.13.3: a default-exported factory taking the
// HookAPI (src/extensibility/hooks/types.ts), `pi.on("tool_call")` with `event.toolName` and
// `event.input`, a handler that returns `{ block: true, reason }`, and `pi.exec(command, args,
// options)` returning `stdout` and `code` (src/exec/exec.ts). Every failure here is caught and
// returned as a block.
const GUARD = ".agents/meowkit/hooks/guard.cjs";
// The ship check runs lint, related tests and a type-check and stops at its own deadline first.
const TIMEOUT_MS = 300_000;

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The project this module is installed in: three folders up from this file; the session's cwd when that cannot be read. */
function projectRoot(cwd: string): string {
	try {
		return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
	} catch {
		return cwd;
	}
}

export default function (pi: any) {
	pi.on("tool_call", async (event: any, ctx: any) => {
		let scratch: string | undefined;
		try {
			const cwd = ctx.cwd ?? process.cwd();
			// A file, not an argument: a call that writes a large file is larger than one argument may be.
			scratch = mkdtempSync(join(tmpdir(), "meowkit-guard-"));
			const file = join(scratch, "call.json");
			writeFileSync(file, JSON.stringify({ toolName: event.toolName, input: event.input, cwd }), { mode: 0o600 });
			const guard = join(projectRoot(cwd), GUARD);
			const result = await pi.exec("node", [guard, "--file", file], { cwd, timeout: TIMEOUT_MS });
			let answer: any;
			try {
				answer = JSON.parse(result.stdout);
			} catch {
				throw new Error(`no answer from ${guard} (exit ${result.code}): ${String(result.stderr).trim()}`);
			}
			if (result.code === 0 && answer.block === false) return undefined;
			return { block: true, reason: answer.reason || "Kit guard blocked this call." };
		} catch (error) {
			return { block: true, reason: `Kit guard could not run, so the call is not allowed: ${error}` };
		} finally {
			if (scratch) rmSync(scratch, { recursive: true, force: true });
		}
	});
}
