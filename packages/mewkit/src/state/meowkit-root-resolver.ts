// Canonical project-root / `.meowkit/` resolver, owned by the CLI. Keys off the
// version-control root (`.git`, dir OR worktree file) as the primary sentinel, with
// a `package.json` + existing `.meowkit/` fallback for non-git checkouts. It NEVER
// keys off provider directories (`.claude/`, `.codex/`, `.cursor/`) — those are
// install targets, not state-discovery sentinels — and never confuses the new
// `.meowkit/` state root with the pre-existing `.mewkit/` lock dir or the
// `.meowkit.config.json` config file (namespace clarity, phase-1 requirement).
import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const DEFAULT_MAX_DEPTH = 40;

export interface ResolveOptions {
	/** Bounded walk depth so a symlink loop or deep tree can never spin. */
	maxDepth?: number;
}

function isGitRoot(dir: string): boolean {
	// A `.git` directory (normal clone) OR a `.git` file (worktree/submodule) both
	// mark a version-control root. `existsSync` covers both; no statSync needed.
	return existsSync(join(dir, ".git"));
}

function isFallbackRoot(dir: string): boolean {
	// Non-git checkout: only a dir that already owns BOTH a manifest AND a
	// materialized `.meowkit/` counts. `package.json` alone is not enough (every
	// nested package has one); the existing `.meowkit/` is what disambiguates the
	// true project state root.
	if (!existsSync(join(dir, "package.json"))) return false;
	const meowkit = join(dir, ".meowkit");
	return existsSync(meowkit) && statSync(meowkit).isDirectory();
}

/** Walk up from `startDir` to the nearest project root. `.git` wins over the
 *  fallback, and the NEAREST match wins (nested monorepo package over its parent).
 *  Returns null at the filesystem root when nothing matches. */
export function resolveProjectRoot(startDir: string, opts: ResolveOptions = {}): string | null {
	const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
	let current: string;
	try {
		current = realpathSync(startDir);
	} catch {
		current = startDir;
	}

	for (let depth = 0; depth < maxDepth; depth++) {
		if (isGitRoot(current) || isFallbackRoot(current)) return current;
		const parent = dirname(current);
		if (parent === current) return null; // filesystem root
		current = parent;
	}
	return null;
}

/** Resolve the `.meowkit/` state directory for `startDir`, or null when there is
 *  no project root. Read-only: never creates the directory. */
export function resolveMeowkitRoot(startDir: string, opts: ResolveOptions = {}): string | null {
	const root = resolveProjectRoot(startDir, opts);
	return root ? join(root, ".meowkit") : null;
}
