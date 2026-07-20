import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildRoster } from "../../../review/roster.js";
import { reviewCoverage } from "../coverage.js";

let cwd: string;
let sessionDir: string;
const SESSION = "sess-cov";

// Small-tier impact map (few source lines). buildRoster → the 5 small-tier reviewers.
const smallImpact = (scoutRequired = false) => ({ scoutRequired, stats: { sourceChanged: 50, totalChanged: 60 }, changedFiles: [] });
const roster = (scoutRequired = false) => buildRoster(smallImpact(scoutRequired));
type Read = { reviewer: string; target: string };
const fullReads = (scoutRequired = false): Read[] => roster(scoutRequired).entries.flatMap((e) => e.expectedReads.map((target) => ({ reviewer: e.id, target })));

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-cov-"));
	sessionDir = path.join(cwd, "tasks", "reviews", SESSION);
	fs.mkdirSync(sessionDir, { recursive: true });
});
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }); process.exitCode = 0; });

function seed(scoutRequired: boolean, cliReads: Read[], hookReads: string[] = []) {
	fs.writeFileSync(path.join(sessionDir, "impact-map.json"), JSON.stringify(smallImpact(scoutRequired)));
	fs.writeFileSync(path.join(sessionDir, "evidence.jsonl"),
		cliReads.map((r) => JSON.stringify({ session: SESSION, kind: "read", target: r.target, at: "t", reviewer: r.reviewer, source: "cli" })).join("\n"));
	if (hookReads.length) {
		fs.writeFileSync(path.join(sessionDir, "hook-evidence.jsonl"),
			hookReads.map((t) => JSON.stringify({ session: SESSION, kind: "read", target: t, at: "t", source: "hook" })).join("\n"));
	}
}
const run = () => reviewCoverage({ session: SESSION, cwd, json: true });

describe("reviewCoverage — gap detection", () => {
	it("is complete when every small-tier reviewer read its required artifacts (attested)", async () => {
		seed(false, fullReads());
		const r = await run();
		expect(r.complete).toBe(true);
		expect(r.evidenceLevel).toBe("attested");
		expect(r.approveEligible).toBe(false);
	});

	it("flags a reviewer that never launched", async () => {
		seed(false, fullReads().filter((r) => r.reviewer !== "security"));
		const r = await run();
		expect(r.complete).toBe(false);
		expect(r.gaps).toContainEqual({ type: "reviewer-never-launched", reviewer: "security" });
	});

	it("flags a never-opened diff", async () => {
		seed(false, fullReads().filter((r) => !(r.reviewer === "correctness" && r.target === "diff.patch")));
		const r = await run();
		expect(r.gaps).toContainEqual({ type: "diff-never-opened", reviewer: "correctness", target: "diff.patch" });
	});

	it("flags a never-read brief", async () => {
		seed(false, fullReads().filter((r) => !(r.reviewer === "tests" && r.target === "briefs/tests.md")));
		const r = await run();
		expect(r.gaps).toContainEqual({ type: "brief-never-read", reviewer: "tests", target: "briefs/tests.md" });
	});

	it("requires the scout report when the impact map demands it", async () => {
		// full reads for scout-required roster, minus one reviewer's scout-report.
		seed(true, fullReads(true).filter((r) => !(r.reviewer === "correctness" && r.target === "scout-report.md")));
		const r = await run();
		expect(r.gaps).toContainEqual({ type: "required-read-missing", reviewer: "correctness", target: "scout-report.md" });
	});
});

describe("reviewCoverage — evidence level", () => {
	it("upgrades to session-observed when hook events corroborate every required read", async () => {
		const reads = fullReads();
		seed(false, reads, [...new Set(reads.map((r) => r.target))]);
		const r = await run();
		expect(r.complete).toBe(true);
		expect(r.evidenceLevel).toBe("session-observed");
		expect(r.approveEligible).toBe(true);
	});

	it("corroborates across CLI-normalized vs hook-raw target spellings", async () => {
		const reads = fullReads();
		// hook logs "./"-prefixed + trailing-slash spellings of the same targets.
		seed(false, reads, [...new Set(reads.map((r) => (r.target.startsWith("briefs/") ? `${r.target}/` : `./${r.target}`)))]);
		const r = await run();
		expect(r.evidenceLevel).toBe("session-observed");
	});

	it("stays attested when only some required reads are corroborated", async () => {
		const reads = fullReads();
		seed(false, reads, ["diff.patch"]);
		const r = await run();
		expect(r.evidenceLevel).toBe("attested");
	});

	it("errors when the session has no impact-map.json", async () => {
		const r = await reviewCoverage({ session: "nope", cwd, json: true });
		expect(r.ok).toBe(false);
	});
});
