import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChangedFile } from "../impact-map.js";
import { buildRoster, renderBrief, selectTier, THRESHOLDS, writeRoster } from "../roster.js";

const impact = (
	over: Partial<{
		scoutRequired: boolean;
		sourceChanged: number;
		totalChanged: number;
		changedFiles: ChangedFile[];
	}> = {},
) => ({
	scoutRequired: over.scoutRequired ?? false,
	stats: { sourceChanged: over.sourceChanged ?? 10, totalChanged: over.totalChanged ?? 10 },
	changedFiles: over.changedFiles ?? [],
});

describe("selectTier (boundaries)", () => {
	it("small at/under the small thresholds", () => {
		expect(selectTier({ sourceChanged: THRESHOLDS.SMALL_SRC, totalChanged: THRESHOLDS.SMALL_TOTAL })).toBe("small");
	});
	it("medium just above small, below large", () => {
		expect(selectTier({ sourceChanged: THRESHOLDS.SMALL_SRC + 1, totalChanged: THRESHOLDS.SMALL_TOTAL + 1 })).toBe(
			"medium",
		);
	});
	it("stays medium exactly AT the large thresholds (`>` boundary, not `>=`)", () => {
		expect(selectTier({ sourceChanged: THRESHOLDS.LARGE_SRC, totalChanged: 0 })).toBe("medium");
		expect(selectTier({ sourceChanged: 5, totalChanged: THRESHOLDS.LARGE_TOTAL })).toBe("medium");
	});
	it("large above the large source threshold", () => {
		expect(selectTier({ sourceChanged: THRESHOLDS.LARGE_SRC + 1, totalChanged: 0 })).toBe("large");
	});
	it("large when total exceeds the large total threshold even with few source lines", () => {
		expect(selectTier({ sourceChanged: 5, totalChanged: THRESHOLDS.LARGE_TOTAL + 1 })).toBe("large");
	});
});

describe("buildRoster topology", () => {
	it("small tier → the five small dimensions, no territory reviewers", () => {
		const r = buildRoster(impact({ sourceChanged: 100 }));
		expect(r.tier).toBe("small");
		expect(r.entries.map((e) => e.id)).toEqual(["issue-fidelity", "correctness", "security", "tests", "build-test"]);
		expect(r.entries.some((e) => e.dimension === "territory")).toBe(false);
	});

	it("medium tier adds edge-failure + maintainability-performance", () => {
		const r = buildRoster(impact({ sourceChanged: THRESHOLDS.SMALL_SRC + 50 }));
		expect(r.tier).toBe("medium");
		expect(r.entries.map((e) => e.dimension)).toEqual(
			expect.arrayContaining(["edge-failure", "maintainability-performance"]),
		);
	});

	it("large tier has whole-diff roles + per-chunk territory reviewers", () => {
		const changedFiles: ChangedFile[] = Array.from({ length: 9 }, (_, i) => ({
			path: `src/f${i}.ts`,
			kind: "source",
			deleted: false,
			added: 5,
			removed: 1,
		}));
		const r = buildRoster(impact({ sourceChanged: THRESHOLDS.LARGE_SRC + 1, changedFiles }));
		expect(r.tier).toBe("large");
		expect(r.entries.filter((e) => e.wholeDiff).map((e) => e.id)).toEqual(
			expect.arrayContaining(["issue-fidelity", "removed-behavior", "cross-file-tracer", "test-matrix"]),
		);
		const territories = r.entries.filter((e) => e.dimension === "territory");
		expect(territories.length).toBe(Math.ceil(9 / THRESHOLDS.TERRITORY_FILES_PER_CHUNK));
	});

	it("caps territory reviewers at MAX_TERRITORIES", () => {
		const changedFiles: ChangedFile[] = Array.from({ length: 100 }, (_, i) => ({
			path: `src/f${i}.ts`,
			kind: "source",
			deleted: false,
			added: 2,
			removed: 0,
		}));
		const r = buildRoster(impact({ sourceChanged: THRESHOLDS.LARGE_SRC + 1, changedFiles }));
		expect(r.entries.filter((e) => e.dimension === "territory").length).toBe(THRESHOLDS.MAX_TERRITORIES);
	});

	it("adds three invariant slices per heavily-rewritten file", () => {
		const heavy: ChangedFile = {
			path: "src/big.ts",
			kind: "source",
			deleted: false,
			added: THRESHOLDS.HEAVY_FILE_MIN,
			removed: THRESHOLDS.HEAVY_FILE_MIN,
		};
		const r = buildRoster(impact({ sourceChanged: 100, changedFiles: [heavy] }));
		const inv = r.entries.filter((e) => e.dimension.startsWith("invariant:"));
		expect(inv).toHaveLength(3);
		expect(inv.map((e) => e.dimension)).toEqual([
			"invariant:lifecycle-state",
			"invariant:error-retry",
			"invariant:config-early-return",
		]);
	});

	it("gives colliding-slug heavy files DISTINCT invariant ids (no brief overwrite / false-green)", () => {
		const min = THRESHOLDS.HEAVY_FILE_MIN;
		const files: ChangedFile[] = [
			{ path: "src/a/b.ts", kind: "source", deleted: false, added: min, removed: min },
			{ path: "src/a-b.ts", kind: "source", deleted: false, added: min, removed: min }, // slug-collides with src/a/b.ts
		];
		const r = buildRoster(impact({ sourceChanged: 100, changedFiles: files }));
		const ids = r.entries.filter((e) => e.dimension.startsWith("invariant:")).map((e) => e.id);
		expect(ids).toHaveLength(6); // 3 slices × 2 files
		expect(new Set(ids).size).toBe(6); // all unique despite slug collision
	});

	it("does NOT treat a one-sided (pure-add) file as heavily rewritten", () => {
		const oneSided: ChangedFile = { path: "src/new.ts", kind: "source", deleted: false, added: 500, removed: 0 };
		const r = buildRoster(impact({ sourceChanged: 100, changedFiles: [oneSided] }));
		expect(r.entries.some((e) => e.dimension.startsWith("invariant:"))).toBe(false);
	});

	it("scoutRequired adds scout-report.md to every reviewer's required reads", () => {
		const r = buildRoster(impact({ scoutRequired: true }));
		expect(r.entries.every((e) => e.expectedReads.includes("scout-report.md"))).toBe(true);
	});
});

describe("renderBrief", () => {
	it("states the wrapper as MANDATORY with the exact command and the role focus", () => {
		const r = buildRoster(
			impact({
				sourceChanged: THRESHOLDS.LARGE_SRC + 1,
				changedFiles: [{ path: "src/a.ts", kind: "source", deleted: false, added: 3, removed: 1 }],
			}),
		);
		const wholeDiff = r.entries.find((e) => e.id === "cross-file-tracer")!;
		const brief = renderBrief(wholeDiff, "sess-x");
		expect(brief).toMatch(/MANDATORY/);
		expect(brief).toContain("mewkit review read --session sess-x --as cross-file-tracer diff.patch");
		expect(brief).toMatch(/Whole-diff role/);
	});
});

describe("writeRoster", () => {
	let dir: string;
	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "mk-roster-"));
	});
	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("writes roster.json + one brief per reviewer", () => {
		const r = buildRoster(impact({ sourceChanged: 100 }));
		writeRoster(dir, r, "sess-x");
		expect(fs.existsSync(path.join(dir, "roster.json"))).toBe(true);
		expect(fs.existsSync(path.join(dir, "briefs", "correctness.md"))).toBe(true);
	});
});
