// Pure profile/pack resolver: turns a profile (or explicit pack list) into the
// exact set of `.claude/`-relative file paths to install. Membership derives from
// the Phase-2 `owner` inventory plus the manifest's base essentials and per-pack
// overrides. No fs writes. The `full`/`*` path short-circuits to the whole tree
// (collectFiles) for byte parity with today's monolithic install.
import fs from "node:fs";
import path from "node:path";
import { collectFiles } from "./compute-checksums.js";
import { buildInventory, type Inventory, type InventoryEntry } from "./build-inventory.js";
import {
	availablePacks,
	BASE_PACK,
	flattenProfile,
	PackManifestError,
	type PackManifest,
} from "./pack-manifest.js";

export interface ResolveResult {
	/** All `.claude/`-relative paths for the resolved profile/packs (incl. base). */
	paths: Set<string>;
	/** Per-pack path sets (incl. the `base` pseudo-pack) for exclusive-delete math. */
	packMembership: Map<string, Set<string>>;
	/** Concrete pack names resolved (always includes `base`). */
	packs: string[];
}

/** Normalize to forward slashes so the allow-set matches smartUpdate's manifestPath. */
function norm(p: string): string {
	return p.replace(/\\/g, "/");
}

/** Expand a base glob (`<dir>/**`) against the source tree, or treat as a literal file. */
function expandBaseGlob(claudeDir: string, glob: string): string[] {
	if (glob.endsWith("/**")) {
		const sub = glob.slice(0, -3);
		const abs = path.join(claudeDir, sub);
		return fs.existsSync(abs) ? collectFiles(abs, claudeDir) : [];
	}
	return [glob];
}

/** A skill installs its whole directory; every other artifact is a single file. */
function artifactPaths(claudeDir: string, entry: InventoryEntry): string[] {
	if (entry.type === "skill") {
		const dir = path.posix.dirname(entry.path); // skills/<dir>
		const abs = path.join(claudeDir, dir);
		if (fs.existsSync(abs)) return collectFiles(abs, claudeDir);
	}
	return [entry.path];
}

/** Always-installed essentials: explicit files, expanded globs, and core commands. */
function baseSeed(claudeDir: string, manifest: PackManifest): Set<string> {
	const set = new Set<string>();
	for (const f of manifest.base.files) set.add(norm(f));
	for (const g of manifest.base.globs) for (const f of expandBaseGlob(claudeDir, g)) set.add(norm(f));
	for (const c of manifest.base.commands) set.add(`commands/mk/${c}.md`);
	return set;
}

/**
 * Transitive `depends_on` closure across pack boundaries. Inert today — Phase-2
 * populated owner/criticality/status/runtime but no edges — so this currently
 * adds nothing; kept so profiles auto-pull future hard runtime dependencies.
 * Dangling dep ids are tolerated here (P4 `validate --packs` flags them).
 */
function closeDependsOn(claudeDir: string, inv: Inventory, includedIds: Set<string>, paths: Set<string>): void {
	const byId = new Map(inv.entries.map((e) => [e.id, e] as const));
	let changed = true;
	while (changed) {
		changed = false;
		for (const id of [...includedIds]) {
			for (const dep of byId.get(id)?.dependsOn ?? []) {
				const de = byId.get(dep);
				if (!de || includedIds.has(dep)) continue;
				includedIds.add(dep);
				for (const ap of artifactPaths(claudeDir, de)) paths.add(norm(ap));
				changed = true;
			}
		}
	}
}

/** Core builder: union base + each pack's owner/override-selected artifact files. */
function buildFromPacks(
	claudeDir: string,
	manifest: PackManifest,
	packNames: string[],
	inv: Inventory,
): { paths: Set<string>; packMembership: Map<string, Set<string>> } {
	const invIds = new Set(inv.entries.map((e) => e.id));
	const paths = new Set<string>();
	const packMembership = new Map<string, Set<string>>();
	const includedIds = new Set<string>();

	const base = baseSeed(claudeDir, manifest);
	packMembership.set(BASE_PACK, base);
	for (const p of base) paths.add(p);

	for (const packName of packNames) {
		if (packName === BASE_PACK) continue;
		const pack = manifest.packs[packName];
		if (!pack) {
			throw new PackManifestError(`unknown pack "${packName}" — available: ${availablePacks(manifest).join(", ")}`);
		}
		const owners = new Set(pack.owners ?? []);
		const add = new Set(pack.artifactsAdd ?? []);
		const exclude = new Set(pack.artifactsExclude ?? []);
		for (const id of [...add, ...exclude]) {
			if (!invIds.has(id)) {
				throw new PackManifestError(`pack "${packName}" references unknown artifact id "${id}"`);
			}
		}
		const member = new Set<string>();
		for (const e of inv.entries) {
			if (exclude.has(e.id)) continue;
			if (!owners.has(e.owner) && !add.has(e.id)) continue;
			includedIds.add(e.id);
			for (const ap of artifactPaths(claudeDir, e)) {
				const np = norm(ap);
				paths.add(np);
				member.add(np);
			}
		}
		packMembership.set(packName, member);
	}

	closeDependsOn(claudeDir, inv, includedIds, paths);
	return { paths, packMembership };
}

/** Resolve a profile name to its install allow-set. `full`/`*` ⇒ the whole tree. */
export function resolveProfile(claudeDir: string, manifest: PackManifest, profileName: string): Set<string> {
	return resolveProfileDetailed(claudeDir, manifest, profileName).paths;
}

/** Resolve a profile with per-pack membership exposed (for pack remove exclusivity). */
export function resolveProfileDetailed(claudeDir: string, manifest: PackManifest, profileName: string): ResolveResult {
	const flat = flattenProfile(manifest, profileName);
	if (flat.wildcard) {
		const all = new Set(collectFiles(claudeDir, claudeDir).map(norm));
		return { paths: all, packMembership: new Map([[BASE_PACK, all]]), packs: flat.packs };
	}
	const inv = buildInventory(claudeDir);
	const { paths, packMembership } = buildFromPacks(claudeDir, manifest, flat.packs, inv);
	return { paths, packMembership, packs: flat.packs };
}

/** Resolve an explicit pack list to its install allow-set (always includes base). */
export function resolvePacks(claudeDir: string, manifest: PackManifest, packNames: string[]): Set<string> {
	return resolvePacksDetailed(claudeDir, manifest, packNames).paths;
}

/** Resolve an explicit pack list with per-pack membership exposed. */
export function resolvePacksDetailed(claudeDir: string, manifest: PackManifest, packNames: string[]): ResolveResult {
	const names = [BASE_PACK, ...packNames.filter((n) => n !== BASE_PACK)];
	for (const n of names) {
		if (n !== BASE_PACK && !(n in manifest.packs)) {
			throw new PackManifestError(`unknown pack "${n}" — available: ${availablePacks(manifest).join(", ")}`);
		}
	}
	const inv = buildInventory(claudeDir);
	const { paths, packMembership } = buildFromPacks(claudeDir, manifest, names, inv);
	return { paths, packMembership, packs: names };
}
