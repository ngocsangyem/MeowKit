// Runtime resolution of the `.meowkit/` state taxonomy, with the pre-migration
// fallback the hooks use. `meowkit-state-paths.ts` builds paths from a known
// `.meowkit/` root; this module decides WHICH root a given project should use.
//
// A project whose memory still lives at `.claude/memory` keeps using it until
// `mewkit migrate` moves it — writing to the new taxonomy while old content sits
// in the legacy tree would split a user's history across two directories. Same
// rule as detectLegacyMemory() in commands/memory.ts and the shell/cjs helpers in
// .claude/hooks/lib/meowkit-paths.*, so every writer agrees on one location.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type StateClass = "memory" | "telemetry" | "state" | "cache";

const LEGACY_MEMORY = join(".claude", "memory");

/** True when the legacy tree holds real content and no `.meowkit/` counterpart exists. */
export function usingLegacyMemoryTree(projectRoot: string): boolean {
	if (existsSync(join(projectRoot, ".meowkit", "memory"))) return false;
	const legacy = join(projectRoot, LEGACY_MEMORY);
	if (!existsSync(legacy)) return false;
	try {
		return readdirSync(legacy).some((f) => f !== ".gitkeep");
	} catch {
		return false;
	}
}

/** Absolute directory for one taxonomy class under the given project root. */
export function resolveStateDir(projectRoot: string, cls: StateClass): string {
	if (usingLegacyMemoryTree(projectRoot)) return join(projectRoot, LEGACY_MEMORY);
	return join(projectRoot, ".meowkit", cls);
}
