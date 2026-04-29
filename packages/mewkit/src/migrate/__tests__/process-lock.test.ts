import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Test the process-lock semantics directly. We can't easily intercept the home dir
// the production module uses, so we test the algorithm by importing functions and
// stubbing path resolution via env. Simplification: test the public surface end-to-end
// using a temp project dir.

import { acquireMigrationLock, releaseMigrationLock } from "../reconcile/process-lock.js";

describe("process-lock", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = join(tmpdir(), `mewkit-lock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(testDir, { recursive: true, force: true });
	});

	it("acquires lock when none exists", async () => {
		const result = await acquireMigrationLock({ scope: "project" });
		expect(result.acquired).toBe(true);
		expect(existsSync(result.lockPath)).toBe(true);
		await releaseMigrationLock(result.lockPath);
		expect(existsSync(result.lockPath)).toBe(false);
	});

	it("refuses second acquisition while live PID holds lock", async () => {
		// First acquire — uses our process.pid (which is alive)
		const first = await acquireMigrationLock({ scope: "project" });
		expect(first.acquired).toBe(true);

		// Second attempt should refuse because our PID is alive
		const second = await acquireMigrationLock({ scope: "project" });
		expect(second.acquired).toBe(false);
		expect(second.heldBy).toBe(process.pid);

		await releaseMigrationLock(first.lockPath);
	});

	it("auto-clears stale lock with dead PID", async () => {
		// Discover the lock path the function actually uses (vitest workers can have
		// stale process.cwd state — easier to probe than to fight it).
		const probe = await acquireMigrationLock({ scope: "project" });
		expect(probe.acquired).toBe(true);
		const liveLockPath = probe.lockPath;
		await releaseMigrationLock(liveLockPath);

		// Plant a stale lock with definitely-dead PID at the actual path
		const lockDir = join(liveLockPath, "..");
		mkdirSync(lockDir, { recursive: true });
		writeFileSync(liveLockPath, "999999\n0\n", "utf-8");

		// Acquisition should clear stale lock and succeed
		const result = await acquireMigrationLock({ scope: "project" });
		expect(result.acquired).toBe(true);
		expect(result.lockPath).toBe(liveLockPath);

		await releaseMigrationLock(result.lockPath);
	});

	it("release is idempotent (safe to call when lock missing)", async () => {
		const fakeLockPath = join(testDir, ".mewkit", ".lock");
		// Don't create the lock — just call release
		await expect(releaseMigrationLock(fakeLockPath)).resolves.not.toThrow();
	});
});
