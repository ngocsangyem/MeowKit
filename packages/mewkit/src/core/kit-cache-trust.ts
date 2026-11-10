// Whether the trusted kit source can be used at all, and why not when it cannot.
//
// The trust property of the local kit cache is that it is UNTRACKED, not that it
// lives outside the project: the deny-all `.meowkit/.gitignore` keeps it out of
// commits, so a pull request can neither introduce nor alter it. That is checked
// per run with `git ls-files` rather than by trusting the ignore file to still be
// in place — a pull request that allowlists `cache/` and commits content into it
// would otherwise hand itself a trusted source.
//
// The version comparison is made on the version the cache RECORDS against the
// one the baseline reports, never on content, so a cache from another release is
// detected rather than silently compared.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { CACHE_REL, cachedKitVersion } from "./kit-cache.js";

export type CacheState = "ok" | "absent" | "version-mismatch" | "tracked";

export interface CacheVerdict {
	state: CacheState;
	/** What to tell the user, already naming the next action. */
	reason: string;
	cachedVersion: string | null;
	recordedVersion: string | null;
}

/** Whether git reports anything under the cache as tracked, re-checked per run. */
function cacheIsTracked(root: string): boolean {
	try {
		const out = execFileSync("git", ["ls-files", "--", CACHE_REL], {
			cwd: root,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		return out.trim() !== "";
	} catch {
		// No git, or no repository. Then nothing is tracked, so nothing is
		// reachable from a pull request either.
		return false;
	}
}

/**
 * Whether the trusted kit source can be used at all. The version comparison is
 * made on the version the cache RECORDS against the one the baseline reports,
 * rather than on content, so a cache from another release is detected rather
 * than silently compared.
 */
export function assessCache(root: string, recordedVersion: string | null): CacheVerdict {
	const cachedVersion = cachedKitVersion(root);
	const base = { cachedVersion, recordedVersion };
	if (!existsSync(join(root, CACHE_REL)) || cachedVersion === null) {
		return {
			...base,
			state: "absent",
			reason:
				"the local kit cache is missing, so there is nothing to check this file's content against. Run `mewkit upgrade` to re-fetch it.",
		};
	}
	if (cacheIsTracked(root)) {
		return {
			...base,
			state: "tracked",
			reason: `git reports files under ${CACHE_REL} as tracked, so the cache is reachable from a pull request and is not trusted. Untrack it, then run \`mewkit upgrade\`.`,
		};
	}
	if (recordedVersion === null || recordedVersion === "unknown") {
		return {
			...base,
			state: "version-mismatch",
			reason:
				"the baseline does not record which release it came from, so the cache cannot be checked against it. Run `mewkit upgrade` to record one.",
		};
	}
	if (cachedVersion !== recordedVersion) {
		return {
			...base,
			state: "version-mismatch",
			reason: `the cache holds kit ${cachedVersion} while this install records ${recordedVersion}, so its content is the wrong release to compare against. Run \`mewkit upgrade\` to refresh it.`,
		};
	}
	return { ...base, state: "ok", reason: "" };
}
