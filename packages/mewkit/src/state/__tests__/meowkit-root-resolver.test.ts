import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveProjectRoot, resolveMeowkitRoot } from "../meowkit-root-resolver.js";

// The resolver owns project-root discovery for the runtime-neutral `.meowkit/`
// state root. It keys off `.git` (primary) or `package.json`+existing `.meowkit/`
// (fallback), NEVER off provider dirs (`.claude/`, `.codex/`, `.cursor/`) and
// NEVER off the pre-existing `.mewkit/` lock dir or `.meowkit.config.json` file.

let root: string;

beforeEach(() => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "meowkit-resolver-")));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("resolveProjectRoot", () => {
	it("finds a git root from the repo root itself", () => {
		mkdirSync(join(root, ".git"));
		expect(resolveProjectRoot(root)).toBe(root);
	});

	it("finds the git root from a nested subdirectory", () => {
		mkdirSync(join(root, ".git"));
		const nested = join(root, "packages", "app", "src");
		mkdirSync(nested, { recursive: true });
		expect(resolveProjectRoot(nested)).toBe(root);
	});

	it("picks the nearest nested .git in a monorepo (nested wins)", () => {
		mkdirSync(join(root, ".git"));
		const inner = join(root, "packages", "inner");
		mkdirSync(join(inner, ".git"), { recursive: true });
		const start = join(inner, "src");
		mkdirSync(start, { recursive: true });
		expect(resolveProjectRoot(start)).toBe(inner);
	});

	it("treats a `.git` FILE (git worktree) as a root, not only a dir", () => {
		writeFileSync(join(root, ".git"), "gitdir: /somewhere/else\n");
		const nested = join(root, "sub");
		mkdirSync(nested);
		expect(resolveProjectRoot(nested)).toBe(root);
	});

	it("falls back to package.json + existing .meowkit/ when there is no .git", () => {
		writeFileSync(join(root, "package.json"), "{}");
		mkdirSync(join(root, ".meowkit"));
		const nested = join(root, "src");
		mkdirSync(nested);
		expect(resolveProjectRoot(nested)).toBe(root);
	});

	it("does NOT treat package.json alone (without .meowkit/) as a root in the fallback path", () => {
		writeFileSync(join(root, "package.json"), "{}");
		expect(resolveProjectRoot(root)).toBeNull();
	});

	it("never keys off provider dirs (.claude/.codex/.cursor are not sentinels)", () => {
		mkdirSync(join(root, ".claude"));
		mkdirSync(join(root, ".codex"));
		mkdirSync(join(root, ".cursor"));
		expect(resolveProjectRoot(root)).toBeNull();
	});

	it("never treats the pre-existing .mewkit/ lock dir as the root", () => {
		mkdirSync(join(root, ".mewkit"));
		expect(resolveProjectRoot(root)).toBeNull();
	});

	it("never treats .meowkit.config.json (config file) as the root", () => {
		writeFileSync(join(root, ".meowkit.config.json"), "{}");
		expect(resolveProjectRoot(root)).toBeNull();
	});

	it("resolves symlinked start dirs to their real path", () => {
		mkdirSync(join(root, ".git"));
		const realDir = join(root, "real");
		mkdirSync(realDir);
		const linkDir = join(root, "link");
		symlinkSync(realDir, linkDir);
		expect(resolveProjectRoot(linkDir)).toBe(root);
	});

	it("bails at the filesystem root when nothing matches", () => {
		const orphan = join(root, "a", "b", "c");
		mkdirSync(orphan, { recursive: true });
		expect(resolveProjectRoot(orphan)).toBeNull();
	});
});

describe("resolveMeowkitRoot", () => {
	it("returns the .meowkit dir under the project root", () => {
		mkdirSync(join(root, ".git"));
		expect(resolveMeowkitRoot(root)).toBe(join(root, ".meowkit"));
	});

	it("returns null when there is no project root", () => {
		expect(resolveMeowkitRoot(root)).toBeNull();
	});

	it("does not create the .meowkit dir as a side effect of resolving", () => {
		mkdirSync(join(root, ".git"));
		const meowkit = resolveMeowkitRoot(root);
		expect(meowkit).toBe(join(root, ".meowkit"));
		// Resolver is read-only: it must not create directories.
		expect(() => rmSync(join(root, ".meowkit"), { recursive: true })).toThrow();
	});
});
