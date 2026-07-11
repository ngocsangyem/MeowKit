import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { smartUpdate } from "../smart-update.js";
import { buildManifest, hashFile, writeManifest } from "../compute-checksums.js";
import { readInstallMetadata, indexByPath } from "../install-metadata.js";
import type { UserConfig } from "../substitute-placeholders.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const config: UserConfig = {
	description: "",
	enableCostTracking: false,
	enableMemory: false,
	geminiApiKey: null,
};

async function makeTempRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-migration-"));
	tempDirs.push(root);
	return root;
}

async function writeText(root: string, relPath: string, content: string): Promise<void> {
	const full = join(root, relPath);
	await mkdir(join(full, ".."), { recursive: true });
	await writeFile(full, content, "utf-8");
}

/** Build a minimal extracted-release source dir with a `.claude/` + release-manifest.json. */
async function makeSource(version: string, files: Record<string, string>): Promise<string> {
	const source = await makeTempRoot();
	const manifestFiles: Array<{ path: string; checksum: string; lastModified: string }> = [];
	for (const [rel, content] of Object.entries(files)) {
		await writeText(source, `.claude/${rel}`, content);
		// Real payload checksum, mirroring scripts/generate-release-manifest.cjs — the
		// CLI now uses this to recognize a clean forward copy as toolkit-owned.
		manifestFiles.push({
			path: rel,
			checksum: hashFile(join(source, ".claude", rel)),
			lastModified: "2026-05-09T00:12:45+07:00",
		});
	}
	await writeFile(
		join(source, "release-manifest.json"),
		JSON.stringify({ version, generatedAt: "2026-05-30T00:00:00.000Z", files: manifestFiles, deletions: [] }),
		"utf-8",
	);
	return source;
}

describe("smartUpdate migration from legacy manifest", () => {
	it("writes canonical metadata, preserves user edits, dual-writes legacy, and sets version from release", async () => {
		const source = await makeSource("2.9.20", { "rules/core-behaviors.md": "release content\n" });
		const target = await makeTempRoot();

		// Seed an existing install with a legacy manifest recording the shipped hash.
		await writeText(target, ".claude/rules/core-behaviors.md", "shipped content\n");
		writeManifest(join(target, ".claude"), buildManifest(join(target, ".claude")));
		// User then edits the kit file.
		await writeText(target, ".claude/rules/core-behaviors.md", "user edit\n");

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: false });

		// User edit preserved (not overwritten by the release).
		await expect(readFile(join(target, ".claude/rules/core-behaviors.md"), "utf-8")).resolves.toBe("user edit\n");
		expect(stats.userModified).toEqual([".claude/rules/core-behaviors.md"]);

		// Canonical metadata.json written with schemaVersion + release version.
		const { source: src, meta } = readInstallMetadata(join(target, ".claude"));
		expect(src).toBe("new");
		expect(meta?.schemaVersion).toBe("1.0");
		expect(meta?.version).toBe("2.9.20");

		// The edited kit file is labeled meowkit-modified.
		const byPath = indexByPath(meta?.files ?? []);
		expect(byPath["rules/core-behaviors.md"]?.owner).toBe("meowkit-modified");

		// Legacy manifest still written this release (dual-write).
		expect(existsSync(join(target, ".claude", "meowkit.manifest.json"))).toBe(true);
	});

	it("propagates the release sourceTimestamp into pristine kit entries", async () => {
		const source = await makeSource("2.9.20", { "rules/a.md": "content\n" });
		const target = await makeTempRoot();

		await smartUpdate(config, source, target, false, false, { cleanup: false });

		const { meta } = readInstallMetadata(join(target, ".claude"));
		const entry = indexByPath(meta?.files ?? [])["rules/a.md"];
		expect(entry?.owner).toBe("meowkit");
		expect(entry?.sourceTimestamp).toBe("2026-05-09T00:12:45+07:00");
	});
});

describe("smartUpdate upgrade from version-only metadata", () => {
	it("upgrades safely and does not trigger cleanup from a version-only metadata alone", async () => {
		const source = await makeSource("2.9.20", { "rules/a.md": "release\n" });
		const target = await makeTempRoot();

		// Old pipeline left only a version-only metadata.json (no checksum manifest),
		// plus an unrelated file under a kit scope that the release no longer ships.
		await writeText(target, ".claude/metadata.json", JSON.stringify({ version: "2.8.0" }) + "\n");
		await writeText(target, ".claude/rules/stale.md", "stale but must survive\n");

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: true, assumeYes: true });

		// Cleanup must NOT delete the stale file — version-only metadata does not
		// count as a prior MeowKit install for the orphan guard.
		expect(stats.orphansDeleted).toEqual([]);
		await expect(readFile(join(target, ".claude/rules/stale.md"), "utf-8")).resolves.toBe("stale but must survive\n");

		// Upgrade still produced canonical metadata with the release version.
		const { source: src, meta } = readInstallMetadata(join(target, ".claude"));
		expect(src).toBe("new");
		expect(meta?.version).toBe("2.9.20");
	});
});
