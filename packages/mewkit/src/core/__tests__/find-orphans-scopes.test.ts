// `.claude/scripts/` is kit-owned and was missing from the orphan scopes, so any script a
// release stopped shipping stayed on disk forever. The retired MEMORY MIGRATORS are the case
// that matters: a leftover migrator keeps offering to rebuild a store the current version no
// longer has, and the kit's instruction-class files it references no longer exist.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ORPHAN_SCOPES, findOrphans } from "../find-orphans.js";
import type { Manifest } from "../compute-checksums.js";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function makeClaudeDir(files: string[]): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-orphan-scope-"));
	dirs.push(root);
	const claudeDir = join(root, ".claude");
	for (const rel of files) {
		const full = join(claudeDir, rel);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, "x", "utf-8");
	}
	return claudeDir;
}

/** A manifest that ships exactly `shipped`. */
function manifest(shipped: string[]): Manifest {
	const checksums: Record<string, string> = {};
	for (const rel of shipped) checksums[rel] = "deadbeef";
	return { version: "3.0.0", checksums } as unknown as Manifest;
}

describe("DEFAULT_ORPHAN_SCOPES", () => {
	it("covers scripts/, so a retired script is detectable", () => {
		expect(DEFAULT_ORPHAN_SCOPES).toContain("scripts");
	});

	it("flags the retired memory migrators left by an upgrade", () => {
		const claudeDir = makeClaudeDir([
			"scripts/memory-migrator.cjs",
			"scripts/memory-topic-file-migrator.cjs",
			"scripts/still-shipped.cjs",
		]);
		const orphans = findOrphans({ claudeDir, manifest: manifest(["scripts/still-shipped.cjs"]) });
		expect(orphans.sort()).toEqual(["scripts/memory-migrator.cjs", "scripts/memory-topic-file-migrator.cjs"]);
	});

	it("leaves a shipped script alone", () => {
		const claudeDir = makeClaudeDir(["scripts/still-shipped.cjs"]);
		expect(findOrphans({ claudeDir, manifest: manifest(["scripts/still-shipped.cjs"]) })).toEqual([]);
	});
});
