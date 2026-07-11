import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
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

describe("buildInstallMetadata forward-copy provenance", () => {
	it("labels a clean forward copy of a CHANGED file as meowkit and advances baseChecksum", async () => {
		const claudeDir = await makeClaudeDir();
		// v1 shipped and recorded as the prior baseline.
		await writeFileAt(claudeDir, "rules/a.md", "v1 shipped\n");
		const v1Hash = hashFile(join(claudeDir, "rules/a.md"));
		const prior = indexByPath(buildInstallMetadata(claudeDir, { version: "2.9.13" }).files);
		expect(prior["rules/a.md"]?.baseChecksum).toBe(v1Hash);

		// A forward upgrade cleanly overwrites the file with the v2 payload.
		await writeFileAt(claudeDir, "rules/a.md", "v2 shipped\n");
		const v2Hash = hashFile(join(claudeDir, "rules/a.md"));
		expect(v2Hash).not.toBe(v1Hash);

		const meta = buildInstallMetadata(claudeDir, {
			version: "2.9.14",
			priorEntriesByPath: prior,
			expectedChecksums: { "rules/a.md": v2Hash },
		});

		const entry = meta.files[0];
		// The bug: without expectedChecksums this was mislabeled meowkit-modified
		// because v2 disk != v1 prior baseChecksum.
		expect(entry?.owner).toBe("meowkit");
		// Baseline advances to the new payload so the NEXT upgrade compares correctly.
		expect(entry?.baseChecksum).toBe(v2Hash);
	});

	it("labels disk that differs from the incoming payload (no prior) as meowkit-modified with base=expected", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "user edited before we tracked it\n");
		const meta = buildInstallMetadata(claudeDir, {
			version: "2.9.14",
			expectedChecksums: { "rules/a.md": "deadbeefexpectedhash" },
		});
		const entry = meta.files[0];
		expect(entry?.owner).toBe("meowkit-modified");
		expect(entry?.baseChecksum).toBe("deadbeefexpectedhash");
	});

	it("without expectedChecksums, a changed file stays meowkit-modified (backward compatible)", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/a.md", "v1\n");
		const prior = indexByPath(buildInstallMetadata(claudeDir, { version: "2.9.13" }).files);
		await writeFileAt(claudeDir, "rules/a.md", "v2\n");
		const meta = buildInstallMetadata(claudeDir, { version: "2.9.14", priorEntriesByPath: prior });
		expect(meta.files[0]?.owner).toBe("meowkit-modified");
	});

	it("recognizes a clean forward copy at a NESTED path (forward-slash manifest key)", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "skills/foo/bar/deep.md", "v1\n");
		const prior = indexByPath(buildInstallMetadata(claudeDir, { version: "2.9.13" }).files);
		await writeFileAt(claudeDir, "skills/foo/bar/deep.md", "v2\n");
		const v2Hash = hashFile(join(claudeDir, "skills/foo/bar/deep.md"));
		const meta = buildInstallMetadata(claudeDir, {
			version: "2.9.14",
			priorEntriesByPath: prior,
			// Manifest keys are always forward-slash; the builder normalizes the scan key
			// so this matches even where the OS scan would use backslashes.
			expectedChecksums: { "skills/foo/bar/deep.md": v2Hash },
		});
		expect(meta.files[0]?.owner).toBe("meowkit");
		expect(meta.files[0]?.baseChecksum).toBe(v2Hash);
	});

	it("keeps a merged settings.json labeled meowkit on fresh install, not meowkit-modified", async () => {
		const claudeDir = await makeClaudeDir();
		// Disk is the merged result; the incoming shipped payload differs.
		await writeFileAt(claudeDir, "settings.json", '{"permissions":{"allow":["Bash(git status)","Bash(npm test)"]}}\n');
		const meta = buildInstallMetadata(claudeDir, {
			version: "2.9.14",
			expectedChecksums: { "settings.json": "shipped-payload-hash-differs" },
			mergedSettings: ["settings.json"],
		});
		const entry = meta.files[0];
		expect(entry?.owner).toBe("meowkit");
		// Not counted as locally modified — the merge is recorded via meta.settings.merged.
		expect(entry?.baseChecksum).toBe(hashFile(join(claudeDir, "settings.json")));
	});

	it("skips a symlink under .claude/ instead of following it into the scan", async () => {
		const claudeDir = await makeClaudeDir();
		await writeFileAt(claudeDir, "rules/real.md", "shipped\n");
		// A symlink pointing at the real file — must not be scanned/hashed.
		await symlink(join(claudeDir, "rules/real.md"), join(claudeDir, "rules/link.md"));
		const meta = buildInstallMetadata(claudeDir, { version: "2.9.14" });
		const paths = meta.files.map((f) => f.path);
		expect(paths).toContain("rules/real.md");
		expect(paths).not.toContain("rules/link.md");
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
