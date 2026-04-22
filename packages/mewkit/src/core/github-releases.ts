import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import AdmZip from "adm-zip";
import * as log from "./core-logger.js";

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
	downloadUrl: string;
	publishedAt: string;
}

/**
 * Fetch available releases from GitHub API.
 * Returns stable and beta releases, sorted by newest first.
 */
export async function fetchReleases(): Promise<ReleaseInfo[]> {
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

	return releases
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
			};
		})
		.filter((r) => r.downloadUrl !== "");
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
export async function downloadRelease(release: ReleaseInfo): Promise<string> {
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

	// Extract the zip — pure JS, works identically on macOS, Linux, Windows.
	// (Previous `unzip` shell call failed on Windows which has no unzip by default.)
	const extractDir = join(tempDir, "extracted");
	mkdirSync(extractDir, { recursive: true });
	const zip = new AdmZip(zipPath);
	zip.extractAllTo(extractDir, /* overwrite */ true);

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
