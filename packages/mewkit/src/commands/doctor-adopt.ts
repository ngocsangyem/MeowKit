// `mewkit doctor --adopt` — rebuild the ownership baseline, or refuse.
//
// The tempting implementation is "record what is on disk as kit content". That
// is exactly wrong: a teammate's edited file would be recorded `owner: meowkit`
// with a matching checksum, and the next `uninstall` would delete it as
// pristine. So adoption compares against the local kit cache and NOTHING else —
// not a committed manifest, not an inherited metadata file, not the content's
// own plausibility. A file the cache does not hold is recorded as the user's.
//
// Where the cache cannot answer, this refuses and names what would produce one.
// A fresh clone has no cache, because the cache is untracked, so a clone refuses
// — which is the safe outcome rather than a limitation.
import pc from "picocolors";
import { join, sep } from "node:path";

import { collectFiles, hashFile, classifyLayer } from "../core/compute-checksums.js";
import { CACHE_REL, cachedKitFile, cachedKitVersion } from "../core/kit-cache.js";
import { assessCache } from "../core/kit-cache-trust.js";
import { insideKitScope } from "../core/ownership-classify.js";
import { readInstallMetadata, type InstallFileEntry, type InstallMetadata } from "../core/install-metadata.js";
import { writeInstallMetadata } from "../core/install-metadata-writer.js";

export interface AdoptResult {
	ok: boolean;
	message: string;
	fix?: string;
	counts?: { meowkit: number; modified: number; user: number };
	version?: string;
}

/** Plan the baseline without writing it, so a caller can report or apply. */
export function planAdoption(root: string): { result: AdoptResult; meta: InstallMetadata | null } {
	const existing = readInstallMetadata(join(root, ".claude")).meta;
	const verdict = assessCache(root, existing?.version ?? cachedKitVersion(root));
	if (verdict.state !== "ok") {
		return {
			result: {
				ok: false,
				message: `Cannot adopt a baseline: ${verdict.reason}`,
				fix: "mewkit upgrade — it re-fetches the kit and writes the cache this would compare against",
			},
			meta: null,
		};
	}

	const version = cachedKitVersion(root);
	if (version === null) {
		return {
			result: {
				ok: false,
				message: `Cannot adopt a baseline: ${CACHE_REL} records no version.`,
				fix: "mewkit upgrade",
			},
			meta: null,
		};
	}

	const claudeDir = join(root, ".claude");
	const files: InstallFileEntry[] = [];
	const counts = { meowkit: 0, modified: 0, user: 0 };
	const installedAt = new Date().toISOString();

	for (const rel of collectFiles(claudeDir, claudeDir)) {
		// The same scope exclusion the classifier applies, so an adopted
		// baseline and a classification never disagree about what is installed.
		if (!insideKitScope(`.claude/${rel.split(sep).join("/")}`)) continue;
		const abs = join(claudeDir, rel);
		const onDisk = hashFile(abs);
		const layer = classifyLayer(rel);
		const cached = layer === "user" ? null : cachedKitFile(root, `.claude/${rel}`);
		if (cached === null) {
			// Two reasons to record a file as the user's, and they produce the
			// same entry: the kit does not ship this path at all, or the install
			// itself classifies the path as the user's layer. Either way the
			// file is the user's whatever it looks like, and recording it as kit
			// content is the data loss this command exists to avoid. Matching the
			// installer's own classification is also what makes an adopted
			// baseline behave under `upgrade` exactly like an installed one.
			counts.user += 1;
			files.push({
				path: rel,
				owner: "user",
				layer: "user",
				checksum: onDisk,
				baseChecksum: onDisk,
				installedVersion: version,
				installedAt,
			});
			continue;
		}
		const kitHash = hashFile(cached);
		const clean = kitHash === onDisk;
		if (clean) counts.meowkit += 1;
		else counts.modified += 1;
		files.push({
			path: rel,
			owner: clean ? "meowkit" : "meowkit-modified",
			layer,
			checksum: onDisk,
			baseChecksum: kitHash,
			installedVersion: version,
			installedAt,
		});
	}

	const meta: InstallMetadata = {
		schemaVersion: "1.0",
		tool: "meowkit",
		version,
		scope: existing?.scope ?? "local",
		installedAt: existing?.installedAt ?? installedAt,
		files,
		profile: existing?.profile,
		packs: existing?.packs,
	};

	return {
		result: {
			ok: true,
			message: `Adopted ${files.length} file(s) against the cached kit ${version}: ${counts.meowkit} unchanged, ${counts.modified} edited, ${counts.user} yours.`,
			counts,
			version,
		},
		meta,
	};
}

/** Exit code. Writes nothing at all on a refusal — a partial baseline is worse than none. */
export async function doctorAdopt(root: string | null, json = false): Promise<number> {
	if (root === null) {
		if (json) console.log(JSON.stringify({ ok: false, message: "No project here." }, null, 2));
		else console.error(pc.red("No MeowKit project here."));
		return 1;
	}

	const { result, meta } = planAdoption(root);
	if (!result.ok || meta === null) {
		if (json) console.log(JSON.stringify(result, null, 2));
		else {
			console.error(pc.red(result.message));
			if (result.fix) console.error(pc.cyan(`Fix: ${result.fix}`));
		}
		return 1;
	}

	await writeInstallMetadata(root, meta);
	if (json) console.log(JSON.stringify(result, null, 2));
	else {
		console.log(pc.green(result.message));
		console.log(
			pc.dim(
				"A file the cached kit does not hold is recorded as yours, so uninstall can never delete it as kit content.",
			),
		);
	}
	return 0;
}
