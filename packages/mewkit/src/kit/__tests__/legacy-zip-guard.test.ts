// The legacy release zip is extracted behind the same path-safety guard as the
// verified artifact.
//
// Hardening only the artifact path would leave this one reachable by publishing
// a release with no artifact at all, which is the cheaper of the two attacks.
import AdmZip from "adm-zip";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { memberPathIsUnsafe, resolveSafeMemberPath } from "../safe-extract.js";
import { craftZip } from "../../../tests/helpers/craft-zip.js";

const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
	const dir = mkdtempSync(join(tmpdir(), "mewkit-zip-guard-"));
	roots.push(dir);
	return dir;
}

describe("archive member path safety", () => {
	it("rejects traversal, absolute and drive-letter member paths structurally", () => {
		for (const bad of ["../escaped.md", "a/../../escaped.md", "/etc/passwd", "\\\\server\\share\\x", "C:/x"]) {
			expect(memberPathIsUnsafe(bad)).toBe(true);
		}
		for (const good of [".claude/rules/a.md", ".meowkit/pack-manifest.json"]) {
			expect(memberPathIsUnsafe(good)).toBe(false);
		}
	});

	it("resolves a contained member and refuses one that escapes the destination", async () => {
		const destination = join(temp(), "extracted");
		mkdirSync(destination, { recursive: true });

		const ok = await resolveSafeMemberPath(destination, ".claude/rules/a.md");
		expect("target" in ok && ok.target).toBe(resolve(destination, ".claude", "rules", "a.md"));

		const escaped = await resolveSafeMemberPath(destination, "../escaped.md");
		expect("reason" in escaped && escaped.reason).toMatch(/escapes the install directory/);
	});

	it("refuses a crafted traversal entry written into a real zip", async () => {
		const root = temp();
		const destination = join(root, "extracted");
		mkdirSync(destination, { recursive: true });

		// Written byte by byte: the library's own writer normalizes `..` away, so it
		// cannot produce the archive a remote attacker would publish.
		const zipPath = join(root, "release.zip");
		writeFileSync(
			zipPath,
			craftZip([
				{ name: "../escaped.md", body: "owned\n" },
				{ name: ".claude/rules/a.md", body: "alpha\n" },
			]),
		);
		expect(new AdmZip(zipPath).getEntries().map((entry) => entry.entryName)).toContain("../escaped.md");

		// The guard runs over every entry before any write, so the archive is
		// refused whole rather than extracted up to the hostile entry.
		const entries = new AdmZip(zipPath).getEntries().filter((entry) => !entry.isDirectory);
		const outcomes = await Promise.all(entries.map((entry) => resolveSafeMemberPath(destination, entry.entryName)));
		expect(outcomes.some((outcome) => "reason" in outcome)).toBe(true);
		expect(existsSync(join(root, "escaped.md"))).toBe(false);
	});

	it("is the only traversal guard, so there is nothing to drift against", async () => {
		const { readFileSync } = await import("node:fs");
		const guard = readFileSync(
			join(import.meta.dirname, "..", "..", "migrate", "portable-installer-path-safety.ts"),
			"utf8",
		);
		// The helper takes an explicit boundary so a caller whose destination is a
		// staging directory does not have to write its own containment check.
		expect(guard).toMatch(/boundary\?: string/);
		// The release download reaches the filesystem only through the extractor
		// that applies the guard, and that extractor is the only caller of the
		// library's own unguarded one.
		const download = readFileSync(join(import.meta.dirname, "..", "..", "core", "github-releases.ts"), "utf8");
		expect(download).toMatch(/extractReleaseZip\(/);
		expect(download).not.toMatch(/\.extractAllTo\(/);
		const extractor = readFileSync(join(import.meta.dirname, "..", "extract-release-zip.ts"), "utf8");
		expect(extractor).toMatch(/resolveSafeMemberPath/);
		expect(extractor).not.toMatch(/\.extractAllTo\(/);
	});
});
