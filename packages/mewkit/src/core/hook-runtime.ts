// The installed-runtime descriptor: how a hook finds a REAL, trusted mewkit executable to run
// `orient` without ever calling bare `npx`, scanning arbitrary parent `node_modules`, or trusting
// a missing binary as its normal path. Installation writes this file (pointing at the executable
// resolved at install time); the hook reads + re-validates it and falls back to the checkpoint
// cache when it is missing or fails validation. The WRITE side lives here and is tested; the
// SessionStart hook mirrors the READ validation in .cjs (it ships without the TS build), exactly
// as append-trace.sh mirrors the file-lock protocol.
import { existsSync, statSync, readFileSync, realpathSync } from "node:fs";
import { rename, writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isWithinBoundary } from "./repo-context.js";

export const RUNTIME_DESCRIPTOR_FILENAME = "runtime.json";
export const RUNTIME_DESCRIPTOR_SCHEMA_VERSION = "1.0";

export const RuntimeDescriptorSchema = z
	.object({
		schemaVersion: z.literal("1.0"),
		/** Absolute path to a runnable mewkit CLI entry, validated to stay inside the project. */
		executable: z.string(),
		packageVersion: z.string().default(""),
		writtenAt: z.string().default(""),
	})
	.passthrough();
export type RuntimeDescriptor = z.infer<typeof RuntimeDescriptorSchema>;

/** `.claude/runtime.json` — the descriptor path for a project's `.claude` state. */
export function descriptorPath(claudeDir: string): string {
	return path.join(claudeDir, RUNTIME_DESCRIPTOR_FILENAME);
}

/**
 * A descriptor's executable is TRUSTED only when it is absolute, exists as a file, and resolves
 * INSIDE the project root (e.g. `node_modules/.bin/mewkit`). This is the read-side gate the hook
 * enforces so a tampered descriptor can never point the hook at an arbitrary binary (`/tmp/evil`),
 * and a global/npx executable outside the project is conservatively rejected (→ checkpoint
 * fallback) rather than run. `projectRoot` is the consumer project (dirname of `.claude`).
 */
export function executableIsTrusted(executable: string, projectRoot: string): boolean {
	if (!executable || !path.isAbsolute(executable)) return false;
	// Resolve symlinks on BOTH the executable and the project root, then require the REAL target to
	// stay inside the REAL project root. A symlink at an in-project path pointing OUT of the tree
	// must be rejected, not followed. Resolving both sides also handles a symlinked project root
	// (e.g. macOS /var → /private/var); realpathSync additionally confirms the path exists.
	let realExe: string;
	let realRoot: string;
	try {
		realExe = realpathSync(executable);
		realRoot = realpathSync(projectRoot);
	} catch {
		return false;
	}
	if (!isWithinBoundary(realRoot, realExe)) return false;
	try {
		return statSync(realExe).isFile();
	} catch {
		return false;
	}
}

/**
 * Read + validate the runtime descriptor for a project. Returns the descriptor ONLY when it parses
 * AND its executable is trusted (see `executableIsTrusted`); otherwise null with a reason. Never
 * throws — a missing/corrupt/hostile descriptor is a fallback signal, not a crash.
 */
export function readRuntimeDescriptor(claudeDir: string): { descriptor: RuntimeDescriptor } | { reason: string } {
	const file = descriptorPath(claudeDir);
	if (!existsSync(file)) return { reason: "no runtime descriptor" };
	let parsed: RuntimeDescriptor;
	try {
		parsed = RuntimeDescriptorSchema.parse(JSON.parse(readFileSync(file, "utf-8")));
	} catch (err) {
		return { reason: `invalid runtime descriptor: ${(err as Error).message}` };
	}
	const projectRoot = path.dirname(claudeDir);
	if (!executableIsTrusted(parsed.executable, projectRoot)) {
		return { reason: "runtime executable missing or outside the project boundary" };
	}
	return { descriptor: parsed };
}

/**
 * Write the runtime descriptor atomically. The caller supplies the executable resolved at install
 * time (the running CLI's own entry). Writing is REFUSED when that executable would not pass the
 * read-side trust gate, so installation never records a descriptor the hook would reject — a missing
 * descriptor (honest "no runtime") is preferred over one that always fails validation.
 */
export async function writeRuntimeDescriptor(
	claudeDir: string,
	input: { executable: string; packageVersion: string; now: string },
): Promise<void> {
	const projectRoot = path.dirname(claudeDir);
	if (!executableIsTrusted(input.executable, projectRoot)) {
		throw new Error(
			`refusing to write runtime descriptor: executable ${JSON.stringify(input.executable)} is not an existing file inside the project`,
		);
	}
	const descriptor: RuntimeDescriptor = {
		schemaVersion: RUNTIME_DESCRIPTOR_SCHEMA_VERSION,
		executable: input.executable,
		packageVersion: input.packageVersion,
		writtenAt: input.now,
	};
	await mkdir(claudeDir, { recursive: true });
	const target = descriptorPath(claudeDir);
	const tmp = `${target}.tmp-${process.pid}`;
	try {
		await writeFile(tmp, JSON.stringify(descriptor, null, 2) + "\n", "utf-8");
		await rename(tmp, target);
	} catch (err) {
		try {
			await unlink(tmp);
		} catch {
			/* best-effort cleanup */
		}
		throw err;
	}
}

/**
 * Resolve the mewkit executable to record in a descriptor for a project, if one lives INSIDE the
 * project (the only kind the hook will trust). Checks `node_modules/.bin/mewkit` first (the
 * installed-dependency case the acceptance demo targets), else a project-local dist entry. Returns
 * null when no in-project executable exists — installation then writes no descriptor.
 */
export function resolveInProjectExecutable(projectRoot: string): string | null {
	const candidates = [
		path.join(projectRoot, "node_modules", ".bin", "mewkit"),
		path.join(projectRoot, "node_modules", "mewkit", "dist", "index.js"),
	];
	for (const c of candidates) {
		if (executableIsTrusted(c, projectRoot)) return c;
	}
	return null;
}
