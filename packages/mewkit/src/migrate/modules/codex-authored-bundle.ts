// Authored Codex bundle: hand-maintained Codex-native content under
// `modules/codex/`, copied verbatim into a target project by `mewkit migrate codex`
// (no runtime transform). This is the copy mechanism + manifest loader.
//
// Phased transition (author-first, delete-converters-last): each manifest entry
// carries an `active` flag. The migrate overlay copies ONLY active entries, so a
// surface stays converter-generated until its authored version is flipped live in a
// later batch — codex migration is never left in a broken half-authored state.
// When every surface is active, the converter pipeline is retired and the copy
// becomes the whole codex migration.
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	ArtifactManifestSchema,
	type ArtifactManifest,
	type ArtifactManifestEntry,
} from "./artifact-manifest-schema.js";
import {
	expandSkillsEntry,
	isSkillsTreeEntry,
	loadSkillPackCatalog,
	resolvePackSelection,
	type PackSelection,
} from "./codex-skill-packs.js";

/** Resolve the authored `modules/codex/` directory (source of truth, in the kit). */
export function resolveCodexModuleDir(): string {
	return dirname(fileURLToPath(import.meta.url)) + "/codex";
}

/** Load + validate the authored bundle manifest, or throw with the schema issues. */
export function loadCodexBundleManifest(moduleDir: string): ArtifactManifest {
	const manifestPath = join(moduleDir, "manifest.json");
	const parsed = ArtifactManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, "utf-8")));
	if (!parsed.success) {
		throw new Error(
			`invalid codex bundle manifest: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
		);
	}
	return parsed.data;
}

export interface CopyBundleOptions {
	/** Copy only entries flipped `active` (the migrate overlay default). When false,
	 *  copy every authored entry (used by tests + full-bundle verification). */
	onlyActive?: boolean;
	/** Skill-pack selection for the `.agents/skills` tree (`"all"`, a pack list, or `[]`
	 *  for the catalog default). Undefined = copy the whole skills tree unfiltered. */
	packs?: PackSelection;
}

export interface CopiedArtifact {
	sourcePath: string;
	targetPath: string;
}

/** Copy authored bundle artifacts from `moduleDir` into `targetDir`, honoring each
 *  entry's target path and file mode. Returns what was copied. */
export function copyAuthoredCodexBundle(
	moduleDir: string,
	targetDir: string,
	opts: CopyBundleOptions = {},
): CopiedArtifact[] {
	const manifest = loadCodexBundleManifest(moduleDir);
	const activeEntries = opts.onlyActive ? manifest.entries.filter((e) => e.active) : manifest.entries;
	// Pack filtering is opt-in: undefined selection keeps the whole-tree entry (backward
	// compatible). A selection expands `.agents/skills` into per-pack skill sub-entries.
	let entries = activeEntries;
	if (opts.packs !== undefined) {
		const catalog = loadSkillPackCatalog(moduleDir);
		if (catalog) {
			const { skills } = resolvePackSelection(catalog, opts.packs);
			entries = activeEntries.flatMap((e) => (isSkillsTreeEntry(e) ? expandSkillsEntry(e, skills) : [e]));
		}
	}
	const copied: CopiedArtifact[] = [];
	for (const entry of entries) {
		copyOne(moduleDir, targetDir, entry);
		copied.push({ sourcePath: entry.sourcePath, targetPath: entry.targetPath });
	}
	return copied;
}

/** Build artifacts that must never be copied into a target: untracked, regenerated on run,
 *  and (for `.pyc`) binary blobs whose embedded string constants would pollute the project. */
export function isBundleBuildArtifact(p: string): boolean {
	const norm = p.split("\\").join("/");
	return /(?:^|\/)__pycache__(?:\/|$)/.test(norm) || norm.endsWith(".pyc");
}

export function copyOne(moduleDir: string, targetDir: string, entry: ArtifactManifestEntry): void {
	const src = join(moduleDir, entry.sourcePath);
	if (!existsSync(src)) throw new Error(`authored codex artifact missing: ${entry.sourcePath}`);
	const dest = join(targetDir, entry.targetPath);
	// Directory entries (e.g. the whole agents/ or skills/ tree) copy recursively;
	// the entry `mode` applies only to single-file artifacts (hooks/scripts).
	if (statSync(src).isDirectory()) {
		mkdirSync(dest, { recursive: true });
		cpSync(src, dest, { recursive: true, filter: (s) => !isBundleBuildArtifact(s) });
		return;
	}
	mkdirSync(dirname(dest), { recursive: true });
	cpSync(src, dest);
	chmodSync(dest, Number.parseInt(entry.mode, 8));
}
