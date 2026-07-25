// Authored Cursor bundle: hand-maintained Cursor-native content under `modules/cursor/`,
// installed into a target project by the reconcile-backed apply (`cursor-reconcile-apply.ts`)
// — never a runtime transform of `.claude/`. Additive twin of `codex-authored-bundle.ts`
// (duplicate-first: the codex module is never renamed or parametrized).
//
// Phased transition (author-first, delete-converters-last): each manifest entry carries an
// `active` flag, mirroring the Codex bundle's phasing. A surface stays out of the install
// until its authored content lands and is flipped active in a later phase.
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArtifactManifest, type ArtifactManifest, type ArtifactManifestEntry } from "./artifact-manifest-schema.js";

/** Resolve the authored `modules/cursor/` directory (source of truth, in the kit). */
export function resolveCursorModuleDir(): string {
	return dirname(fileURLToPath(import.meta.url)) + "/cursor";
}

/** Load + validate the authored bundle manifest, or throw with the schema issues. */
export function loadCursorBundleManifest(moduleDir: string): ArtifactManifest {
	const manifestPath = join(moduleDir, "manifest.json");
	const result = parseArtifactManifest(JSON.parse(readFileSync(manifestPath, "utf-8")));
	if (result.manifest === null) {
		throw new Error(
			`invalid cursor bundle manifest: ${result.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
		);
	}
	return result.manifest;
}

/** Build artifacts that must never be copied into a target. Mirrors
 *  `isBundleBuildArtifact` in codex-authored-bundle.ts — kept as a local, tiny duplicate
 *  rather than an import so this module has no compile-time dependency on the codex one. */
function isBundleBuildArtifact(p: string): boolean {
	const norm = p.split("\\").join("/");
	return /(?:^|\/)__pycache__(?:\/|$)/.test(norm) || norm.endsWith(".pyc");
}

/**
 * Copy one manifest entry from `moduleDir` into `targetDir`, staging the write via a temp
 * path in the SAME target directory and swapping it into place with `rename` — never writing
 * directly on top of `dest`.
 *
 * For a FILE entry, POSIX `rename(2)` atomically replaces an existing regular file at `dest`
 * in a single syscall: there is no window where `dest` is missing or half-written. A crash at
 * any point before the rename leaves the previous `dest` (or no `dest`) completely untouched;
 * a crash after the rename leaves the new content fully written. Either way a re-run of the
 * reconciler sees a consistent, complete `dest` and computes a correct decision from it.
 *
 * For a DIRECTORY entry, POSIX `rename` cannot atomically replace a non-empty directory, so an
 * existing `dest` is first moved aside (itself a single atomic rename, not a copy) before the
 * staged tree is swapped in. That leaves a narrow window where `dest` is briefly absent; no
 * directory-shaped entry ships in this bundle yet, so the window is unreachable today, but the
 * branch is implemented now so a future directory entry inherits the same hardening.
 */
export function copyOneAtomic(moduleDir: string, targetDir: string, entry: ArtifactManifestEntry): void {
	const src = join(moduleDir, entry.sourcePath);
	if (!existsSync(src)) throw new Error(`authored cursor artifact missing: ${entry.sourcePath}`);
	const dest = join(targetDir, entry.targetPath);
	const destDir = dirname(dest);
	mkdirSync(destDir, { recursive: true });

	const isDir = statSync(src).isDirectory();
	const stagingPath = join(destDir, `.mewkit-tmp-${basename(dest)}-${process.pid}-${Date.now()}`);
	try {
		if (isDir) {
			mkdirSync(stagingPath, { recursive: true });
			cpSync(src, stagingPath, { recursive: true, filter: (s) => !isBundleBuildArtifact(s) });
		} else {
			cpSync(src, stagingPath);
			chmodSync(stagingPath, Number.parseInt(entry.mode, 8));
		}

		if (isDir && existsSync(dest)) {
			const backupPath = `${stagingPath}.old`;
			renameSync(dest, backupPath);
			renameSync(stagingPath, dest);
			rmSync(backupPath, { recursive: true, force: true });
		} else {
			renameSync(stagingPath, dest);
		}
	} catch (error) {
		rmSync(stagingPath, { recursive: true, force: true });
		throw error;
	}
}
