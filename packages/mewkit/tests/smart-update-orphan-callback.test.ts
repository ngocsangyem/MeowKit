import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { smartUpdate } from "../src/core/smart-update.js";
import type { UserConfig } from "../src/core/substitute-placeholders.js";

let tmp: string;
let sourceDir: string;
let targetDir: string;

const config: UserConfig = {
	description: "",
	enableCostTracking: true,
	enableMemory: true,
	geminiApiKey: null,
};

beforeEach(() => {
	tmp = fs.mkdtempSync(path.join(os.tmpdir(), "smart-update-cb-"));
	sourceDir = path.join(tmp, "source");
	targetDir = path.join(tmp, "target");

	// Source release: ships rules/keep.md only
	fs.mkdirSync(path.join(sourceDir, ".claude", "rules"), { recursive: true });
	fs.writeFileSync(path.join(sourceDir, ".claude", "rules", "keep.md"), "kept");
	fs.writeFileSync(
		path.join(sourceDir, "release-manifest.json"),
		JSON.stringify({
			version: "v9.9.9",
			generatedAt: "2026-05-09",
			files: [{ path: "rules/keep.md", checksum: "deadbeef" }],
		}),
	);

	// Target: has keep.md + an orphan stale.md
	fs.mkdirSync(path.join(targetDir, ".claude", "rules"), { recursive: true });
	fs.writeFileSync(path.join(targetDir, ".claude", "rules", "keep.md"), "kept");
	fs.writeFileSync(path.join(targetDir, ".claude", "rules", "stale.md"), "stale");
	// Prior meowkit install — gates orphan cleanup. Without this file present,
	// smartUpdate skips orphan cleanup entirely (fresh / non-meowkit .claude/).
	fs.writeFileSync(
		path.join(targetDir, ".claude", "meowkit.manifest.json"),
		JSON.stringify({ version: "v0", generatedAt: "2026-05-09", checksums: {} }),
	);
});

afterEach(() => {
	try {
		fs.rmSync(tmp, { recursive: true, force: true });
	} catch {
		/* ignore */
	}
});

describe("smartUpdate confirmOrphans callback", () => {
	it("invokes the callback with the orphan list and deletes when it returns true", async () => {
		let received: string[] | null = null;
		const stats = await smartUpdate(config, sourceDir, targetDir, false, false, {
			confirmOrphans: async (orphans) => {
				received = orphans;
				return true;
			},
		});

		expect(received).toEqual(["rules/stale.md"]);
		expect(stats.orphansDeleted).toEqual(["rules/stale.md"]);
		expect(stats.orphansSkipped).toEqual([]);
		expect(fs.existsSync(path.join(targetDir, ".claude", "rules", "stale.md"))).toBe(false);
	});

	it("preserves orphans when the callback returns false", async () => {
		const stats = await smartUpdate(config, sourceDir, targetDir, false, false, {
			confirmOrphans: async () => false,
		});

		expect(stats.orphansDeleted).toEqual([]);
		expect(stats.orphansSkipped).toEqual(["rules/stale.md"]);
		expect(fs.existsSync(path.join(targetDir, ".claude", "rules", "stale.md"))).toBe(true);
	});

	it("does not invoke the callback when assumeYes is set (auto-deletes)", async () => {
		let called = false;
		const stats = await smartUpdate(config, sourceDir, targetDir, false, false, {
			assumeYes: true,
			confirmOrphans: async () => {
				called = true;
				return false;
			},
		});

		expect(called).toBe(false);
		expect(stats.orphansDeleted).toEqual(["rules/stale.md"]);
	});

	it("does not invoke the callback in dryRun mode (lists only)", async () => {
		let called = false;
		const stats = await smartUpdate(config, sourceDir, targetDir, true, false, {
			confirmOrphans: async () => {
				called = true;
				return true;
			},
		});

		expect(called).toBe(false);
		expect(stats.orphansDeleted).toEqual([]);
		expect(stats.orphansSkipped).toEqual(["rules/stale.md"]);
		expect(fs.existsSync(path.join(targetDir, ".claude", "rules", "stale.md"))).toBe(true);
	});

	it("skips orphan cleanup entirely when no prior meowkit.manifest.json exists", async () => {
		// Simulate fresh install or .claude/ owned by another toolkit (claudekit etc.)
		fs.unlinkSync(path.join(targetDir, ".claude", "meowkit.manifest.json"));

		let called = false;
		const stats = await smartUpdate(config, sourceDir, targetDir, false, false, {
			confirmOrphans: async () => {
				called = true;
				return true;
			},
		});

		expect(called).toBe(false);
		expect(stats.orphansDeleted).toEqual([]);
		expect(stats.orphansSkipped).toEqual([]);
		expect(fs.existsSync(path.join(targetDir, ".claude", "rules", "stale.md"))).toBe(true);
	});
});
