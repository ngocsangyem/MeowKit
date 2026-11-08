// The local copy of the kit that install actually laid down, and the version it
// came from.
//
// Deletion cannot be decided from ownership metadata alone. Both facts that
// metadata supplies — "this path is kit-owned" and "its checksum matches" —
// come from the same file, so a baseline that lies about a user's file satisfies
// both and the file is deleted as pristine kit content. The fix is to make the
// baseline insufficient: a file is removable only when its bytes also agree with
// the kit's own bytes for that path. A user-authored file matches no kit
// content, so no edited, adopted or inherited baseline can widen what is
// deleted.
//
// That requires the kit's bytes to be available offline, which they are not:
// the CLI package ships no kit content and the release is fetched into a temp
// directory that the install then deletes. So `init` and `upgrade` keep a copy
// here before that cleanup. It is DERIVED and rebuildable — `mewkit upgrade`
// re-fetches it — which is why it belongs under `cache/`.
//
// The trust property is that it is UNTRACKED, not that it lives outside the
// project: the deny-all `.meowkit/.gitignore` keeps it out of commits, so a pull
// request can neither introduce nor alter it. A `cache/` path that git
// nonetheless reports as tracked is therefore not trusted, and callers re-check
// that per run rather than assuming the ignore file is still in place.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import { hashFile } from "./compute-checksums.js";
import { KIT_MEOWKIT_FILES } from "./install-meowkit-dir.js";

export const CACHE_REL = join(".meowkit", "cache");
const VERSION_FILE = "version";

export const kitCacheDir = (root: string): string => join(root, CACHE_REL);

/** The version the cache records, or null when it has none. */
export function cachedKitVersion(root: string): string | null {
	const file = join(kitCacheDir(root), VERSION_FILE);
	if (!existsSync(file)) return null;
	const text = readFileSync(file, "utf-8").trim();
	return text === "" ? null : text;
}

/**
 * Copy the kit content of the release being installed, then record its version.
 *
 * The version is written LAST and the previous one is removed FIRST, so an
 * interrupted run leaves a cache with no version rather than new content
 * labelled with the old version — which would be compared confidently against
 * the wrong release.
 */
export function populateKitCache(sourceDir: string, root: string, version: string): void {
	const dir = kitCacheDir(root);
	rmSync(join(dir, VERSION_FILE), { force: true });
	mkdirSync(dir, { recursive: true });

	const claudeSrc = join(sourceDir, ".claude");
	if (existsSync(claudeSrc)) {
		rmSync(join(dir, ".claude"), { recursive: true, force: true });
		cpSync(claudeSrc, join(dir, ".claude"), { recursive: true, dereference: true });
	}

	const meowkitDest = join(dir, ".meowkit");
	mkdirSync(meowkitDest, { recursive: true });
	for (const name of KIT_MEOWKIT_FILES) {
		const src = join(sourceDir, ".meowkit", name);
		if (existsSync(src)) cpSync(src, join(meowkitDest, name));
	}
	const shippedIgnore = join(sourceDir, ".meowkit", ".gitignore");
	if (existsSync(shippedIgnore)) cpSync(shippedIgnore, join(meowkitDest, ".gitignore"));

	writeFileSync(join(dir, VERSION_FILE), `${version}\n`, "utf-8");
}

/**
 * The cached file for one project-relative path, when the cache holds it.
 *
 * `rel` arrives from the ownership baseline, which is a file in the project and
 * therefore assumed hostile: a `..` segment or an absolute path would resolve
 * outside the cache, and whatever happened to sit there would then stand in for
 * the kit's own bytes. Containment is asserted rather than left to the cache
 * lookup missing by luck.
 */
export function cachedKitFile(root: string, rel: string): string | null {
	const dir = resolve(kitCacheDir(root));
	const file = resolve(dir, rel.split("/").join(sep));
	if (file !== dir && !file.startsWith(dir + sep)) return null;
	if (!existsSync(file) || statSync(file).isDirectory()) return null;
	return file;
}

/**
 * True when the project's file at `rel` is byte-identical to the kit's own copy.
 * A path the cache does not hold is NOT agreement — the caller must refuse
 * rather than fall back to the baseline, which is the thing being corroborated.
 */
export function agreesWithKit(root: string, rel: string, onDisk: string): boolean {
	const cached = cachedKitFile(root, rel);
	if (cached === null) return false;
	return hashFile(cached) === hashFile(onDisk);
}
