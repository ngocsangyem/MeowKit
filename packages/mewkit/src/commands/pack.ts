// `mewkit pack <list|add|remove>` — post-install domain management built on the
// P1 resolver + P2 allow-set filter. add = scoped install; remove = safe,
// exclusivity-checked delete (never touches base, another installed pack, a
// settings.json-referenced hook, or a user-modified file).
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import * as p from "@clack/prompts";
import {
	availablePacks,
	BASE_PACK,
	cleanupDownload,
	downloadRelease,
	hasPackManifest,
	loadPackManifest,
	resolvePacksDetailed,
	smartUpdate,
	type UserConfig,
} from "../core/index.js";
import {
	computeRemovablePaths,
	CorruptInstallMetadataError,
	pickInstallRelease,
	readInstalledState,
	rebuildMetadata,
} from "./pack-helpers.js";

export interface PackArgs {
	subcommand?: string;
	packs: string[];
	json?: boolean;
	yes?: boolean;
	beta?: boolean;
}

/** Packs that are core safety surface — never removable. */
const PROTECTED_PACKS = new Set([BASE_PACK, "lifecycle-core"]);

const BLANK_CONFIG: UserConfig = { description: "", enableCostTracking: true, enableMemory: true, geminiApiKey: null };

export async function pack(args: PackArgs): Promise<void> {
	const claudeDir = join(process.cwd(), ".claude");
	if (!hasPackManifest(claudeDir)) {
		console.error(pc.red("Pack management requires meowkit with a pack-manifest.json."));
		console.log(pc.dim("Run `mewkit upgrade` first, then retry."));
		process.exit(1);
	}
	const manifest = loadPackManifest(claudeDir);

	let state;
	try {
		state = readInstalledState(claudeDir, manifest);
	} catch (err) {
		if (err instanceof CorruptInstallMetadataError) {
			console.error(pc.red(`Installed metadata is corrupt: ${err.detail}`));
			console.log(pc.dim("Run `mewkit upgrade` to repair, then retry."));
			process.exit(1);
		}
		throw err;
	}

	switch (args.subcommand) {
		case "list":
			return packList(claudeDir, manifest, state.installedPacks, args.json === true);
		case "add":
			return packAdd(claudeDir, manifest, state.meta, state.installedPacks, args);
		case "remove":
			return packRemove(claudeDir, manifest, state.meta, state.installedPacks, args);
		default:
			console.error(pc.red(`Unknown pack subcommand: ${args.subcommand ?? "(none)"}`));
			console.log(pc.dim("Usage: mewkit pack <list|add|remove> [packs...]"));
			process.exit(1);
	}
}

