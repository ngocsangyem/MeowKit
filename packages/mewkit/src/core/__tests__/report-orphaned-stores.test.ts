// Upgrade-time reporting of v2 memory artifacts.
//
// There is deliberately no v2→v3 migration, so an upgraded project keeps its JSON stores and
// its wiki index in `.meowkit/memory/`. Silence is harmful on three counts: the documented
// recursive grep still reads them, in v2 the directory was gitignored so git cannot recover
// the content either, and the retired `.json` stores were the AUTHORITATIVE source in v2 —
// left unannounced they contradict the two-file contract with no indication which is current.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findOrphanedV2Stores, renderOrphanedV2Report } from "../report-orphaned-stores.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function makeProject(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-orphan-stores-"));
	roots.push(root);
	const memoryDir = join(root, ".meowkit", "memory");
	mkdirSync(memoryDir, { recursive: true });
	for (const [name, body] of Object.entries(files)) writeFileSync(join(memoryDir, name), body, "utf-8");
	return root;
}

describe("findOrphanedV2Stores", () => {
	it("reports nothing for a v3 store", () => {
		expect(findOrphanedV2Stores(makeProject({ "decisions.md": "# Decisions\n", "gotchas.md": "# Gotchas\n" }))).toEqual(
			[],
		);
	});

	it("reports nothing when there is no store at all", () => {
		const root = mkdtempSync(join(tmpdir(), "mewkit-orphan-stores-"));
		roots.push(root);
		expect(findOrphanedV2Stores(root)).toEqual([]);
	});

	it("names every v2 JSON store and the wiki index", () => {
		const root = makeProject({
			"gotchas.md": "# Gotchas\n",
			"fixes.json": "{}",
			"review-patterns.json": "{}",
			"architecture-decisions.json": "{}",
			"security-findings.json": "{}",
			"wiki-index.db": "",
		});
		const found = findOrphanedV2Stores(root).map((orphan) => orphan.file);
		for (const name of [
			"fixes.json",
			"review-patterns.json",
			"architecture-decisions.json",
			"security-findings.json",
			"wiki-index.db",
		]) {
			expect(found).toContain(join(".meowkit", "memory", name));
		}
	});

	it("reports an unrecognised markdown file as outside the two-file store", () => {
		const orphans = findOrphanedV2Stores(makeProject({ "decisions.md": "x", "sessions.md": "x" }));
		expect(orphans).toHaveLength(1);
		expect(orphans[0].label).toContain("two-file store");
	});
});

describe("renderOrphanedV2Report", () => {
	it("is empty for a clean v3 store, so upgrade prints nothing", () => {
		expect(renderOrphanedV2Report(makeProject({ "gotchas.md": "# Gotchas\n" }))).toBe("");
	});

	it("says the files were neither migrated nor deleted, and points at the write path", () => {
		const report = renderOrphanedV2Report(makeProject({ "fixes.json": "{}" }));
		expect(report).toContain("fixes.json");
		expect(report).toContain("NOT migrated");
		expect(report).toContain("NOT deleted");
		expect(report).toContain("mewkit note");
	});
});
