/**
 * Characterization: realpath containment (fail-closed). A symlink escaping the
 * parent must NOT be contained; a missing path resolves to null.
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { safeRealpath, isContainedPath, resolveContained } from "../path-boundary.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function mk(prefix: string): string {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	dirs.push(d);
	return fs.realpathSync(d);
}

describe("safeRealpath", () => {
	it("returns null for a missing path (fail-closed)", () => {
		expect(safeRealpath(path.join(os.tmpdir(), "lw-missing-xyz"))).toBeNull();
	});
});

describe("isContainedPath", () => {
	it("accepts the parent itself and a strict child; rejects a sibling", () => {
		const parent = mk("lw-pb-");
		expect(isContainedPath(parent, parent)).toBe(true);
		expect(isContainedPath(path.join(parent, "a", "b"), parent)).toBe(true);
		expect(isContainedPath(`${parent}-sibling`, parent)).toBe(false);
	});
});

describe("resolveContained", () => {
	it("resolves a real child inside the parent", () => {
		const parent = mk("lw-pb-");
		const child = path.join(parent, "plan.json");
		fs.writeFileSync(child, "{}");
		expect(resolveContained(parent, child)).toBe(fs.realpathSync(child));
	});

	it("returns null for a symlink that escapes the parent", () => {
		const parent = mk("lw-pb-in-");
		const outside = mk("lw-pb-out-");
		const secret = path.join(outside, "secret.json");
		fs.writeFileSync(secret, "{}");
		const link = path.join(parent, "escape.json");
		fs.symlinkSync(secret, link);
		expect(resolveContained(parent, link)).toBeNull();
	});
});
