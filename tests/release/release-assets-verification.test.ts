// The check scripts/release.sh runs on dist/ before uploading a kit release.
//
// A good build passes; each way a release could go out wrong — no contract in
// the zip, a contract for another version, a checksum that does not match, a
// signed-artifact asset next to the zip — is refused by name.
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { craftZip } from "./helpers/craft-zip.js";
// The script the release runs, not a copy of its rules.
import { verifyReleaseAssets } from "../../scripts/verify-release-assets.cjs";

const VERSION = "9.9.9";
const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

interface BuildOptions {
	contract?: object | null;
	checksumOverride?: string;
	extraAssets?: string[];
}

/** A dist/ directory laid out the way prepare-release-assets.cjs writes it. */
function buildDist({
	contract = { kitContract: 1, requires: { mewkitMin: "0.1.0" }, kitVersion: VERSION },
	checksumOverride,
	extraAssets = [],
}: BuildOptions = {}): string {
	const dist = mkdtempSync(join(tmpdir(), "mewkit-release-assets-"));
	roots.push(dist);
	const members = [{ name: ".claude/rules/a.md", body: "rule\n" }];
	if (contract !== null) members.push({ name: ".claude/kit-contract.json", body: JSON.stringify(contract) });
	const zip = craftZip(members);
	writeFileSync(join(dist, "meowkit-release.zip"), zip);
	const digest = checksumOverride ?? createHash("sha256").update(zip).digest("hex");
	writeFileSync(join(dist, "checksums.txt"), `${digest}  meowkit-release.zip\n`);
	for (const name of extraAssets) writeFileSync(join(dist, name), "x");
	return dist;
}

describe("verifyReleaseAssets", () => {
	it("passes a zip with a matching contract and checksum", () => {
		expect(verifyReleaseAssets(VERSION, buildDist())).toEqual([]);
	});

	it("refuses a zip without the contract file", () => {
		expect(verifyReleaseAssets(VERSION, buildDist({ contract: null }))).toEqual([
			expect.stringMatching(/does not contain \.claude\/kit-contract\.json/),
		]);
	});

	it("refuses a contract for another kit version", () => {
		const dist = buildDist({ contract: { kitContract: 1, requires: { mewkitMin: "0.1.0" }, kitVersion: "1.0.0" } });
		expect(verifyReleaseAssets(VERSION, dist)).toEqual([
			expect.stringMatching(/kitVersion is 1\.0\.0, expected 9\.9\.9/),
		]);
	});

	it("refuses a contract without a usable kitContract or mewkitMin", () => {
		const problems = verifyReleaseAssets(VERSION, buildDist({ contract: { kitContract: "1", kitVersion: VERSION } }));
		expect(problems).toEqual([
			expect.stringMatching(/kitContract must be a positive integer/),
			expect.stringMatching(/mewkitMin must be a semver/),
		]);
	});

	it("refuses a checksum that does not match the zip", () => {
		expect(verifyReleaseAssets(VERSION, buildDist({ checksumOverride: "0".repeat(64) }))).toEqual([
			expect.stringMatching(/does not match meowkit-release\.zip/),
		]);
	});

	it("refuses signed-artifact assets left in dist/", () => {
		const dist = buildDist({ extraAssets: ["meowkit-kit-9.9.9.tar.gz", "kit-manifest.json", "kit-manifest.json.sig"] });
		expect(verifyReleaseAssets(VERSION, dist)).toHaveLength(3);
	});
});
