// A release is built from a maintainer's working tree. Anything on disk that git
// does not track — a personal settings file ignored through a global ignore, a
// `.DS_Store`, scratch output — must never reach the kit, whatever `base.exclude`
// happens to list.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

interface ShipSetModule {
	excludeMatcher(patterns: string[]): (rel: string) => boolean;
	shipSetFiles(root: string, isExcluded: (rel: string) => boolean): string[];
}
const shipSet = createRequire(import.meta.url)(join(REPO, "scripts", "kit-ship-set.cjs")) as ShipSetModule;

const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function write(root: string, rel: string, content = "x\n"): void {
	mkdirSync(dirname(join(root, rel)), { recursive: true });
	writeFileSync(join(root, rel), content);
}

const git = (root: string, ...args: string[]): void => {
	execFileSync("git", args, { cwd: root, stdio: "pipe" });
};

/** A source tree with one tracked file and the pipeline's generated manifest. */
function makeTree(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-shipset-"));
	roots.push(root);
	write(root, ".claude/rules/kept.md");
	write(root, ".meowkit/pack-manifest.json", "{}\n");
	git(root, "init", "-q");
	git(root, "add", "-A");
	return root;
}

const everything = shipSet.excludeMatcher([]);

describe("kit ship set — tracked files only", () => {
	it("excludes untracked and git-ignored files under .claude/", () => {
		const root = makeTree();
		write(root, ".gitignore", ".claude/settings.local.json\n");
		git(root, "add", ".gitignore");
		write(root, ".claude/settings.local.json", '{"local":true}\n');
		write(root, ".claude/.DS_Store");
		write(root, ".claude/skills/scratch/notes.md");

		expect(shipSet.shipSetFiles(root, everything)).toEqual([".claude/rules/kept.md", ".meowkit/pack-manifest.json"]);
	});

	it("still ships the release manifest the pipeline writes untracked just before archiving", () => {
		const root = makeTree();
		write(root, "release-manifest.json", "{}\n");

		expect(shipSet.shipSetFiles(root, everything)).toContain("release-manifest.json");
	});

	it("keeps applying base.exclude to tracked files", () => {
		const root = makeTree();
		write(root, ".claude/logs/run.md");
		git(root, "add", "-A");

		expect(shipSet.shipSetFiles(root, shipSet.excludeMatcher([".claude/logs/*"]))).not.toContain(".claude/logs/run.md");
	});

	it("refuses to build outside a git work tree instead of shipping whatever is on disk", () => {
		const root = mkdtempSync(join(tmpdir(), "mewkit-shipset-nogit-"));
		roots.push(root);
		write(root, ".claude/rules/kept.md");

		expect(() => shipSet.shipSetFiles(root, everything)).toThrow(/git-tracked/);
	});

	it("feeds the zip build the same file list instead of letting zip walk the tree", () => {
		const source = readFileSync(join(REPO, "scripts", "prepare-release-assets.cjs"), "utf8");
		expect(source).toMatch(/shipSetFiles\(/);
		expect(source).toMatch(/"-@"/);
		expect(source).not.toMatch(/"-r"/);
	});
});
