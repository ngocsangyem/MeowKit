import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reviewCoverage } from "../coverage.js";

let cwd: string;
let sessionDir: string;
const SESSION = "sess-cov";

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-cov-"));
	sessionDir = path.join(cwd, "tasks", "reviews", SESSION);
	fs.mkdirSync(sessionDir, { recursive: true });
});
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }); process.exitCode = 0; });

function seed(scoutRequired: boolean, cliReads: { reviewer: string; target: string }[], hookReads: string[] = []) {
	fs.writeFileSync(path.join(sessionDir, "impact-map.json"), JSON.stringify({ scoutRequired }));
	fs.writeFileSync(path.join(sessionDir, "evidence.jsonl"),
		cliReads.map((r) => JSON.stringify({ session: SESSION, kind: "read", target: r.target, at: "t", reviewer: r.reviewer, source: "cli" })).join("\n"));
	if (hookReads.length) {
		fs.writeFileSync(path.join(sessionDir, "hook-evidence.jsonl"),
			hookReads.map((t) => JSON.stringify({ session: SESSION, kind: "read", target: t, at: "t", source: "hook" })).join("\n"));
	}
}
const run = () => reviewCoverage({ session: SESSION, cwd, json: true });

describe("reviewCoverage — gap detection", () => {
	it("is complete when the correctness reviewer read the diff + its brief (attested)", async () => {
		seed(false, [{ reviewer: "correctness", target: "diff.patch" }, { reviewer: "correctness", target: "briefs/correctness.md" }]);
		const r = await run();
		expect(r.complete).toBe(true);
		expect(r.evidenceLevel).toBe("attested");
		expect(r.approveEligible).toBe(false);
	});

	it("flags a reviewer that never launched", async () => {
		seed(false, []);
		const r = await run();
		expect(r.complete).toBe(false);
		expect(r.gaps).toContainEqual({ type: "reviewer-never-launched", reviewer: "correctness" });
	});

	it("flags a never-opened diff", async () => {
		seed(false, [{ reviewer: "correctness", target: "briefs/correctness.md" }]);
		const r = await run();
		expect(r.gaps).toContainEqual({ type: "diff-never-opened", reviewer: "correctness", target: "diff.patch" });
	});

	it("flags a never-read brief", async () => {
		seed(false, [{ reviewer: "correctness", target: "diff.patch" }]);
		const r = await run();
		expect(r.gaps).toContainEqual({ type: "brief-never-read", reviewer: "correctness", target: "briefs/correctness.md" });
	});

	it("requires the scout report when the impact map demands it", async () => {
		seed(true, [{ reviewer: "correctness", target: "diff.patch" }, { reviewer: "correctness", target: "briefs/correctness.md" }]);
		const r = await run();
		expect(r.gaps).toContainEqual({ type: "required-read-missing", reviewer: "correctness", target: "scout-report.md" });
	});
});

describe("reviewCoverage — evidence level", () => {
	it("upgrades to session-observed when hook events corroborate every required read", async () => {
		seed(false,
			[{ reviewer: "correctness", target: "diff.patch" }, { reviewer: "correctness", target: "briefs/correctness.md" }],
			["diff.patch", "briefs/correctness.md"]);
		const r = await run();
		expect(r.complete).toBe(true);
		expect(r.evidenceLevel).toBe("session-observed");
		expect(r.approveEligible).toBe(true);
	});

	it("corroborates across CLI-normalized vs hook-raw target spellings (./diff.patch)", async () => {
		// CLI logs normalized "diff.patch"; hook logs the raw "./diff.patch" token.
		seed(false,
			[{ reviewer: "correctness", target: "diff.patch" }, { reviewer: "correctness", target: "briefs/correctness.md" }],
			["./diff.patch", "briefs/correctness.md/"]);
		const r = await run();
		expect(r.evidenceLevel).toBe("session-observed");
	});

	it("stays attested when only some required reads are corroborated", async () => {
		seed(false,
			[{ reviewer: "correctness", target: "diff.patch" }, { reviewer: "correctness", target: "briefs/correctness.md" }],
			["diff.patch"]);
		const r = await run();
		expect(r.evidenceLevel).toBe("attested");
	});

	it("errors when the session has no impact-map.json", async () => {
		const r = await reviewCoverage({ session: "nope", cwd, json: true });
		expect(r.ok).toBe(false);
	});
});
