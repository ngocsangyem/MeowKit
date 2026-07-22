import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findMemoryDir, detectLegacyMemory } from "../memory.js";

// The memory command now resolves the canonical runtime-neutral `.meowkit/memory`
// via the project-root resolver, with read-only legacy detection retained solely to
// prompt the user to migrate a pre-migration `.claude/memory` tree.

let root: string;
beforeEach(() => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "mem-resolver-")));
	mkdirSync(join(root, ".git"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("findMemoryDir", () => {
	it("resolves .meowkit/memory under the project root (from a nested subdir)", () => {
		const nested = join(root, "packages", "app");
		mkdirSync(nested, { recursive: true });
		expect(findMemoryDir(nested)).toBe(join(root, ".meowkit", "memory"));
	});

	it("returns the canonical path even before it exists (subcommands create it)", () => {
		expect(findMemoryDir(root)).toBe(join(root, ".meowkit", "memory"));
	});

	it("never keys off .claude/ — a .claude-only dir with no git root resolves null", () => {
		const bare = realpathSync(mkdtempSync(join(tmpdir(), "mem-bare-")));
		mkdirSync(join(bare, ".claude", "memory"), { recursive: true });
		expect(findMemoryDir(bare)).toBeNull();
		rmSync(bare, { recursive: true, force: true });
	});
});

describe("detectLegacyMemory", () => {
	it("returns the legacy path when .claude/memory has content and .meowkit/memory is absent", () => {
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		writeFileSync(join(root, ".claude", "memory", "fixes.json"), "{}");
		expect(detectLegacyMemory(root)).toBe(join(root, ".claude", "memory"));
	});

	it("ignores a legacy dir that holds only .gitkeep (no real content)", () => {
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		writeFileSync(join(root, ".claude", "memory", ".gitkeep"), "");
		expect(detectLegacyMemory(root)).toBeNull();
	});

	it("returns null once migrated (.meowkit/memory exists)", () => {
		mkdirSync(join(root, ".claude", "memory"), { recursive: true });
		writeFileSync(join(root, ".claude", "memory", "fixes.json"), "{}");
		mkdirSync(join(root, ".meowkit", "memory"), { recursive: true });
		expect(detectLegacyMemory(root)).toBeNull();
	});

	it("returns null when there is no legacy memory at all", () => {
		expect(detectLegacyMemory(root)).toBeNull();
	});
});
