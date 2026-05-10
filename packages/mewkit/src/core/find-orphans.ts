/**
 * Manifest-driven orphan detection for `mewkit update`.
 *
 * The kit ships file *additions* (new rules, new skills, merged conduct rule).
 * Without a deletion pass, files removed in a release linger on user disk and
 * continue to auto-load — defeating the purpose of any pruning release.
 *
 * `findOrphans` compares files on disk under kit-owned scopes against the
 * release manifest's checksum keys. Anything on disk + not in the manifest +
 * not allowlisted is an orphan. The caller decides whether to delete (with
 * dry-run preview + confirmation) or skip via `--no-cleanup`.
 *
 * Scope is intentionally limited to kit-owned dirs; user-private state
 * (`memory/`, `logs/`, `.env`, `secrets/`) is never inspected.
 */
import { existsSync, readdirSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";
import type { Manifest } from "./compute-checksums.js";

/**
 * Kit-owned directories where orphan deletion is safe.
 *
 * `rules-conditional` is included as a one-time migration sunset — the v2.8.4
 * release merged that directory back into `rules/`, but users upgrading from
 * v2.8.3 still have the legacy dir on disk. Including it here lets the next
 * `mewkit upgrade` pass flag and remove the leftover files. Once the dir is
 * empty across all known installs, this entry can be retired.
 */
export const DEFAULT_ORPHAN_SCOPES = ["rules", "rules-conditional", "skills", "agents", "hooks"] as const;

/**
 * Files matching any of these regexes are user customizations and never deleted,
 * even if they're not in the manifest. Conservative defaults — extensible per call.
 */
export const DEFAULT_ORPHAN_ALLOWLIST: RegExp[] = [
	/(^|\/)custom[-_]/i, // custom-foo.md, custom_bar.md
	/(^|\/)user-/i, // user-foo.md
	/\.local\.md$/i, // anything.local.md
	/(^|\/)README\.md$/i, // README inside kit dirs is sometimes user-edited
];

export interface FindOrphansOptions {
	/** Path to `.claude/` on user's disk. */
	claudeDir: string;
	/** Release manifest (checksum keys are the source of truth for "shipped"). */
	manifest: Manifest;
	/** Defaults to `DEFAULT_ORPHAN_SCOPES`. */
	scopes?: readonly string[];
	/** Regex patterns to exempt from cleanup. Defaults to `DEFAULT_ORPHAN_ALLOWLIST`. */
	allowlist?: RegExp[];
}

/** Files-on-disk that the release no longer ships. */
export function findOrphans(opts: FindOrphansOptions): string[] {
	const { claudeDir, manifest } = opts;
	const scopes = opts.scopes ?? DEFAULT_ORPHAN_SCOPES;
	const allowlist = opts.allowlist ?? DEFAULT_ORPHAN_ALLOWLIST;

	if (!existsSync(claudeDir)) return [];

	const orphans: string[] = [];

	for (const scope of scopes) {
		const scopeDir = join(claudeDir, scope);
		if (!existsSync(scopeDir)) continue;

		for (const relPath of walk(scopeDir, claudeDir)) {
			if (manifest.checksums[relPath]) continue;
			if (allowlist.some((re) => re.test(relPath))) continue;
			orphans.push(relPath);
		}
	}

	return orphans.sort();
}

function walk(dir: string, base: string): string[] {
	const out: string[] = [];
	const SKIP = new Set(["__pycache__", "node_modules", ".DS_Store", ".venv"]);
	for (const entry of readdirSync(dir)) {
		if (SKIP.has(entry)) continue;
		const full = join(dir, entry);
		// lstat (not stat) so symlinks are detected and skipped — never follow.
		// A symlink inside `.claude/rules/` pointing outside the scope dir would
		// otherwise let `findOrphans` return paths with `..` segments, which the
		// caller's `unlinkSync(join(claudeDir, orphan))` could resolve to a file
		// outside `.claude/`. Skipping symlinks is the scope-boundary guarantee.
		const stat = lstatSync(full);
		if (stat.isSymbolicLink()) continue;
		if (stat.isDirectory()) {
			out.push(...walk(full, base));
		} else {
			out.push(relative(base, full));
		}
	}
	return out;
}
