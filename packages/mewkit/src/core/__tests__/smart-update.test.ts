import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildManifest, classifyLayer, hashFile, readManifest, writeManifest } from "../compute-checksums.js";
import { smartUpdate } from "../smart-update.js";
import { buildInstallMetadata, readInstallMetadata } from "../install-metadata.js";
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
	const root = await mkdtemp(join(tmpdir(), "mewkit-smart-update-"));
	tempDirs.push(root);
	return root;
}

async function writeText(root: string, relPath: string, content: string): Promise<void> {
	const fullPath = join(root, relPath);
	await mkdir(join(fullPath, ".."), { recursive: true });
	await writeFile(fullPath, content, "utf-8");
}

describe("smart update manifest ownership", () => {
	it("classifies manifest-relative kit paths as core", () => {
		expect(classifyLayer("rules/core-behaviors.md")).toBe("core");
		expect(classifyLayer(".claude/rules/core-behaviors.md")).toBe("user");
	});

	it("updates unchanged core files using .claude-relative manifest keys", async () => {
		const source = await makeTempRoot();
		const target = await makeTempRoot();

		await writeText(source, ".claude/rules/core-behaviors.md", "new behaviors\n");
		await writeText(source, ".claude/settings.json", "{}\n");
		await writeText(target, ".claude/rules/core-behaviors.md", "old behaviors\n");
		await writeText(target, ".claude/settings.json", "{}\n");

		const oldManifest = buildManifest(join(target, ".claude"));
		writeManifest(join(target, ".claude"), oldManifest);

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: false });

		await expect(readFile(join(target, ".claude/rules/core-behaviors.md"), "utf-8")).resolves.toBe("new behaviors\n");
		expect(stats.updated).toBeGreaterThanOrEqual(1);
		expect(stats.userModified).toEqual([]);
		const manifest = readManifest(join(target, ".claude"));
		expect(manifest?.checksums["rules/core-behaviors.md"]?.owner).toBe("meowkit");
		expect(manifest?.checksums["rules/core-behaviors.md"]?.sourceChecksum).toMatch(/^[a-f0-9]{64}$/);
	});

	it("skips user-modified core files but still merges settings.json", async () => {
		const source = await makeTempRoot();
		const target = await makeTempRoot();

		await writeText(source, ".claude/rules/core-behaviors.md", "release update\n");
		await writeText(
			source,
			".claude/settings.json",
			JSON.stringify({ permissions: { allow: ["Bash(npm test)"] }, statusLine: { type: "command" } }),
		);
		await writeText(target, ".claude/rules/core-behaviors.md", "installed behaviors\n");
		await writeText(target, ".claude/settings.json", JSON.stringify({ permissions: { allow: ["Bash(git status)"] } }));

		const oldManifest = buildManifest(join(target, ".claude"));
		writeManifest(join(target, ".claude"), oldManifest);
		await writeText(target, ".claude/rules/core-behaviors.md", "user edit\n");

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: false });

		await expect(readFile(join(target, ".claude/rules/core-behaviors.md"), "utf-8")).resolves.toBe("user edit\n");
		expect(stats.userModified).toEqual([".claude/rules/core-behaviors.md"]);

		const settings = JSON.parse(await readFile(join(target, ".claude/settings.json"), "utf-8")) as {
			permissions: { allow: string[] };
			statusLine?: unknown;
		};
		expect(settings.permissions.allow).toEqual(["Bash(git status)", "Bash(npm test)"]);
		expect(settings.statusLine).toEqual({ type: "command" });
	});
});

/** Write a release-manifest.json at the source root recording each shipped file's real checksum. */
async function writeReleaseManifest(source: string, version: string, files: string[]): Promise<void> {
	const manifestFiles = files.map((rel) => ({
		path: rel,
		checksum: hashFile(join(source, ".claude", rel)),
	}));
	await writeFile(
		join(source, "release-manifest.json"),
		JSON.stringify({ version, generatedAt: "2026-07-11T00:00:00.000Z", files: manifestFiles, deletions: [] }),
		"utf-8",
	);
}

describe("smartUpdate forward-upgrade provenance", () => {
	it("keeps a file that CHANGED between releases labeled meowkit, not meowkit-modified", async () => {
		const source = await makeTempRoot();
		const target = await makeTempRoot();

		// Prior install: v1 on disk, canonical metadata recording base=v1.
		await writeText(target, ".claude/rules/core-behaviors.md", "v1\n");
		await writeInstallMetadata(
			join(target, ".claude"),
			buildInstallMetadata(join(target, ".claude"), { version: "2.9.13" }),
		);

		// New release ships a CHANGED payload for the same file, with a release manifest.
		await writeText(source, ".claude/rules/core-behaviors.md", "v2 changed\n");
		await writeReleaseManifest(source, "2.9.14", ["rules/core-behaviors.md"]);

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: false });
		expect(stats.userModified).toEqual([]);

		const { meta } = readInstallMetadata(join(target, ".claude"));
		const entry = meta?.files.find((f) => f.path === "rules/core-behaviors.md");
		// The regression guard: a clean forward copy is toolkit-owned, base advanced.
		expect(entry?.owner).toBe("meowkit");
		expect(entry?.baseChecksum).toBe(hashFile(join(target, ".claude/rules/core-behaviors.md")));
	});

	it("fails fatally when metadata cannot be written after content mutation", async () => {
		const source = await makeTempRoot();
		const target = await makeTempRoot();

		await writeText(source, ".claude/rules/core-behaviors.md", "release\n");
		await writeReleaseManifest(source, "2.9.14", ["rules/core-behaviors.md"]);
		await writeText(target, ".claude/rules/core-behaviors.md", "old\n");
		// A directory where metadata.json belongs makes the atomic rename fail — the
		// content is copied, but the metadata write cannot complete. Must not be swallowed.
		await mkdir(join(target, ".claude/metadata.json"), { recursive: true });

		await expect(smartUpdate(config, source, target, false, false, { cleanup: false })).rejects.toThrow();
	});
});
