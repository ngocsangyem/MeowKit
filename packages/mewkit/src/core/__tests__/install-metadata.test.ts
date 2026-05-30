import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	buildInstallMetadata,
	CorruptInstallMetadataError,
	indexByPath,
	readInstallMetadata,
} from "../install-metadata.js";
import { writeInstallMetadata } from "../install-metadata-writer.js";
import { buildManifest, hashFile, writeManifest } from "../compute-checksums.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeClaudeDir(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-install-meta-"));
	tempDirs.push(root);
	const claudeDir = join(root, ".claude");
	await mkdir(claudeDir, { recursive: true });
	return claudeDir;
}

async function writeFileAt(claudeDir: string, relPath: string, content: string): Promise<void> {
	const full = join(claudeDir, relPath);
	await mkdir(join(full, ".."), { recursive: true });
	await writeFile(full, content, "utf-8");
}

describe("readInstallMetadata precedence", () => {
	it("returns source=none for an absent metadata", async () => {
		const claudeDir = await makeClaudeDir();
		const result = readInstallMetadata(claudeDir);
		expect(result.source).toBe("none");
		expect(result.meta).toBeNull();
	});

	it("returns source=new for a schemaVersion-bearing metadata.json", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "shipped\n");
		const meta = buildInstallMetadata(claudeDir, { version: "2.9.13" });
		await writeInstallMetadata(claudeDir, meta);

		const result = readInstallMetadata(claudeDir);
		expect(result.source).toBe("new");
		expect(result.meta?.version).toBe("2.9.13");
		expect(result.meta?.files.length).toBe(1);
	});

	it("returns source=legacy-manifest and does NOT trust manifest.version", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "shipped\n");
		writeManifest(claudeDir, buildManifest(claudeDir));

		const result = readInstallMetadata(claudeDir);
		expect(result.source).toBe("legacy-manifest");
		// manifest.version is the hardcoded "0.2.0" garbage — must not leak through.
		expect(result.meta?.version).not.toBe("0.2.0");
		expect(result.meta?.version).toBe("");
		// sha256 maps to both checksum and baseChecksum.
		const entry = result.meta?.files[0];
		expect(entry?.checksum).toBe(entry?.baseChecksum);
	});

	it("sources version from a sibling version-only metadata.json under legacy-manifest", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "shipped\n");
		writeManifest(claudeDir, buildManifest(claudeDir));
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify({ version: "2.8.0" }) + "\n", "utf-8");

		const result = readInstallMetadata(claudeDir);
		expect(result.source).toBe("legacy-manifest");
		expect(result.meta?.version).toBe("2.8.0");
	});

	it("returns source=legacy-metadata for a version-only metadata.json", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify({ version: "2.8.0" }) + "\n", "utf-8");

		const result = readInstallMetadata(claudeDir);
		expect(result.source).toBe("legacy-metadata");
		expect(result.meta?.version).toBe("2.8.0");
		expect(result.meta?.files).toEqual([]);
	});

	it("throws on a corrupt schemaVersion-bearing metadata.json instead of falling through", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFile(
			join(claudeDir, "metadata.json"),
			JSON.stringify({ schemaVersion: "1.0", version: 123 }) + "\n",
			"utf-8",
		);

		expect(() => readInstallMetadata(claudeDir)).toThrow(CorruptInstallMetadataError);
	});
});

describe("buildInstallMetadata ownership", () => {
	it("labels a fresh kit file as meowkit", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "shipped\n");
		const meta = buildInstallMetadata(claudeDir, { version: "2.9.13" });
		expect(meta.files[0]?.owner).toBe("meowkit");
	});

	it("labels an edited kit file as meowkit-modified and preserves baseChecksum", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "shipped\n");
		const shippedHash = hashFile(join(claudeDir, "rules/a.md"));
		const prior = indexByPath(buildInstallMetadata(claudeDir, { version: "2.9.13" }).files);

		// User edits the kit file, then we rebuild against the prior state.
		await writeFileAt(claudeDir, "rules/a.md", "user edit\n");
		const meta = buildInstallMetadata(claudeDir, { version: "2.9.14", priorEntriesByPath: prior });

		const entry = meta.files[0];
		expect(entry?.owner).toBe("meowkit-modified");
		expect(entry?.baseChecksum).toBe(shippedHash);
		expect(entry?.checksum).not.toBe(shippedHash);
	});

	it("keeps a user-layer file labeled user", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "memory/notes.md", "mine\n");
		const meta = buildInstallMetadata(claudeDir, { version: "2.9.13" });
		expect(meta.files[0]?.owner).toBe("user");
		expect(meta.files[0]?.layer).toBe("user");
	});

	it("never scans the CLI's own metadata.json or lock into files[]", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "shipped\n");
		// Simulate a prior install: metadata.json + a stale lock already on disk.
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify({ schemaVersion: "1.0" }), "utf-8");
		await writeFile(join(claudeDir, ".metadata.lock"), "123\n", "utf-8");

		const meta = buildInstallMetadata(claudeDir, { version: "2.9.14" });
		const paths = meta.files.map((f) => f.path);
		expect(paths).toContain("rules/a.md");
		expect(paths).not.toContain("metadata.json");
		expect(paths).not.toContain(".metadata.lock");
	});

	it("attaches sourceTimestamp from the injected per-path map", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "shipped\n");
		const meta = buildInstallMetadata(claudeDir, {
			version: "2.9.13",
			sourceTimestamps: { "rules/a.md": "2026-05-09T00:12:45+07:00" },
		});
		expect(meta.files[0]?.sourceTimestamp).toBe("2026-05-09T00:12:45+07:00");
	});
});

describe("writeInstallMetadata round-trip", () => {
	it("round-trips identically through read", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "shipped\n");
		await writeFileAt(claudeDir, "skills/x/SKILL.md", "skill\n");
		const meta = buildInstallMetadata(claudeDir, { version: "2.9.13" });
		await writeInstallMetadata(claudeDir, meta);

		const result = readInstallMetadata(claudeDir);
		expect(result.source).toBe("new");
		expect(result.meta).toEqual(meta);
	});
});
