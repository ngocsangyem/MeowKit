import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildRoster, renderBrief, writeRoster } from "../roster.js";

describe("buildRoster", () => {
	it("minimal tier → single correctness reviewer reading diff + its brief", () => {
		const r = buildRoster({ scoutRequired: false }, "minimal");
		expect(r.entries.map((e) => e.dimension)).toEqual(["correctness"]);
		expect(r.entries[0].expectedReads).toEqual(["diff.patch", "briefs/correctness.md"]);
	});

	it("full tier → five dimensions", () => {
		const r = buildRoster({ scoutRequired: false }, "full");
		expect(r.entries).toHaveLength(5);
		expect(r.entries.map((e) => e.dimension)).toContain("security");
	});

	it("scoutRequired adds scout-report.md to every reviewer's required reads", () => {
		const r = buildRoster({ scoutRequired: true }, "minimal");
		expect(r.entries[0].expectedReads).toContain("scout-report.md");
	});
});

describe("renderBrief", () => {
	it("states the wrapper as MANDATORY with the exact command line", () => {
		const r = buildRoster({ scoutRequired: false }, "minimal");
		const brief = renderBrief(r.entries[0], "sess-x");
		expect(brief).toMatch(/MANDATORY/);
		expect(brief).toContain("mewkit review read --session sess-x --as correctness diff.patch");
	});
});

describe("writeRoster", () => {
	let dir: string;
	beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "mk-roster-")); });
	afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

	it("writes roster.json + one brief per reviewer", () => {
		const r = buildRoster({ scoutRequired: false }, "full");
		writeRoster(dir, r, "sess-x");
		expect(fs.existsSync(path.join(dir, "roster.json"))).toBe(true);
		expect(fs.existsSync(path.join(dir, "briefs", "security.md"))).toBe(true);
	});
});
