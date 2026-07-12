/**
 * Single-editor advisory lock: acquire, refuse a live foreign lock (unless
 * --force), reclaim a stale (dead-pid) lock, and release only the owner's lock.
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { acquireEditLock, releaseEditLock, readEditLock } from "../server/edit-lock.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function dir(): string {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), "vp-lock-"));
	dirs.push(d);
	return d;
}
const lockPath = (d: string): string => path.join(d, ".visual-plan-lock");

describe("acquireEditLock", () => {
	it("acquires when unlocked and records pid + port", () => {
		const d = dir();
		expect(acquireEditLock(d, 4321, false).ok).toBe(true);
		expect(readEditLock(d)).toMatchObject({ pid: process.pid, port: 4321 });
	});

	it("refuses a live foreign lock without --force, allows with --force", () => {
		const d = dir();
		// pid 1 (init/launchd) is always alive and never this process.
		fs.writeFileSync(lockPath(d), JSON.stringify({ pid: 1, port: 9, startedAt: "x" }));
		expect(acquireEditLock(d, 4321, false).ok).toBe(false);
		expect(acquireEditLock(d, 4321, false).heldBy?.pid).toBe(1);
		expect(acquireEditLock(d, 4321, true).ok).toBe(true); // --force overrides
	});

	it("reclaims a stale lock whose pid is dead", () => {
		const d = dir();
		fs.writeFileSync(lockPath(d), JSON.stringify({ pid: 2147483646, port: 9, startedAt: "x" }));
		expect(acquireEditLock(d, 4321, false).ok).toBe(true);
		expect(readEditLock(d)?.pid).toBe(process.pid);
	});
});

describe("releaseEditLock", () => {
	it("removes only a lock owned by this process", () => {
		const d = dir();
		acquireEditLock(d, 4321, false);
		releaseEditLock(d);
		expect(readEditLock(d)).toBeNull();

		fs.writeFileSync(lockPath(d), JSON.stringify({ pid: 1, port: 9, startedAt: "x" }));
		releaseEditLock(d); // not ours — must NOT remove
		expect(readEditLock(d)?.pid).toBe(1);
	});
});
