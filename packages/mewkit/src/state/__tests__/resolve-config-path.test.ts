// The config resolver decides which file a project's settings are read from, so an install
// created before the move must keep working. These cover the four shapes a project can be in.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { configWritePath, resolveConfigPath, usingLegacyConfig } from "../resolve-config-path.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function makeRoot(shape: "empty" | "legacy" | "canonical" | "both"): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-config-"));
	roots.push(root);
	if (shape === "legacy" || shape === "both") {
		mkdirSync(join(root, ".claude"), { recursive: true });
		writeFileSync(join(root, ".claude", "meowkit.config.json"), "{}");
	}
	if (shape === "canonical" || shape === "both") {
		mkdirSync(join(root, ".meowkit"), { recursive: true });
		writeFileSync(join(root, ".meowkit", "config.json"), "{}");
	}
	return root;
}

describe("resolveConfigPath", () => {
	it("writes to `.meowkit/config.json` regardless of what exists", () => {
		for (const shape of ["empty", "legacy", "canonical", "both"] as const) {
			const root = makeRoot(shape);
			expect(configWritePath(root)).toBe(join(root, ".meowkit", "config.json"));
		}
	});

	it("reads the canonical file when it exists", () => {
		const root = makeRoot("canonical");
		expect(resolveConfigPath(root)).toBe(join(root, ".meowkit", "config.json"));
		expect(usingLegacyConfig(root)).toBe(false);
	});

	it("falls back to a pre-move install so upgrading does not orphan its config", () => {
		const root = makeRoot("legacy");
		expect(resolveConfigPath(root)).toBe(join(root, ".claude", "meowkit.config.json"));
		expect(usingLegacyConfig(root)).toBe(true);
	});

	it("prefers the canonical file once both exist, so a migrated project stops reading the old one", () => {
		const root = makeRoot("both");
		expect(resolveConfigPath(root)).toBe(join(root, ".meowkit", "config.json"));
		expect(usingLegacyConfig(root)).toBe(false);
	});

	it("reports the path it would create when neither exists, never a legacy path", () => {
		const root = makeRoot("empty");
		expect(resolveConfigPath(root)).toBe(join(root, ".meowkit", "config.json"));
		expect(usingLegacyConfig(root)).toBe(false);
	});
});
