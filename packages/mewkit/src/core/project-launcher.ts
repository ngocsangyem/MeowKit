// The committed launcher: how a project reaches its own CLI without `npx` and without a
// network call at hook time.
//
// An `npx` install leaves nothing inside the project that can run the CLI, so the
// SessionStart handler found no runtime descriptor to trust and every session opened with a
// labelled "installed runtime unavailable" fallback, while prose telling the agent to run
// `mewkit …` could not resolve the name at all. Fetching at hook time would fix neither
// honestly: it needs a network, and a hook is the worst place to discover you have none.
//
// So installation writes one small file into the project and commits it. It is a resolver,
// not a copy of the engine: it finds the CLI that installed this kit — inside the project,
// through the version-pinned record this machine kept, or as the native `mewkit-next` binary
// — and executes it (`project-launcher-source.ts` has the order). A teammate who clones the
// repository gets a working hook path if their machine has a CLI it accepts, and a named next
// action if it does not. No branch of it reaches the network.
import { chmodSync, existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { launcherSource } from "./project-launcher-source.js";

export { LAUNCHER_UNAVAILABLE_EXIT, type LauncherPin, launcherSource } from "./project-launcher-source.js";

/** `.meowkit/bin/mewkit` — committed, which is what makes a fresh clone work. */
export const LAUNCHER_REL = path.join(".meowkit", "bin", "mewkit");

export const launcherPath = (projectRoot: string): string => path.join(projectRoot, LAUNCHER_REL);

/**
 * Where this machine remembers which CLI entry installed a given version. One small JSON
 * file per version under the home directory the CLI already uses for machine-local state.
 * It holds a path, not engine bytes: a second copy of the CLI would be a second thing to
 * keep current, and the thing being solved is resolution, not distribution.
 *
 * `storeHome` defaults to the real home directory, which is what every production caller
 * wants. It exists so a test can point the record somewhere disposable: a test that writes
 * into the developer's actual home leaves state behind, and state left behind by one run is
 * what the next run trips over.
 */
export const cliRecordPath = (version: string, storeHome: string = homedir()): string =>
	path.join(storeHome, ".mewkit", "cli", `${version}.json`);

/**
 * Record the CLI entry that installed this version. Install-time only — never at hook time.
 * The read side lives in the generated launcher below, which is the only thing that needs it
 * and cannot import from here; it resolves the same path from the home directory of whatever
 * process runs it.
 */
export function recordCliEntry(version: string, entry: string, storeHome?: string): void {
	const file = cliRecordPath(version, storeHome);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify({ version, entry }, null, 2)}\n`, "utf-8");
}

/**
 * Write the launcher and record the CLI entry it resolves. Returns the launcher path, which
 * is inside the project and therefore passes the runtime descriptor's containment gate
 * unchanged — no second trust check is introduced for it.
 */
export function writeLauncher(
	projectRoot: string,
	options: { version: string; cliEntry: string; storeHome?: string },
): string {
	const target = launcherPath(projectRoot);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, launcherSource(options.version), "utf-8");
	chmodSync(target, 0o755);
	if (existsSync(options.cliEntry)) recordCliEntry(options.version, options.cliEntry, options.storeHome);
	return target;
}

/**
 * The running CLI's own entry file, which is what an install should record.
 *
 * `fileURLToPath` and not `new URL(url).pathname`: a URL path is percent-encoded, so an
 * install under a directory containing a space or a non-ASCII character yields a path with
 * `%20` or `%C3%A9` in it that no longer exists on disk, and on Windows `pathname` keeps a
 * leading slash before the drive letter. The resulting throw is swallowed by the caller's
 * try/catch, which would skip writing both the launcher and the runtime descriptor and leave
 * the project on its orientation fallback — a silent failure, in the exact `npx` case this
 * path exists to serve.
 */
export function runningCliEntry(moduleUrl: string): string {
	const here = path.dirname(fileURLToPath(moduleUrl));
	return realpathSync(path.join(here, "..", "index.js"));
}
