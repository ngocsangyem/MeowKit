import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { smartUpdate } from "../smart-update.js";
import { buildManifest, writeManifest } from "../compute-checksums.js";
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
	const root = await mkdtemp(join(tmpdir(), "mewkit-deletions-"));
	tempDirs.push(root);
	return root;
}

async function writeText(root: string, relPath: string, content: string): Promise<void> {
	const full = join(root, relPath);
	await mkdir(join(full, ".."), { recursive: true });
	await writeFile(full, content, "utf-8");
}

/** Source release that ships `files` and declares `deletions[]`. */
async function makeSource(
	version: string,
	files: Record<string, string>,
	deletions: string[],
): Promise<string> {
	const source = await makeTempRoot();
	const manifestFiles: Array<{ path: string; checksum: string }> = [];
	for (const [rel, content] of Object.entries(files)) {
		await writeText(source, `.claude/${rel}`, content);
		manifestFiles.push({ path: rel, checksum: "x" });
	}
	await writeFile(
		join(source, "release-manifest.json"),
		JSON.stringify({ version, generatedAt: "2026-05-30T00:00:00.000Z", files: manifestFiles, deletions }),
		"utf-8",
	);
	return source;
}

/** Seed a target with a prior legacy install recording the given kit files pristine. */
async function seedInstall(target: string, files: Record<string, string>): Promise<void> {
	for (const [rel, content] of Object.entries(files)) {
		await writeText(target, `.claude/${rel}`, content);
	}
	writeManifest(join(target, ".claude"), buildManifest(join(target, ".claude")));
}

describe("smartUpdate deletions processing", () => {
	it("deletes a pristine kit-owned listed file", async () => {
		const source = await makeSource("2.9.20", { "rules/keep.md": "keep\n" }, ["rules/old.md"]);
		const target = await makeTempRoot();
		await seedInstall(target, { "rules/old.md": "shipped\n" });

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: true, assumeYes: true });

		expect(stats.deletionsDeleted).toEqual(["rules/old.md"]);
		expect(existsSync(join(target, ".claude/rules/old.md"))).toBe(false);
	});

	it("preserves and reports a user-modified listed file", async () => {
		const source = await makeSource("2.9.20", { "rules/keep.md": "keep\n" }, ["rules/old.md"]);
		const target = await makeTempRoot();
		await seedInstall(target, { "rules/old.md": "shipped\n" });
		// User edits the file after the prior install was recorded.
		await writeText(target, ".claude/rules/old.md", "user edit\n");

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: true, assumeYes: true });

		expect(stats.deletionsDeleted).toEqual([]);
		expect(stats.deletionsSkipped).toContain("rules/old.md");
		expect(existsSync(join(target, ".claude/rules/old.md"))).toBe(true);
	});

	it("treats an absent listed path as a no-op", async () => {
		const source = await makeSource("2.9.20", { "rules/keep.md": "keep\n" }, ["rules/ghost.md"]);
		const target = await makeTempRoot();
		await seedInstall(target, { "rules/keep-prior.md": "x\n" });

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: true, assumeYes: true });

		expect(stats.deletionsAlreadyGone).toEqual(["rules/ghost.md"]);
		expect(stats.deletionsDeleted).toEqual([]);
	});

	it("previews deletions in dryRun without removing anything", async () => {
		const source = await makeSource("2.9.20", { "rules/keep.md": "keep\n" }, ["rules/old.md"]);
		const target = await makeTempRoot();
		await seedInstall(target, { "rules/old.md": "shipped\n" });

		const stats = await smartUpdate(config, source, target, /* dryRun */ true, false, { cleanup: true, assumeYes: true });

		expect(stats.deletionsPreview).toEqual(["rules/old.md"]);
		expect(stats.deletionsDeleted).toEqual([]);
		expect(existsSync(join(target, ".claude/rules/old.md"))).toBe(true);
	});

	it("suppresses deletions entirely under --no-cleanup", async () => {
		const source = await makeSource("2.9.20", { "rules/keep.md": "keep\n" }, ["rules/old.md"]);
		const target = await makeTempRoot();
		await seedInstall(target, { "rules/old.md": "shipped\n" });

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: false, assumeYes: true });

		expect(stats.deletionsDeleted).toEqual([]);
		expect(stats.deletionsSkipped).toEqual([]);
		expect(stats.deletionsAlreadyGone).toEqual([]);
		expect(existsSync(join(target, ".claude/rules/old.md"))).toBe(true);
	});

	it("never deletes a path that escapes .claude/", async () => {
		const source = await makeSource("2.9.20", { "rules/keep.md": "keep\n" }, ["../escape.md"]);
		const target = await makeTempRoot();
		await seedInstall(target, { "rules/keep-prior.md": "x\n" });
		await writeText(target, "escape.md", "outside\n");

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: true, assumeYes: true });

		expect(stats.deletionsSkipped).toContain("../escape.md");
		expect(stats.deletionsDeleted).toEqual([]);
		expect(existsSync(join(target, "escape.md"))).toBe(true);
	});
});
