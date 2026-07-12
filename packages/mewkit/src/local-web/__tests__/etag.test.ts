/**
 * Characterization: SHA-256 ETag + 409-stale helper. Parity is asserted against
 * the node crypto algorithm directly (not an import of the source module) so the
 * extracted copy stays import-clean while still proving byte-identical hashing.
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { computeEtag, etagFromFile, isStaleEtag } from "../etag.js";

let tmp: string | null = null;
afterEach(() => {
	if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
	tmp = null;
});

const sha = (s: string): string => crypto.createHash("sha256").update(s).digest("hex");

describe("computeEtag", () => {
	it("is the 64-char lowercase hex sha256 of the content", () => {
		expect(computeEtag("hello")).toBe(sha("hello"));
		expect(computeEtag("hello")).toMatch(/^[0-9a-f]{64}$/);
	});
	it("hashes Buffer and string identically", () => {
		expect(computeEtag(Buffer.from("abc"))).toBe(computeEtag("abc"));
	});
});

describe("etagFromFile", () => {
	it("hashes an existing file's bytes; returns null for a missing file", () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lw-etag-"));
		const file = path.join(tmp, "phase-01.md");
		fs.writeFileSync(file, "content");
		expect(etagFromFile(file)).toBe(sha("content"));
		expect(etagFromFile(path.join(tmp, "missing.md"))).toBeNull();
	});
});

describe("isStaleEtag", () => {
	it("is false for equal etags and true for a mismatch (the 409 trigger)", () => {
		expect(isStaleEtag("a".repeat(64), "a".repeat(64))).toBe(false);
		expect(isStaleEtag("a".repeat(64), "b".repeat(64))).toBe(true);
	});
});
