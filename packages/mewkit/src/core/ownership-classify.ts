// What `uninstall` is allowed to remove, and why each path is or is not.
//
// Ownership metadata alone cannot decide a deletion. Both facts it supplies —
// "this path is kit-owned" and "its checksum still matches" — come from the same
// file, so a baseline that lies about a user's file satisfies both and the file
// is deleted as pristine kit content. The baseline is therefore made
// INSUFFICIENT rather than authentic: a path is removable only when its bytes
// also agree with the kit's own bytes for that path, read from the local kit
// cache. A user-authored file matches no kit content, so no edited, adopted or
// inherited baseline can widen what is deleted — it can only narrow it.
//
// When the cache cannot answer — absent, holding another release, or reported by
// git as tracked and therefore reachable from a pull request — the answer is a
// per-path REFUSAL, never a fallback to the baseline that is the thing being
// corroborated.
import { existsSync } from "node:fs";
import { isAbsolute, join, sep } from "node:path";

import { collectFiles, hashFile } from "./compute-checksums.js";
import { agreesWithKit, cachedKitFile } from "./kit-cache.js";
import { assessCache, type CacheVerdict } from "./kit-cache-trust.js";
import { readInstallMetadata } from "./install-metadata.js";

/** `.meowkit/` content that belongs to the user or the machine, never to the kit. */
export const NEVER_DELETE_RELS = [
	join(".meowkit", "memory"),
	join(".meowkit", "telemetry"),
	join(".meowkit", "state"),
	join(".meowkit", "cache"),
	join(".meowkit", "envs"),
	join(".meowkit", "backups"),
	join(".meowkit", ".env"),
] as const;

/** True for a path inside the never-delete class, whatever flags were passed. */
export function isNeverDelete(rel: string): boolean {
	const norm = rel.split("/").join(sep);
	return NEVER_DELETE_RELS.some((p) => norm === p || norm.startsWith(`${p}${sep}`));
}

export type OwnershipClass = "clean" | "modified" | "orphan" | "missing" | "protected" | "refused";

export interface ClassifiedPath {
	/** Project-relative, forward-slashed. */
	path: string;
	class: OwnershipClass;
	/** Present for `protected` and `refused`, which both mean "reported, not deleted". */
	reason?: string;
	/** True when `--force` is what makes this path deletable. */
	needsForce?: boolean;
}

export interface Classification {
	paths: ClassifiedPath[];
	cache: CacheVerdict;
	/** False when there is no ownership baseline to classify against at all. */
	hasBaseline: boolean;
	recordedVersion: string | null;
}

const posix = (p: string): string => p.split(sep).join("/");

/**
 * Directories inside `.claude/` that are never kit content: a sibling session
 * checkout (which has its own `node_modules` and would dominate any walk) and
 * the host's own log directory. The release asset excludes both for the same
 * reason, so counting them as orphans would report the kit as drifted by
 * whatever the session happened to be doing.
 */
const NOT_KIT_SUBDIRS = ["worktrees/", "logs/"] as const;

export const insideKitScope = (rel: string): boolean => !NOT_KIT_SUBDIRS.some((d) => rel.startsWith(`.claude/${d}`));

/**
 * True when a project-relative path is inside `.claude/`. `join` has already
 * collapsed any `..`, so a path that escaped the kit tree no longer starts with
 * it — and an absolute path never did.
 */
export const insideKitTree = (rel: string): boolean => rel.startsWith(".claude/") && !isAbsolute(rel);

/**
 * Classify the install. `clean` requires the baseline's claim AND the kit's own
 * bytes; everything else is reported with the reason it survives.
 */
export function classifyInstall(root: string): Classification {
	const claudeDir = join(root, ".claude");
	const { meta } = readInstallMetadata(claudeDir);
	const recordedVersion = meta?.version ?? null;
	const cache = assessCache(root, recordedVersion);

	if (meta === null) {
		return { paths: [], cache, hasBaseline: false, recordedVersion };
	}

	const paths: ClassifiedPath[] = [];
	const known = new Set<string>();

	for (const entry of meta.files) {
		const rel = posix(join(".claude", entry.path));
		known.add(rel);
		const abs = join(root, rel);

		if (isNeverDelete(rel)) {
			paths.push({ path: rel, class: "protected", reason: "user data; never removed by any flag" });
			continue;
		}
		// The baseline is a file in the project, so an entry may name a path with
		// `..` segments or an absolute one. Such a path resolves outside the kit
		// tree, and nothing further down this loop is about where a path is — so
		// containment is refused here by assertion rather than by the cache lookup
		// for it happening to miss.
		if (!insideKitTree(rel)) {
			paths.push({ path: rel, class: "refused", reason: "the baseline named a path outside the kit tree" });
			continue;
		}
		if (!existsSync(abs)) {
			paths.push({ path: rel, class: "missing" });
			continue;
		}
		if (entry.owner === "user") {
			paths.push({ path: rel, class: "orphan", reason: "the baseline records it as yours" });
			continue;
		}
		if (cache.state !== "ok") {
			paths.push({ path: rel, class: "refused", reason: cache.reason });
			continue;
		}
		if (cachedKitFile(root, rel) === null) {
			paths.push({
				path: rel,
				class: "refused",
				reason: "the baseline claims this path is kit-owned, but the kit does not ship it — the claim is not corroborated, so it is left in place",
			});
			continue;
		}
		if (hashFile(abs) === entry.baseChecksum && agreesWithKit(root, rel, abs)) {
			paths.push({ path: rel, class: "clean" });
			continue;
		}
		paths.push({ path: rel, class: "modified", needsForce: true });
	}

	// Orphans: on disk inside a kit-owned scope, absent from the baseline. Never
	// deleted — the kit cannot know what a user put there.
	// The same enumerator the installer and `doctor --adopt` use, so all three
	// agree on what the install consists of by construction rather than by three
	// separate walks staying in step.
	for (const entry of collectFiles(claudeDir, claudeDir)) {
		const rel = posix(join(".claude", entry));
		if (known.has(rel) || isNeverDelete(rel) || !insideKitScope(rel)) continue;
		paths.push({ path: rel, class: "orphan", reason: "not in the baseline" });
	}

	return { paths, cache, hasBaseline: true, recordedVersion };
}

/** The paths one invocation may remove, given the flags. */
export function deletable(classification: Classification, force: boolean): string[] {
	return classification.paths
		.filter((p) => p.class === "clean" || (force && p.class === "modified"))
		.map((p) => p.path);
}
