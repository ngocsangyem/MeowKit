import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildInstalledBackRef, resolveInstalledBackRef } from "../install-metadata-backref.js";
import { buildInstallMetadata } from "../install-metadata.js";
import { writeInstallMetadata } from "../install-metadata-writer.js";
import { writeFile } from "node:fs/promises";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeSourceWithInstall(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-backref-"));
	tempDirs.push(root);
	const claudeDir = join(root, ".claude");
	await mkdir(join(claudeDir, "skills", "demo"), { recursive: true });
	await writeFile(join(claudeDir, "skills", "demo", "SKILL.md"), "skill\n", "utf-8");
	const meta = buildInstallMetadata(claudeDir, { version: "2.9.20" });
	await writeInstallMetadata(claudeDir, meta);
	return root;
}

describe("buildInstalledBackRef", () => {
	it("returns null when the source has no installed metadata", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-backref-empty-"));
		tempDirs.push(root);
		expect(buildInstalledBackRef(root)).toBeNull();
	});

	it("captures version and indexed entries from the source install", async () => {
		const root = await makeSourceWithInstall();
		const backRef = buildInstalledBackRef(root);
		expect(backRef?.version).toBe("2.9.20");
		expect(backRef?.entriesByPath["skills/demo/SKILL.md"]).toBeDefined();
	});
});

describe("resolveInstalledBackRef", () => {
	it("returns {} for a null back-ref", () => {
		expect(resolveInstalledBackRef(null, "/anything")).toEqual({});
	});

	it("resolves version and checksum for an in-scope asset", async () => {
		const root = await makeSourceWithInstall();
		const backRef = buildInstalledBackRef(root);
		const absPath = join(root, ".claude", "skills", "demo", "SKILL.md");
		const resolved = resolveInstalledBackRef(backRef, absPath);
		expect(resolved.installedVersion).toBe("2.9.20");
		expect(resolved.installedChecksum).toMatch(/^[a-f0-9]{64}$/);
	});

	it("keeps the version but omits checksum for an out-of-scope asset path", async () => {
		const root = await makeSourceWithInstall();
		const backRef = buildInstalledBackRef(root);
		const resolved = resolveInstalledBackRef(backRef, "/somewhere/else/file.md");
		expect(resolved.installedVersion).toBe("2.9.20");
		expect(resolved.installedChecksum).toBeUndefined();
	});
});
