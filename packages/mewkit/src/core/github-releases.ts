import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import * as log from "./core-logger.js";
import { localReleaseDir, localReleaseVersion, materializeLocalRelease } from "./local-release-source.js";
import { extractReleaseZip } from "../kit/extract-release-zip.js";
import { kitArtifactAssets } from "../kit/select-release-assets.js";
import type { KitArtifactAssets } from "../kit/select-release-assets.js";
import { fetchKitArtifact } from "../kit/fetch-kit-artifact.js";
import { installFromArtifact } from "../kit/resolve-kit-content.js";

/** GitHub repository for MeowKit releases */
const GITHUB_OWNER = "ngocsangyem";
const GITHUB_REPO = "MeowKit";

interface GitHubRelease {
	tag_name: string;
	name: string;
	prerelease: boolean;
	draft: boolean;
	assets: Array<{
		name: string;
		browser_download_url: string;
		size: number;
	}>;
	published_at: string;
}

export interface ReleaseInfo {
	tag: string;
	version: string;
	isBeta: boolean;
	/** The legacy zip asset, or "" when the release carries none. */
	downloadUrl: string;
	publishedAt: string;
	/**
	 * The verified-artifact assets, when the release carries them. A release that
	 * carries them is installed from them; the zip is taken ONLY when a release
	 * carries no artifact at all, which is how older releases keep installing.
	 * An artifact that is present but fails a check is a refusal, never a
	 * fallback to the zip — a fallback would mean a tampered artifact silently
	 * downgrades the user to the unverified path the artifact exists to replace.
	 */
	kitArtifact: KitArtifactAssets | null;
}

/**
 * Fetch available releases from GitHub API.
 * Returns stable and beta releases, sorted by newest first.
 */
export async function fetchReleases(): Promise<ReleaseInfo[]> {
	const local = localReleaseDir();
	if (local !== null) {
		const version = localReleaseVersion(local);
		return [
			{
				tag: `v${version}`,
				version,
				isBeta: version.includes("-beta") || version.includes("-rc"),
				downloadUrl: pathToFileURL(local).href,
				publishedAt: new Date(0).toISOString(),
				// A local release directory is already-extracted content, so there
				// is no archive to verify and no signature to check. It is a
				// distinct origin, recorded as such, rather than one that claims to
				// have been verified.
				kitArtifact: null,
			},
		];
	}

	const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
	const response = await fetch(url, {
		headers: {
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "mewkit",
		},
	});

	if (!response.ok) {
		throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
	}

	const releases = (await response.json()) as GitHubRelease[];

	return (
		releases
			.filter((r) => !r.draft)
			.map((r) => {
				// Find the release zip asset
				const zipAsset = r.assets.find((a) => a.name.endsWith(".zip"));
				return {
					tag: r.tag_name,
					version: r.tag_name.replace(/^v/, ""),
					isBeta: r.prerelease,
					downloadUrl: zipAsset?.browser_download_url ?? "",
					publishedAt: r.published_at,
					kitArtifact: kitArtifactAssets(r.assets),
				};
			})
			// A release is installable when it carries EITHER source. Requiring a zip
			// would hide a release published with an artifact only, and requiring an
			// artifact would stop every older release from installing.
			.filter((r) => r.downloadUrl !== "" || r.kitArtifact !== null)
	);
}

/**
 * Get the latest stable release.
 */
export async function getLatestStable(): Promise<ReleaseInfo | null> {
	const releases = await fetchReleases();
	return releases.find((r) => !r.isBeta) ?? null;
}

/**
 * Get the latest beta release.
 */
export async function getLatestBeta(): Promise<ReleaseInfo | null> {
	const releases = await fetchReleases();
	return releases.find((r) => r.isBeta) ?? null;
}

/**
 * Download a release zip and extract to a temp directory.
 * Returns the path to the extracted directory.
 */
export async function downloadRelease(release: ReleaseInfo, projectRoot: string = process.cwd()): Promise<string> {
	const local = localReleaseDir();
	if (local !== null) return materializeLocalRelease(local, release.version);

	// A release that carries the verified artifact is installed from it. The zip
	// below is taken ONLY when a release carries no artifact at all, which is how
	// older releases keep installing. An artifact that is present and fails a
	// check raises out of here and the install stops: falling through to the zip
	// would mean a tampered artifact silently downgrades the user to the
	// unverified path the artifact exists to replace.
	if (release.kitArtifact !== null) {
		const bytes = await fetchKitArtifact(release.kitArtifact);
		const installed = await installFromArtifact(projectRoot, release.version, bytes, "verified-artifact");
		return installed.sourceDir;
	}

	const tempDir = join(tmpdir(), `meowkit-release-${release.version}-${Date.now()}`);
	mkdirSync(tempDir, { recursive: true });

	const zipPath = join(tempDir, "release.zip");

	log.debug(`Downloading ${release.downloadUrl}`);

	// Download the zip
	const response = await fetch(release.downloadUrl, {
		headers: { "User-Agent": "mewkit" },
		redirect: "follow",
	});

	if (!response.ok) {
		throw new Error(`Download failed: ${response.status} ${response.statusText}`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	writeFileSync(zipPath, buffer);

	log.debug(`Downloaded ${buffer.length} bytes to ${zipPath}`);

	// Extraction is path-guarded, in the module that owns that guard.
	const extractDir = join(tempDir, "extracted");
	mkdirSync(extractDir, { recursive: true });
	await extractReleaseZip(zipPath, extractDir);

	log.debug(`Extracted to ${extractDir}`);

	return extractDir;
}

/**
 * Clean up a downloaded release temp directory.
 * Uses fs.rmSync (Node 14.14+) instead of `rm -rf` so it works on Windows,
 * where cmd.exe has no `rm -rf` equivalent.
 */
export function cleanupDownload(tempDir: string): void {
	try {
		rmSync(tempDir, { recursive: true, force: true });
	} catch {
		// Best effort cleanup
	}
}
