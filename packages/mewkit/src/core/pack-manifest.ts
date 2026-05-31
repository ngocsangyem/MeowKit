// Pack-manifest data model + pure manifest operations (no filesystem walking of
// artifacts). The manifest (`.claude/pack-manifest.json`) maps install profiles
// onto the Phase-2 `owner` governance metadata plus an explicit `base` essentials
// set. This module loads/shape-validates the manifest and flattens a profile to
// its concrete pack list; pack-resolver.ts turns that into actual file paths.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PACK_MANIFEST_FILENAME = "pack-manifest.json";

/** Always-installed essentials: non-artifact files, safety rules, core commands. */
export interface PackBase {
	files: string[];
	globs: string[];
	commands: string[];
}

/** A pack derives membership from `owners` plus per-artifact add/exclude overrides. */
export interface PackDef {
	owners?: string[];
	artifactsAdd?: string[];
	artifactsExclude?: string[];
}

export interface PackManifest {
	schemaVersion: string;
	base: PackBase;
	packs: Record<string, PackDef>;
	profiles: Record<string, string[]>;
}

/** Reserved profile entry meaning "every pack" — full-tree install. */
export const WILDCARD = "*";
/** The always-included pseudo-pack name. */
export const BASE_PACK = "base";

/** Thrown when the manifest is absent, unreadable, or structurally malformed. */
export class PackManifestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PackManifestError";
	}
}

/** Path to the manifest under a `.claude/` dir (present or absent). */
export function packManifestPath(claudeDir: string): string {
	return join(claudeDir, PACK_MANIFEST_FILENAME);
}

/** True when the manifest file exists — used by infra-absent guards (pack/upgrade). */
export function hasPackManifest(claudeDir: string): boolean {
	return existsSync(packManifestPath(claudeDir));
}

/** Load + shape-validate the manifest. Throws PackManifestError on any defect. */
export function loadPackManifest(claudeDir: string): PackManifest {
	const file = packManifestPath(claudeDir);
	if (!existsSync(file)) {
		throw new PackManifestError(`pack-manifest.json not found at ${file}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(file, "utf-8"));
	} catch (err) {
		throw new PackManifestError(`pack-manifest.json is not valid JSON: ${(err as Error).message}`);
	}
	return validateManifest(parsed);
}

function validateManifest(parsed: unknown): PackManifest {
	if (typeof parsed !== "object" || parsed === null) {
		throw new PackManifestError("manifest root is not an object");
	}
	const m = parsed as Record<string, unknown>;
	const base = m.base as Record<string, unknown> | undefined;
	if (!base || !Array.isArray(base.files) || !Array.isArray(base.globs) || !Array.isArray(base.commands)) {
		throw new PackManifestError("manifest.base must have array fields files/globs/commands");
	}
	if (typeof m.packs !== "object" || m.packs === null) {
		throw new PackManifestError("manifest.packs must be an object");
	}
	if (typeof m.profiles !== "object" || m.profiles === null) {
		throw new PackManifestError("manifest.profiles must be an object");
	}
	const profiles = m.profiles as Record<string, unknown>;
	for (const [name, entry] of Object.entries(profiles)) {
		if (!Array.isArray(entry)) {
			throw new PackManifestError(`profile "${name}" must be an array of pack/profile refs`);
		}
	}
	return {
		schemaVersion: typeof m.schemaVersion === "string" ? m.schemaVersion : "1.0",
		base: {
			files: (base.files as unknown[]).map(String),
			globs: (base.globs as unknown[]).map(String),
			commands: (base.commands as unknown[]).map(String),
		},
		packs: m.packs as Record<string, PackDef>,
		profiles: m.profiles as Record<string, string[]>,
	};
}

export function availableProfiles(manifest: PackManifest): string[] {
	return Object.keys(manifest.profiles);
}

export function availablePacks(manifest: PackManifest): string[] {
	return Object.keys(manifest.packs);
}

export interface FlattenResult {
	/** Concrete pack names (always includes BASE_PACK), deduped. */
	packs: string[];
	/** True when the profile transitively references the `*` wildcard (= full tree). */
	wildcard: boolean;
}

/**
 * Flatten a profile to its concrete pack list. Profile entries may reference a
 * pack, another profile (extends-style), `base`, or the `*` wildcard. Cycles are
 * detected and rejected; unknown refs throw with the available names.
 */
export function flattenProfile(manifest: PackManifest, profileName: string): FlattenResult {
	if (!(profileName in manifest.profiles)) {
		throw new PackManifestError(
			`unknown profile "${profileName}" — available: ${availableProfiles(manifest).join(", ")}`,
		);
	}
	const packs = new Set<string>([BASE_PACK]);
	let wildcard = false;
	const visiting = new Set<string>();

	const walk = (name: string): void => {
		if (visiting.has(name)) {
			throw new PackManifestError(`profile cycle detected at "${name}"`);
		}
		visiting.add(name);
		for (const ref of manifest.profiles[name]) {
			if (ref === WILDCARD) {
				wildcard = true;
				for (const p of availablePacks(manifest)) packs.add(p);
			} else if (ref === BASE_PACK) {
				packs.add(BASE_PACK);
			} else if (ref in manifest.packs) {
				// Pack-first: a profile named like its own domain pack (e.g. profile
				// "atlassian" → pack "atlassian") must bind to the pack, not recurse
				// into itself. Profile-extension targets (core, developer) are not
				// pack names, so they fall through to the profile branch below.
				packs.add(ref);
			} else if (ref in manifest.profiles) {
				walk(ref);
			} else {
				throw new PackManifestError(
					`profile "${name}" references unknown pack/profile "${ref}" — packs: ${availablePacks(manifest).join(", ")}`,
				);
			}
		}
		visiting.delete(name);
	};

	walk(profileName);
	return { packs: [...packs], wildcard };
}
