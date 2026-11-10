// Provenance is recorded as an added object, with a closed origin, and the
// fields every existing reader depends on are untouched.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
	INSTALL_ORIGINS,
	InstallMetadataSchema,
	buildInstallMetadata,
	readInstallMetadata,
} from "../install-metadata.js";
import { writeInstallMetadata } from "../install-metadata-writer.js";
import { recordProvenance } from "../record-provenance.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeProject(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-provenance-"));
	tempDirs.push(root);
	await mkdir(join(root, ".claude", "rules"), { recursive: true });
	await writeFile(join(root, ".claude", "rules", "a.md"), "alpha\n", "utf-8");
	return root;
}

describe("install provenance", () => {
	it("records every field for an install, without moving version or scope", async () => {
		const root = await makeProject();
		const claudeDir = join(root, ".claude");
		await writeInstallMetadata(root, buildInstallMetadata(claudeDir, { version: "2.15.0", scope: "local" }));

		expect(
			await recordProvenance(root, {
				kitVersion: "2.15.0",
				cliVersion: "2.3.1",
				target: "claude-code",
				delivery: "plugin",
				origin: "verified-artifact",
			}),
		).toBe(true);

		const meta = readInstallMetadata(claudeDir).meta;
		expect(meta?.provenance).toEqual({
			kitVersion: "2.15.0",
			cliVersion: "2.3.1",
			target: "claude-code",
			delivery: "plugin",
			origin: "verified-artifact",
		});
		// `version` IS the kit version, and `scope` stays where every reader finds
		// it. Renaming either would break them all to say the same thing in a
		// different word.
		expect(meta?.version).toBe("2.15.0");
		expect(meta?.scope).toBe("local");
	});

	it("closes the origin set, so an unexpected value is a validation error", () => {
		expect([...INSTALL_ORIGINS]).toEqual(["verified-artifact", "release-zip", "local-release-dir", "local-cache"]);
		const base = {
			schemaVersion: "1.0" as const,
			tool: "meowkit",
			version: "2.15.0",
			installedAt: "",
			files: [],
		};
		const provenance = { kitVersion: "2.15.0", cliVersion: "2.3.1", target: "claude-code", delivery: "native" };
		expect(
			InstallMetadataSchema.safeParse({ ...base, provenance: { ...provenance, origin: "somewhere" } }).success,
		).toBe(false);
		expect(
			InstallMetadataSchema.safeParse({ ...base, provenance: { ...provenance, origin: "release-zip" } }).success,
		).toBe(true);
	});

	it("reads a record written before provenance existed without error", async () => {
		const root = await makeProject();
		const claudeDir = join(root, ".claude");
		await writeInstallMetadata(root, buildInstallMetadata(claudeDir, { version: "2.9.0" }));

		const meta = readInstallMetadata(claudeDir).meta;
		// Reported as absent rather than crashing or being invented: a project
		// installed earlier has a real kit version and no recorded target.
		expect(meta?.version).toBe("2.9.0");
		expect(meta?.provenance).toBeUndefined();
	});

	const codexFacts = {
		kitVersion: "2.15.0",
		cliVersion: "2.3.1",
		target: "codex" as const,
		delivery: "native" as const,
		origin: "local-release-dir" as const,
	};

	it("writes nothing when there is no install to describe", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-provenance-empty-"));
		tempDirs.push(root);
		// Neither a canonical record nor any of the target's own writes. A file
		// claiming an install exists where none does is worse than no file, because
		// every later reader believes it.
		expect(await recordProvenance(root, codexFacts)).toBe(false);
	});

	it("records an external target's install, which has no provider directory of its own here", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-provenance-codex-"));
		tempDirs.push(root);
		// What `init --target codex` lays down. There is no `.claude/`, and treating
		// that as "nothing installed" would make `mewkit versions` useless in exactly
		// the projects whose target is worth asking about.
		await mkdir(join(root, ".codex"), { recursive: true });

		expect(await recordProvenance(root, codexFacts)).toBe(true);
		const meta = readInstallMetadata(join(root, ".claude")).meta;
		expect(meta?.provenance).toEqual(codexFacts);
		// Per-file ownership for an external target lives in its provider ledger;
		// duplicating it here would be the second ownership answer.
		expect(meta?.files).toEqual([]);
	});
});
