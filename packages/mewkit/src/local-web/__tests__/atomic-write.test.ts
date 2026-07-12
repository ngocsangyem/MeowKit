/**
 * Characterization: atomic write + orphan cleanup. Verifies the write lands the
 * content, leaves no temp behind on success, and that cleanup removes only
 * temps older than the orphan age.
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { atomicWriteFileSync, cleanOrphanedTmps } from "../atomic-write.js";

let tmp: string | null = null;
function dir(): string {
	tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lw-aw-"));
	return tmp;
}
afterEach(() => {
	if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
	tmp = null;
});

describe("atomicWriteFileSync", () => {
	it("writes content and leaves no temp file behind", () => {
		const d = dir();
		const target = path.join(d, "plan.json");
		atomicWriteFileSync(target, '{"ok":true}');
		expect(fs.readFileSync(target, "utf-8")).toBe('{"ok":true}');
		expect(fs.readdirSync(d).filter((n) => n.startsWith(".local-web-tmp-"))).toEqual([]);
	});

	it("overwrites an existing file atomically", () => {
		const d = dir();
		const target = path.join(d, "plan.json");
		atomicWriteFileSync(target, "v1");
		atomicWriteFileSync(target, "v2");
		expect(fs.readFileSync(target, "utf-8")).toBe("v2");
	});
});

describe("cleanOrphanedTmps", () => {
	it("removes temps older than the orphan age, keeps fresh ones", () => {
		const d = dir();
		const old = path.join(d, ".local-web-tmp-old");
		const fresh = path.join(d, ".local-web-tmp-fresh");
		fs.writeFileSync(old, "x");
		fs.writeFileSync(fresh, "y");
		const sixMinAgo = Date.now() / 1000 - 6 * 60;
		fs.utimesSync(old, sixMinAgo, sixMinAgo);

		cleanOrphanedTmps(d);
		expect(fs.existsSync(old)).toBe(false);
		expect(fs.existsSync(fresh)).toBe(true);
	});

	it("is a no-op on a missing directory", () => {
		expect(() => cleanOrphanedTmps(path.join(os.tmpdir(), "lw-does-not-exist-xyz"))).not.toThrow();
	});
});
