// The pack manifest moved into `.meowkit/`, and its absence is a meaningful signal rather than
// a missing-file case: `check-packs` reads "no manifest" as "pack modularization not installed;
// run upgrade". So a pre-move install that is perfectly healthy must not start being told to
// upgrade because the canonical path changed under it.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hasPackManifest, packManifestPath } from "../pack-manifest.js";
import { checkPacks } from "../check-packs.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const MANIFEST = JSON.stringify({
	schemaVersion: "1.0",
	base: { files: [], globs: [], commands: [] },
	packs: { core: {} },
	profiles: { full: ["*"] },
});

function makeRoot(where: "none" | "legacy" | "canonical" | "both"): { root: string; claudeDir: string } {
	const root = mkdtempSync(join(tmpdir(), "mewkit-packman-"));
	roots.push(root);
	const claudeDir = join(root, ".claude");
	mkdirSync(claudeDir, { recursive: true });
	if (where === "legacy" || where === "both") writeFileSync(join(claudeDir, "pack-manifest.json"), MANIFEST);
	if (where === "canonical" || where === "both") {
		mkdirSync(join(root, ".meowkit"), { recursive: true });
		writeFileSync(join(root, ".meowkit", "pack-manifest.json"), MANIFEST);
	}
	return { root, claudeDir };
}

describe("pack manifest location", () => {
	it("resolves the canonical file when it exists", () => {
		const { root, claudeDir } = makeRoot("canonical");
		expect(packManifestPath(claudeDir)).toBe(join(root, ".meowkit", "pack-manifest.json"));
		expect(hasPackManifest(claudeDir)).toBe(true);
	});

	it("still finds a pre-move install's manifest", () => {
		const { claudeDir } = makeRoot("legacy");
		expect(packManifestPath(claudeDir)).toBe(join(claudeDir, "pack-manifest.json"));
		expect(hasPackManifest(claudeDir)).toBe(true);
	});

	it("prefers the canonical file once both exist", () => {
		const { root, claudeDir } = makeRoot("both");
		expect(packManifestPath(claudeDir)).toBe(join(root, ".meowkit", "pack-manifest.json"));
	});

	it("reports the path it would create when neither exists", () => {
		const { root, claudeDir } = makeRoot("none");
		expect(packManifestPath(claudeDir)).toBe(join(root, ".meowkit", "pack-manifest.json"));
		expect(hasPackManifest(claudeDir)).toBe(false);
	});

	it("does not tell a healthy pre-move install to run upgrade", () => {
		const { claudeDir } = makeRoot("legacy");
		const results = checkPacks(claudeDir);
		const infraAbsent = results.find((r) => r.name === "Pack manifest installed");
		expect(infraAbsent).toBeUndefined();
	});

	it("still reports pack modularization as absent when there is genuinely no manifest", () => {
		const { claudeDir } = makeRoot("none");
		const results = checkPacks(claudeDir, { missingInfraSeverity: "warn" });
		expect(results[0]?.name).toBe("Pack manifest installed");
		expect(results[0]?.status).toBe("warn");
	});
});
