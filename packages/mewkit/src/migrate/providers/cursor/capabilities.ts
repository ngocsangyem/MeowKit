// Cursor IDE version detection — floor-only version gate for the authored bundle install
// (warn-and-degrade, never hard-fail). Scoped to what the authored bundle needs today; a full
// per-event capability table (mirroring codex/capabilities.ts) lands once native hooks are
// authored.
//
// The IDE and CLI do NOT share a version scheme (verified against this machine's installs):
// the IDE reports semver (`CFBundleShortVersionString`, e.g. `3.13.10`) while the CLI
// (`cursor-agent`) uses calendar versioning (e.g. `2026.07.23-e383d2b`). This floor check
// therefore targets the IDE only; independent IDE/CLI version rows land in the
// minimum-version-matrix once it is authored.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import semver from "semver";

const execFileAsync = promisify(execFile);

/** Operational floor for the Cursor IDE (semver). */
export const CURSOR_MIN_SUPPORTED_VERSION = "3.11.0";

/** True when the installed Cursor IDE version is at/above the supported floor. */
export function isCursorVersionSupported(version: string): boolean {
	const coerced = semver.coerce(version);
	const min = semver.coerce(CURSOR_MIN_SUPPORTED_VERSION);
	if (!coerced || !min) return false;
	return semver.gte(coerced, min);
}

/**
 * Best-effort IDE version probe via the `cursor` CLI shim. Returns null when the binary is
 * absent from PATH (common — the embedded shim under `Cursor.app` is not PATH-linked by
 * default) or a compat env override is set; null always means "cannot verify", never "below
 * minimum" — the caller must not warn on an unknown.
 */
export async function detectCursorVersion(): Promise<string | null> {
	if (process.env.MEWKIT_CURSOR_COMPAT === "strict" || process.env.MEWKIT_CURSOR_COMPAT === "optimistic") {
		return null;
	}
	try {
		const { stdout } = await execFileAsync("cursor", ["--version"], { timeout: 5000, encoding: "utf8" });
		return stdout.trim().split(/\s+/)[0] || null;
	} catch {
		return null;
	}
}
