// Regression tests for the doubled-project-root bug in Codex hook path
// construction. Real migrations produced commands like
//   node "/root//root/.codex/hooks/x.cjs"
// (project root prepended to an already-absolute path). getCodexRoot /
// resolveCodexTargetPath centralize construction so a root is computed ONCE.

import { mkdirSync, mkdtempSync, realpathSync, symlinkSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCodexRoot, isPathWithinBoundary, resolveCodexTargetPath } from "../codex-path-safety.js";

describe("codex-path-safety: single-rooted path construction", () => {
	let originalCwd: string;
	let projectDir: string;

	beforeEach(() => {
		originalCwd = process.cwd();
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		if (projectDir) await rm(projectDir, { recursive: true, force: true });
	});

	it("computes a single absolute .codex root for the project scope", () => {
		projectDir = mkdtempSync(join(tmpdir(), "codex-root-"));
		process.chdir(projectDir);
		const root = getCodexRoot({ global: false });
		expect(isAbsolute(root)).toBe(true);
		expect(root).toBe(join(realpathSync(projectDir), ".codex"));
	});

	it("does NOT double the project root when target is already absolute (the bug)", () => {
		projectDir = mkdtempSync(join(tmpdir(), "codex-nodouble-"));
		process.chdir(projectDir);
		const root = getCodexRoot({ global: false });
		const absolute = join(root, "hooks", "abc-dispatch.cjs");
		const resolved = resolveCodexTargetPath(absolute, { global: false });
		// Idempotent: no second root prefixed. Exactly one ".codex" segment.
		expect(resolved).toBe(absolute);
		expect(resolved.split(`${sep}.codex${sep}`).length).toBe(2);
		expect(resolved).not.toMatch(/\.codex[/\\].*\.codex[/\\]/);
	});

	it("joins the literal .codex-relative registry path onto the root exactly once", () => {
		projectDir = mkdtempSync(join(tmpdir(), "codex-rel-"));
		process.chdir(projectDir);
		const resolved = resolveCodexTargetPath(".codex/hooks", { global: false });
		expect(resolved).toBe(join(realpathSync(projectDir), ".codex", "hooks"));
		expect(resolved).not.toMatch(/\.codex[/\\]\.codex/);
	});

	it("survives a project root containing a space", () => {
		const parent = mkdtempSync(join(tmpdir(), "codex-space-"));
		projectDir = join(parent, "untitled folder");
		mkdirSync(projectDir, { recursive: true });
		process.chdir(projectDir);
		const root = getCodexRoot({ global: false });
		expect(root).toContain("untitled folder");
		const target = resolveCodexTargetPath(".codex/hooks/x.cjs", { global: false });
		expect(target).toBe(join(realpathSync(projectDir), ".codex", "hooks", "x.cjs"));
		expect(isPathWithinBoundary(target, root)).toBe(true);
	});

	it("resolves a symlinked project root without doubling", async () => {
		const parent = mkdtempSync(join(tmpdir(), "codex-symlink-"));
		const realDir = join(parent, "real-project");
		await mkdir(realDir, { recursive: true });
		const linkDir = join(parent, "linked-project");
		symlinkSync(realDir, linkDir);
		projectDir = parent;
		process.chdir(linkDir);
		const root = getCodexRoot({ global: false });
		expect(isAbsolute(root)).toBe(true);
		const target = resolveCodexTargetPath(join(root, "hooks", "x.cjs"), { global: false });
		expect(target).not.toMatch(/\.codex[/\\].*\.codex[/\\]/);
		expect(isPathWithinBoundary(target, root)).toBe(true);
	});
});
