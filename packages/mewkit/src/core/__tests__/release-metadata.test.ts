import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	CorruptReleaseManifestError,
	mapPathToLastModified,
	readReleaseMetadata,
	toOrphanManifest,
} from "../release-metadata.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeSourceDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "mewkit-release-meta-"));
	tempDirs.push(dir);
	return dir;
}

async function writeManifestFile(dir: string, content: unknown): Promise<void> {
	await writeFile(join(dir, "release-manifest.json"), JSON.stringify(content), "utf-8");
}

describe("readReleaseMetadata", () => {
	it("returns null when the manifest is absent", async () => {
		const dir = await makeSourceDir();
		expect(readReleaseMetadata(dir)).toBeNull();
	});

	it("returns version, files, and deletions", async () => {
		const dir = await makeSourceDir();
		await writeManifestFile(dir, {
			version: "2.9.13",
			generatedAt: "2026-05-30T08:02:19.181Z",
			files: [{ path: "rules/a.md", checksum: "abc", size: 10, lastModified: "2026-05-09T00:12:45+07:00" }],
			deletions: ["rules-conditional/old-rule.md"],
		});

		const release = readReleaseMetadata(dir);
		expect(release?.version).toBe("2.9.13");
		expect(release?.files).toHaveLength(1);
		expect(release?.deletions).toEqual(["rules-conditional/old-rule.md"]);
	});

	it("defaults deletions to [] when the field is omitted", async () => {
		const dir = await makeSourceDir();
		await writeManifestFile(dir, {
			version: "2.9.13",
			generatedAt: "2026-05-30T08:02:19.181Z",
			files: [],
		});
		expect(readReleaseMetadata(dir)?.deletions).toEqual([]);
	});

	it("throws on a corrupt manifest", async () => {
		const dir = await makeSourceDir();
		await writeManifestFile(dir, { version: 123, files: "nope" });
		expect(() => readReleaseMetadata(dir)).toThrow(CorruptReleaseManifestError);
	});
});

describe("release manifest projections", () => {
	it("maps file paths to lastModified, skipping entries without one", () => {
		const release = {
			version: "1",
			generatedAt: "t",
			deletions: [],
			files: [
				{ path: "a.md", checksum: "x", lastModified: "2026-05-09T00:12:45+07:00" },
				{ path: "b.md", checksum: "y" },
			],
		};
		expect(mapPathToLastModified(release)).toEqual({ "a.md": "2026-05-09T00:12:45+07:00" });
	});

	it("projects onto the orphan-manifest checksum shape", () => {
		const release = {
			version: "1",
			generatedAt: "t",
			deletions: [],
			files: [{ path: "a.md", checksum: "x" }],
		};
		const manifest = toOrphanManifest(release);
		expect(manifest.checksums["a.md"]).toEqual({ sha256: "x", layer: "core" });
	});
});