function packList(
	claudeDir: string,
	manifest: ReturnType<typeof loadPackManifest>,
	installed: string[],
	json: boolean,
): void {
	const installedSet = new Set(installed);
	const detailed = resolvePacksDetailed(
		claudeDir,
		manifest,
		installed.filter((n) => n !== BASE_PACK),
	);
	const rows = availablePacks(manifest).map((name) => ({
		pack: name,
		installed: installedSet.has(name),
		members: detailed.packMembership.get(name)?.size ?? 0,
	}));

	if (json) {
		console.log(JSON.stringify(rows, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan("MeowKit packs")));
	console.log(pc.dim("base is always installed (safety rules, hooks, settings, core commands)."));
	console.log();
	for (const r of rows) {
		const mark = r.installed ? pc.green("installed") : pc.dim("available");
		const count = r.installed ? pc.dim(` (${r.members} files)`) : "";
		console.log(`  [${mark}] ${r.pack}${count}`);
	}
}

async function packAdd(
	claudeDir: string,
	manifest: ReturnType<typeof loadPackManifest>,
	meta: Awaited<ReturnType<typeof readInstalledState>>["meta"],
	installed: string[],
	args: PackArgs,
): Promise<void> {
	const requested = args.packs.filter((n) => n !== BASE_PACK);
	for (const n of requested) {
		if (!(n in manifest.packs)) {
			console.error(pc.red(`Unknown pack "${n}". Available: ${availablePacks(manifest).join(", ")}`));
			process.exit(1);
		}
	}
	const installedSet = new Set(installed);
	const newPacks = requested.filter((n) => !installedSet.has(n));
	if (newPacks.length === 0) {
		console.log(pc.dim(`Already installed: ${requested.join(", ") || "(nothing requested)"} — nothing to do.`));
		return;
	}

	const release = await pickInstallRelease(meta?.version);
	if (!release) {
		console.error(pc.red("No releases found on GitHub."));
		process.exit(1);
	}
	console.log(pc.dim(`Fetching v${release.version} to add: ${newPacks.join(", ")}...`));
	const sourceDir = await downloadRelease(release);
	try {
		const srcClaude = join(sourceDir, ".claude");
		const srcManifest = loadPackManifest(srcClaude);
		const installedPaths = new Set((meta?.files ?? []).map((f) => f.path));
		const resolved = resolvePacksDetailed(srcClaude, srcManifest, newPacks).paths;
		const allowed = new Set([...resolved].filter((pth) => !installedPaths.has(pth)));

		// Store only user-selected packs — `base` is the always-implicit pseudo-pack,
		// re-prepended by readInstalledState; keeping it out of metadata keeps the
		// stored list semantically "the optional domains installed".
		const nextPacks = [...new Set([...installed, ...newPacks])].filter((n) => n !== BASE_PACK);
		// cleanup:false ⇒ a focused add only WRITES new files; it never deletes.
		const stats = await smartUpdate(BLANK_CONFIG, sourceDir, process.cwd(), false, false, {
			cleanup: false,
			allowedPaths: allowed,
			profile: meta?.profile,
			packs: nextPacks,
			assumeYes: true,
		});
		console.log(pc.green(`Added ${newPacks.join(", ")}: ${stats.added} file(s) written, ${stats.updated} updated.`));
	} finally {
		cleanupDownload(sourceDir);
	}
}

async function packRemove(
	claudeDir: string,
	manifest: ReturnType<typeof loadPackManifest>,
	meta: Awaited<ReturnType<typeof readInstalledState>>["meta"],
	installed: string[],
	args: PackArgs,
): Promise<void> {
	const requested = args.packs;
	for (const n of requested) {
		if (PROTECTED_PACKS.has(n)) {
			console.error(pc.red(`Refusing to remove "${n}" — core safety surface is not removable.`));
			process.exit(1);
		}
		if (!(n in manifest.packs)) {
			console.error(pc.red(`Unknown pack "${n}". Available: ${availablePacks(manifest).join(", ")}`));
			process.exit(1);
		}
	}
	const removeSet = new Set(requested);
	// Stored list excludes the implicit `base` (re-prepended by readInstalledState).
	const nextPacks = installed.filter((n) => n !== BASE_PACK && !removeSet.has(n));

	const { deletable, preserved } = computeRemovablePaths(
		claudeDir,
		manifest,
		installed.filter((n) => n !== BASE_PACK),
		requested,
		meta?.files ?? [],
	);

	if (deletable.length === 0) {
		console.log(pc.dim(`Nothing to remove for ${requested.join(", ")} (no pristine pack-exclusive files).`));
		if (preserved.length > 0) console.log(pc.yellow(`${preserved.length} shared/modified file(s) preserved.`));
		return;
	}

	if (!args.yes) {
		const confirm = await p.confirm({
			message: `Delete ${deletable.length} file(s) for ${requested.join(", ")}?`,
			initialValue: false,
		});
		if (p.isCancel(confirm) || confirm !== true) {
			console.log(pc.dim("Cancelled."));
			return;
		}
	}

	// Crash-safety: record the next pack list BEFORE deleting, then full rebuild.
	await rebuildMetadata(claudeDir, meta, nextPacks);
	const deleted: string[] = [];
	for (const pth of deletable) {
		try {
			unlinkSync(join(claudeDir, pth));
			deleted.push(pth);
		} catch (err) {
			console.log(pc.yellow(`Failed to delete ${pth}: ${(err as Error).message}`));
		}
	}
	await rebuildMetadata(claudeDir, meta, nextPacks);

	console.log(pc.green(`Removed ${requested.join(", ")}: ${deleted.length} file(s) deleted.`));
	if (preserved.length > 0) {
		console.log(pc.yellow(`${preserved.length} shared/base/modified file(s) preserved.`));
	}
}
