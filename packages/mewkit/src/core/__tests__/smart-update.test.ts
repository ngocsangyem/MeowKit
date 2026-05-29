import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildManifest, classifyLayer, readManifest, writeManifest } from "../compute-checksums.js";
import { smartUpdate } from "../smart-update.js";
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
		expect(classifyLayer("rules/primary-workflow.md")).toBe("core");
		expect(classifyLayer(".claude/rules/primary-workflow.md")).toBe("user");
	});

	it("updates unchanged core files using .claude-relative manifest keys", async () => {
		const source = await makeTempRoot();
		const target = await makeTempRoot();

		await writeText(source, ".claude/rules/primary-workflow.md", "new workflow\n");
		await writeText(source, ".claude/settings.json", "{}\n");
		await writeText(target, ".claude/rules/primary-workflow.md", "old workflow\n");
		await writeText(target, ".claude/settings.json", "{}\n");

		const oldManifest = buildManifest(join(target, ".claude"));
		writeManifest(join(target, ".claude"), oldManifest);

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: false });

		await expect(readFile(join(target, ".claude/rules/primary-workflow.md"), "utf-8")).resolves.toBe("new workflow\n");
		expect(stats.updated).toBeGreaterThanOrEqual(1);
		expect(stats.userModified).toEqual([]);
		const manifest = readManifest(join(target, ".claude"));
		expect(manifest?.checksums["rules/primary-workflow.md"]?.owner).toBe("meowkit");
		expect(manifest?.checksums["rules/primary-workflow.md"]?.sourceChecksum).toMatch(/^[a-f0-9]{64}$/);
	});

	it("skips user-modified core files but still merges settings.json", async () => {
		const source = await makeTempRoot();
		const target = await makeTempRoot();

		await writeText(source, ".claude/rules/primary-workflow.md", "release update\n");
		await writeText(
			source,
			".claude/settings.json",
			JSON.stringify({ permissions: { allow: ["Bash(npm test)"] }, statusLine: { type: "command" } }),
		);
		await writeText(target, ".claude/rules/primary-workflow.md", "installed workflow\n");
		await writeText(target, ".claude/settings.json", JSON.stringify({ permissions: { allow: ["Bash(git status)"] } }));

		const oldManifest = buildManifest(join(target, ".claude"));
		writeManifest(join(target, ".claude"), oldManifest);
		await writeText(target, ".claude/rules/primary-workflow.md", "user edit\n");

		const stats = await smartUpdate(config, source, target, false, false, { cleanup: false });

		await expect(readFile(join(target, ".claude/rules/primary-workflow.md"), "utf-8")).resolves.toBe("user edit\n");
		expect(stats.userModified).toEqual([".claude/rules/primary-workflow.md"]);

		const settings = JSON.parse(await readFile(join(target, ".claude/settings.json"), "utf-8")) as {
			permissions: { allow: string[] };
			statusLine?: unknown;
		};
		expect(settings.permissions.allow).toEqual(["Bash(git status)", "Bash(npm test)"]);
		expect(settings.statusLine).toEqual({ type: "command" });
	});
});
