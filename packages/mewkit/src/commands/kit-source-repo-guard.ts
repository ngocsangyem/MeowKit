// Refuses to install a released kit over the kit's own source tree.
//
// In the MeowKit monorepo, `.claude/` is the authored source of every release, not an
// installed copy. It carries no install metadata, so smart-update cannot tell authored files
// from stale ones and overwrites them wholesale — a stray `upgrade` there replaced ~1,200
// tracked files and destroyed uncommitted work. Installing into the source repo is never what
// the user wants, so it takes an explicit flag.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";

export const ALLOW_KIT_SOURCE_FLAG = "--allow-kit-source";

/** True when `dir` is the MeowKit source repo: `.claude/` plus the `mewkit` package itself. */
export function isKitSourceRepo(dir: string): boolean {
	if (!existsSync(join(dir, ".claude"))) return false;
	const pkgPath = join(dir, "packages", "mewkit", "package.json");
	if (!existsSync(pkgPath)) return false;
	try {
		return (JSON.parse(readFileSync(pkgPath, "utf-8")) as { name?: unknown }).name === "mewkit";
	} catch {
		return false;
	}
}

/** Exit 1 with an explanation when `dir` is the kit source repo and no override was passed. */
export function refuseKitSourceRepo(dir: string, command: string, allow: boolean | undefined): void {
	if (allow || !isKitSourceRepo(dir)) return;
	console.error(
		pc.red(
			`mewkit ${command}: refusing to run in the MeowKit source repo (${dir}).\n` +
				"  Its .claude/ is the kit's authored source; installing a release here overwrites it.\n" +
				`  Run this in a project that uses MeowKit, or pass ${ALLOW_KIT_SOURCE_FLAG} if you really mean it.`,
		),
	);
	process.exit(1);
}
