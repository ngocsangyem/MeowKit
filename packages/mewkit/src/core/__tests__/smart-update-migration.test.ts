import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { smartUpdate } from "../smart-update.js";
import { hashFile } from "../compute-checksums.js";
import { migrateLegacyBaseline } from "../legacy-manifest-migration.js";
import { writeSupersededBaseline } from "../../../tests/helpers/superseded-baseline.js";
import { readInstallMetadata, indexByPath } from "../install-metadata.js";
import { writeInstallMetadata } from "../install-metadata-writer.js";
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

describe("smartUpdate carrying a superseded baseline forward", () => {
	it("writes canonical metadata, preserves user edits, retires the superseded file, and sets version from release", async () => {
		const source = await makeSource("2.9.20", { "rules/core-behaviors.md": "release content\n" });
		const target = await makeTempRoot();

		// Seed the project in the shape a user upgrading from an older install has:
		// its ONLY ownership baseline is the superseded checksum file.
		await writeText(target, ".claude/rules/core-behaviors.md", "shipped content\n");
		writeSupersededBaseline(join(target, ".claude"));
		// User then edits the kit file.
		await writeText(target, ".claude/rules/core-behaviors.md", "user edit\n");

		// The carry-forward runs before the update, so the update compares against a
		// real baseline. Without it the project has none, every file looks
		// user-authored, and the edit protection below would pass for the wrong reason.
		const carried = await migrateLegacyBaseline(target);
		expect(carried?.carried).toBeGreaterThan(0);
		expect(carried?.uncarried).toEqual([]);

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

		// The superseded file is retired, and only after the canonical record exists:
		// an interrupted carry leaves the old baseline rather than none at all.
		expect(existsSync(join(target, ".claude", "meowkit.manifest.json"))).toBe(false);
	});

	it("keeps the merged-settings record already in the canonical metadata", async () => {
		const target = await makeTempRoot();
		await writeText(target, ".claude/rules/core-behaviors.md", "shipped content\n");
		writeSupersededBaseline(join(target, ".claude"));
		await writeInstallMetadata(target, {
			schemaVersion: "1.0",
			tool: "meowkit",
			version: "2.9.19",
			installedAt: "2026-05-30T00:00:00.000Z",
			files: [],
			settings: { merged: ["settings.json"] },
		});

		await migrateLegacyBaseline(target);

		const { meta } = readInstallMetadata(join(target, ".claude"));
		expect(meta?.settings).toEqual({ merged: ["settings.json"] });
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
