import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { findOrphans, DEFAULT_ORPHAN_ALLOWLIST } from "../src/core/find-orphans.js";
import type { Manifest } from "../src/core/compute-checksums.js";

let claudeDir: string;

beforeEach(() => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "find-orphans-"));
	claudeDir = path.join(tmp, ".claude");
	fs.mkdirSync(path.join(claudeDir, "rules"), { recursive: true });
	fs.mkdirSync(path.join(claudeDir, "skills", "mk:foo"), { recursive: true });
	fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });
	fs.mkdirSync(path.join(claudeDir, "hooks"), { recursive: true });
	fs.mkdirSync(path.join(claudeDir, "memory"), { recursive: true }); // user-private — must NOT be inspected
});

afterEach(() => {
	try {
		fs.rmSync(path.dirname(claudeDir), { recursive: true, force: true });
	} catch {
		/* ignore */
	}
});

function manifestWith(paths: string[]): Manifest {
	const checksums: Manifest["checksums"] = {};
	for (const p of paths) checksums[p] = { sha256: "deadbeef", layer: "core" };
	return { version: "test", generatedAt: "2026-05-09", checksums };
}

describe("findOrphans", () => {
	it("returns empty when disk matches manifest exactly", () => {
		fs.writeFileSync(path.join(claudeDir, "rules", "security-rules.md"), "x");
		const orphans = findOrphans({
			claudeDir,
			manifest: manifestWith(["rules/security-rules.md"]),
		});
		expect(orphans).toEqual([]);
	});

	it("detects a file on disk that is not in the manifest", () => {
		fs.writeFileSync(path.join(claudeDir, "rules", "security-rules.md"), "x");
		fs.writeFileSync(path.join(claudeDir, "rules", "deprecated-old-rule.md"), "stale");
		const orphans = findOrphans({
			claudeDir,
			manifest: manifestWith(["rules/security-rules.md"]),
		});
		expect(orphans).toEqual(["rules/deprecated-old-rule.md"]);
	});

	it("respects the allowlist (custom-* and user-*)", () => {
		fs.writeFileSync(path.join(claudeDir, "rules", "custom-policy.md"), "user");
		fs.writeFileSync(path.join(claudeDir, "rules", "user-overrides.md"), "user");
		fs.writeFileSync(path.join(claudeDir, "rules", "obsolete.md"), "stale");
		const orphans = findOrphans({
			claudeDir,
			manifest: manifestWith([]),
		});
		expect(orphans).toEqual(["rules/obsolete.md"]);
	});

	it("never inspects user-private dirs (memory/, logs/)", () => {
		fs.writeFileSync(path.join(claudeDir, "memory", "lessons.md"), "private");
		const orphans = findOrphans({
			claudeDir,
			manifest: manifestWith([]),
		});
		expect(orphans).toEqual([]); // memory/ is outside default scopes
	});

	it("walks subdirectories under skills/", () => {
		fs.writeFileSync(path.join(claudeDir, "skills", "mk:foo", "SKILL.md"), "x");
		fs.writeFileSync(path.join(claudeDir, "skills", "mk:foo", "stale-helper.md"), "stale");
		const orphans = findOrphans({
			claudeDir,
			manifest: manifestWith(["skills/mk:foo/SKILL.md"]),
		});
		expect(orphans).toEqual(["skills/mk:foo/stale-helper.md"]);
	});

	it("returns empty array when claudeDir does not exist", () => {
		const missing = path.join(os.tmpdir(), "definitely-not-a-dir-" + Date.now());
		const orphans = findOrphans({
			claudeDir: missing,
			manifest: manifestWith([]),
		});
		expect(orphans).toEqual([]);
	});

	it("DEFAULT_ORPHAN_ALLOWLIST exempts the documented patterns", () => {
		// Sanity check: the allowlist regexes match the patterns the plan spec listed.
		const matches = (s: string) => DEFAULT_ORPHAN_ALLOWLIST.some((re) => re.test(s));
		expect(matches("rules/custom-foo.md")).toBe(true);
		expect(matches("rules/user-bar.md")).toBe(true);
		expect(matches("agents/something.local.md")).toBe(true);
		expect(matches("rules/security-rules.md")).toBe(false);
	});

	it("custom scopes override defaults", () => {
		fs.writeFileSync(path.join(claudeDir, "rules", "stale.md"), "x");
		fs.writeFileSync(path.join(claudeDir, "agents", "stale.md"), "x");
		const orphans = findOrphans({
			claudeDir,
			manifest: manifestWith([]),
			scopes: ["agents"], // exclude rules/
		});
		expect(orphans).toEqual(["agents/stale.md"]);
	});

	it("symlinks are skipped (scope-boundary guarantee — no path traversal)", () => {
		// Create a target outside .claude/, then symlink it into rules/.
		// Without lstat skip, walk() would return a path with `..` segments
		// and the caller's unlinkSync could delete the external target.
		const externalDir = path.join(path.dirname(claudeDir), "external");
		fs.mkdirSync(externalDir, { recursive: true });
		const externalFile = path.join(externalDir, "secret.md");
		fs.writeFileSync(externalFile, "outside-scope");

		fs.symlinkSync(externalFile, path.join(claudeDir, "rules", "linked.md"));

		const orphans = findOrphans({
			claudeDir,
			manifest: manifestWith([]),
		});
		expect(orphans).toEqual([]); // symlink skipped — never reported as orphan
		// Target must still exist (proves no follow + delete pathway exists).
		expect(fs.existsSync(externalFile)).toBe(true);
	});

	it("orphans are sorted lexicographically", () => {
		fs.writeFileSync(path.join(claudeDir, "rules", "z-late.md"), "x");
		fs.writeFileSync(path.join(claudeDir, "rules", "a-early.md"), "x");
		fs.writeFileSync(path.join(claudeDir, "agents", "m-middle.md"), "x");
		const orphans = findOrphans({
			claudeDir,
			manifest: manifestWith([]),
		});
		expect(orphans).toEqual(["agents/m-middle.md", "rules/a-early.md", "rules/z-late.md"]);
	});
});
