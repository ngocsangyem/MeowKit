// A kit release that also carries `checksums.txt`, and a zip that also carries
// `.claude/kit-contract.json`, installs exactly as before through the npm CLI.
//
// Both files exist for the binary installer. CLIs already in users' hands pick
// a release by its `.zip` asset and extract every member, so the extra asset
// must not be mistaken for the kit and the extra member must land as an
// ordinary file. Nothing is mocked below the network: the real selector,
// downloader and extractor run against a real zip.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanupDownload, downloadRelease, fetchReleases } from "../github-releases.js";
import { craftZip } from "../../../tests/helpers/craft-zip.js";

const ZIP_URL = "https://example.invalid/meowkit-release.zip";
const CHECKSUMS_URL = "https://example.invalid/checksums.txt";
const CONTRACT = { kitContract: 1, requires: { mewkitMin: "2.3.1" }, kitVersion: "9.9.9" };

const zipBytes = craftZip([
	{ name: ".claude/rules/a.md", body: "rule\n" },
	{ name: ".claude/kit-contract.json", body: `${JSON.stringify(CONTRACT)}\n` },
]);

/** One GitHub release listing whose assets put `checksums.txt` FIRST, so a positional pick would take it. */
function releaseListing() {
	return [
		{
			tag_name: "v9.9.9",
			name: "v9.9.9",
			prerelease: false,
			draft: false,
			published_at: "2026-11-10T00:00:00Z",
			assets: [
				{ name: "checksums.txt", browser_download_url: CHECKSUMS_URL, size: 90 },
				{ name: "meowkit-release.zip", browser_download_url: ZIP_URL, size: zipBytes.length },
			],
		},
	];
}

const extracted: string[] = [];
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	for (const dir of extracted.splice(0)) cleanupDownload(dirname(dir));
});

function stubNetwork(): string[] {
	const requested: string[] = [];
	vi.stubEnv("MEOWKIT_RELEASE_SOURCE", "");
	vi.stubGlobal("fetch", async (url: string) => {
		requested.push(url);
		if (url.includes("api.github.com")) return new Response(JSON.stringify(releaseListing()), { status: 200 });
		if (url === ZIP_URL) return new Response(new Uint8Array(zipBytes), { status: 200 });
		return new Response("unexpected", { status: 404, statusText: "Not Found" });
	});
	return requested;
}

describe("kit release with checksums.txt and kit-contract.json", () => {
	it("selects the zip asset, not checksums.txt, and sees no signed artifact", async () => {
		stubNetwork();
		const [release] = await fetchReleases();
		expect(release.downloadUrl).toBe(ZIP_URL);
		expect(release.kitArtifact).toBeNull();
	});

	it("downloads and extracts the zip, contract file included, without fetching checksums.txt", async () => {
		const requested = stubNetwork();
		const [release] = await fetchReleases();
		const dir = await downloadRelease(release);
		extracted.push(dir);

		expect(readFileSync(join(dir, ".claude", "rules", "a.md"), "utf8")).toBe("rule\n");
		expect(JSON.parse(readFileSync(join(dir, ".claude", "kit-contract.json"), "utf8"))).toEqual(CONTRACT);
		expect(requested).not.toContain(CHECKSUMS_URL);
	});
});
