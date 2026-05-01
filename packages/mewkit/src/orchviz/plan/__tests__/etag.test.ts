/**
 * Unit tests for etag.ts — computePhaseFileEtag + computeAllPhaseEtags.
 *
 * Coverage:
 *   - Hash changes when file content changes
 *   - Absent file returns ""
 *   - computeAllPhaseEtags returns Record keyed by phase number
 *   - Non-phase files are excluded
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { computePhaseFileEtag, computeAllPhaseEtags } from "../etag.js";

let tmpDir: string | null = null;

afterEach(() => {
	if (tmpDir) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		tmpDir = null;
	}
});

function makeTmp(): string {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "etag-test-"));
	return tmpDir;
}

describe("computePhaseFileEtag", () => {
	it("returns a 64-char lowercase hex string for a valid file", () => {
		const dir = makeTmp();
		const file = path.join(dir, "phase-01-setup.md");
		fs.writeFileSync(file, "# Phase 1\n\nContent here.");
		const etag = computePhaseFileEtag(file);
		expect(etag).toHaveLength(64);
		expect(etag).toMatch(/^[0-9a-f]{64}$/);
	});

	it("returns '' for a missing file", () => {
		const etag = computePhaseFileEtag("/nonexistent/path/phase-01.md");
		expect(etag).toBe("");
	});

	it("hash changes when file content changes", () => {
		const dir = makeTmp();
		const file = path.join(dir, "phase-01-setup.md");
		fs.writeFileSync(file, "# Phase 1 — version A");
		const etagA = computePhaseFileEtag(file);

		fs.writeFileSync(file, "# Phase 1 — version B");
		const etagB = computePhaseFileEtag(file);

		expect(etagA).not.toBe(etagB);
		expect(etagA).toHaveLength(64);
		expect(etagB).toHaveLength(64);
	});

	it("same content produces the same hash (deterministic)", () => {
		const dir = makeTmp();
		const file = path.join(dir, "phase-02-impl.md");
		fs.writeFileSync(file, "Deterministic content");
		const a = computePhaseFileEtag(file);
		const b = computePhaseFileEtag(file);
		expect(a).toBe(b);
	});
});

describe("computeAllPhaseEtags", () => {
	it("returns an empty Record for a non-existent directory", () => {
		const result = computeAllPhaseEtags("/nonexistent/dir");
		expect(result).toEqual({});
	});

	it("returns Record keyed by phase number for phase-NN-*.md files", () => {
		const dir = makeTmp();
		fs.writeFileSync(path.join(dir, "phase-01-setup.md"), "Phase 1 content");
		fs.writeFileSync(path.join(dir, "phase-02-impl.md"), "Phase 2 content");
		fs.writeFileSync(path.join(dir, "phase-10-wrap-up.md"), "Phase 10 content");

		const result = computeAllPhaseEtags(dir);

		expect(Object.keys(result).map(Number)).toEqual(
			expect.arrayContaining([1, 2, 10]),
		);
		expect(result[1]).toHaveLength(64);
		expect(result[2]).toHaveLength(64);
		expect(result[10]).toHaveLength(64);
	});

	it("excludes non-phase files (plan.md, README, etc.)", () => {
		const dir = makeTmp();
		fs.writeFileSync(path.join(dir, "plan.md"), "Plan content");
		fs.writeFileSync(path.join(dir, "README.md"), "Readme");
		fs.writeFileSync(path.join(dir, "phase-01-setup.md"), "Phase 1 content");

		const result = computeAllPhaseEtags(dir);

		const keys = Object.keys(result).map(Number);
		expect(keys).toEqual([1]);
	});

	it("each phase maps to a distinct hash when content differs", () => {
		const dir = makeTmp();
		fs.writeFileSync(path.join(dir, "phase-01-setup.md"), "Different A");
		fs.writeFileSync(path.join(dir, "phase-02-impl.md"), "Different B");

		const result = computeAllPhaseEtags(dir);
		expect(result[1]).not.toBe(result[2]);
	});
});
