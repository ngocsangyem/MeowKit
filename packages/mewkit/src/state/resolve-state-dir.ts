// Runtime resolution of the `.meowkit/` state taxonomy, with the pre-migration
// fallback the hooks use. `meowkit-state-paths.ts` builds paths from a known
// `.meowkit/` root; this module decides WHICH root a given project should use.
//
// A project whose memory still lives at `.claude/memory` keeps using it until
// `mewkit migrate` moves it — writing to the new taxonomy while old content sits
// in the legacy tree would split a user's history across two directories. Same
// rule as the shell/cjs helpers in .claude/hooks/lib/meowkit-paths.*, so every
// writer agrees on one location.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type StateClass = "memory" | "telemetry" | "state" | "cache";

const LEGACY_MEMORY = join(".claude", "memory");

/**
 * Files that identify `.claude/memory/` as a real pre-migration MEMORY store.
 *
 * Keying on "any entry" was too loose in both directions. Several unrelated writers
 * `mkdir -p` that path and drop a log or a cache file into it, so one stray file flipped the
 * fallback — and the fallback then relocated EVERY state class, including the committed
 * memory store, into a directory this repo's `.gitignore` ignores. A store that is silently
 * not committed defeats the whole "reviewed in the PR diff" design. Requiring a recognised
 * store file means only an actual store relocates anything.
 */
const LEGACY_STORE_FILES = ["decisions.md", "gotchas.md"] as const;

/** True when the legacy tree holds a real MEMORY store and no `.meowkit/` counterpart exists. */
export function usingLegacyMemoryTree(projectRoot: string): boolean {
	if (existsSync(join(projectRoot, ".meowkit", "memory"))) return false;
	const legacy = join(projectRoot, LEGACY_MEMORY);
	if (!existsSync(legacy)) return false;
	try {
		const entries = new Set(readdirSync(legacy));
		return LEGACY_STORE_FILES.some((name) => entries.has(name));
	} catch {
		return false;
	}
}

/**
 * Where session markers used to live, newest-first: the project root, then inside
 * the kit tree. A READER still accepts both, so a project that recorded a pointer
 * before the taxonomy settled keeps resolving it. No writer uses them — a write
 * always lands in `state/`, so these drain instead of filling. Mirrors
 * `.claude/hooks/lib/meowkit-paths.cjs`, so the hooks and the CLI agree.
 */
export const LEGACY_SESSION_STATE_RELS = ["session-state", join(".claude", "session-state")] as const;

/**
 * A session marker to READ: the canonical path when it exists, else a pre-move
 * path that does, else the canonical one — so an absent marker is reported at the
 * location a writer would use.
 */
export function resolveSessionStateFile(projectRoot: string, rel: string): string {
	const canonical = join(resolveStateDir(projectRoot, "state"), rel);
	if (existsSync(canonical)) return canonical;
	for (const legacy of LEGACY_SESSION_STATE_RELS) {
		const candidate = join(projectRoot, legacy, rel);
		if (existsSync(candidate)) return candidate;
	}
	return canonical;
}

/** Absolute directory for one taxonomy class under the given project root.
 *
 *  The legacy fallback is scoped to `memory` ONLY. Telemetry, state and cache were never in
 *  the legacy tree, and resolving them there would put the trace log and the security log
 *  inside the grep-read memory directory — exactly the content the store must not carry. */
export function resolveStateDir(projectRoot: string, cls: StateClass): string {
	if (cls === "memory" && usingLegacyMemoryTree(projectRoot)) return join(projectRoot, LEGACY_MEMORY);
	return join(projectRoot, ".meowkit", cls);
}
