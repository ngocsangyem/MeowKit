import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withFileLock } from "../file-lock.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "mewkit-file-lock-"));
	tempDirs.push(dir);
	return dir;
}

describe("withFileLock", () => {
	it("acquires and releases the lock file around the operation", async () => {
		const dir = await makeTempDir();
		const lockPath = join(dir, ".test.lock");

		const result = await withFileLock(lockPath, async () => {
			expect(existsSync(lockPath)).toBe(true);
			return 42;
		});

		expect(result).toBe(42);
		expect(existsSync(lockPath)).toBe(false);
	});

	it("releases the lock even when the operation throws", async () => {
		const dir = await makeTempDir();
		const lockPath = join(dir, ".test.lock");

		await expect(
			withFileLock(lockPath, async () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");

		expect(existsSync(lockPath)).toBe(false);
	});

	it("reclaims a stale lock whose owner PID is dead", async () => {
		const dir = await makeTempDir();
		const lockPath = join(dir, ".test.lock");
		// PID 1 plus a very old timestamp — treat as reclaimable. Use a PID that is
		// almost certainly not alive AND an old timestamp so both gates pass.
		await writeFile(lockPath, `2147483647\n0\n`, "utf-8");

		const result = await withFileLock(lockPath, async () => "acquired");
		expect(result).toBe("acquired");
		expect(existsSync(lockPath)).toBe(false);
	});

	it("serializes concurrent operations on the same lock path", async () => {
		const dir = await makeTempDir();
		const lockPath = join(dir, ".test.lock");
		const counterPath = join(dir, "counter.txt");
		await writeFile(counterPath, "0", "utf-8");

		// Each op does a non-atomic read-modify-write with an await in the middle.
		// Without mutual exclusion the increments would clobber each other.
		const increment = () =>
			withFileLock(lockPath, async () => {
				const current = Number.parseInt(await readFile(counterPath, "utf-8"), 10);
				await new Promise((r) => setTimeout(r, 10));
				await writeFile(counterPath, String(current + 1), "utf-8");
			});

		await Promise.all([increment(), increment(), increment(), increment(), increment()]);

		expect(await readFile(counterPath, "utf-8")).toBe("5");
		expect(existsSync(lockPath)).toBe(false);
	});
});
