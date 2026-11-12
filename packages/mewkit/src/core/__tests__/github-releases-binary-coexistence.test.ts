// Binary releases (`mewkit-v*`) share this repository's release list with kit
// releases (`v*`). The npm CLI already in users' hands picks a kit as the newest
// release that carries a `.zip` or the three kit-artifact assets, so a binary
// release must carry neither, whatever its date or prerelease flag.
//
// The binary asset names come from the release scripts themselves, so renaming
// an asset there to something a kit selector matches fails this test.
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchReleases, getLatestBeta, getLatestStable } from "../github-releases.js";
import { TARGETS, TAG_PREFIX, assetName } from "../../../../../scripts/release/binary-targets.mjs";

const DL = "https://github.com/ngocsangyem/MeowKit/releases/download";

function binaryRelease(version: string, prerelease: boolean, publishedAt: string) {
	const tag = `${TAG_PREFIX}${version}`;
	const names = [...TARGETS.map((t: string) => assetName(version, t)), "checksums.txt", "binary-manifest.json"];
	return {
		tag_name: tag,
		name: `mewkit-next ${version}`,
		prerelease,
		draft: false,
		published_at: publishedAt,
		assets: names.map((name) => ({ name, browser_download_url: `${DL}/${tag}/${name}`, size: 1 })),
	};
}

function kitRelease(version: string, prerelease: boolean, publishedAt: string) {
	const tag = `v${version}`;
	return {
		tag_name: tag,
		name: tag,
		prerelease,
		draft: false,
		published_at: publishedAt,
		assets: ["meowkit-release.zip", "checksums.txt"].map((name) => ({
			name,
			browser_download_url: `${DL}/${tag}/${name}`,
			size: 1,
		})),
	};
}

/** Newest first, as the API lists them: binary releases are the newest on both channels. */
const LISTING = [
	binaryRelease("0.3.0-beta.1", true, "2026-11-12T00:00:00Z"),
	binaryRelease("0.2.0", false, "2026-11-11T00:00:00Z"),
	kitRelease("2.16.0-beta.1", true, "2026-11-10T00:00:00Z"),
	kitRelease("2.15.0", false, "2026-11-09T00:00:00Z"),
];

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

function stubListing() {
	vi.stubEnv("MEOWKIT_RELEASE_SOURCE", "");
	vi.stubGlobal("fetch", async (url: string) => {
		if (url.includes("api.github.com")) return new Response(JSON.stringify(LISTING), { status: 200 });
		return new Response("unexpected", { status: 404, statusText: "Not Found" });
	});
}

describe("binary releases beside kit releases", () => {
	it("never lists a binary release as an installable kit", async () => {
		stubListing();
		const tags = (await fetchReleases()).map((r) => r.tag);
		expect(tags).toEqual(["v2.16.0-beta.1", "v2.15.0"]);
	});

	it("keeps the newest stable and beta kit when binary releases are newer", async () => {
		stubListing();
		expect((await getLatestStable())?.tag).toBe("v2.15.0");
		expect((await getLatestBeta())?.tag).toBe("v2.16.0-beta.1");
	});

	it("gives a binary release no .zip and no kit-artifact assets", () => {
		// Older npm CLIs still select a release by the signed-artifact names, so a
		// binary release must not carry any of them either.
		const artifactName = (name: string): boolean =>
			(name.startsWith("meowkit-kit-") && name.endsWith(".tar.gz")) ||
			name === "kit-manifest.json" ||
			name === "kit-manifest.json.sig";
		for (const release of LISTING.filter((r) => r.tag_name.startsWith(TAG_PREFIX))) {
			expect(release.assets.some((a) => a.name.endsWith(".zip"))).toBe(false);
			expect(release.assets.some((a) => artifactName(a.name))).toBe(false);
		}
	});
});
