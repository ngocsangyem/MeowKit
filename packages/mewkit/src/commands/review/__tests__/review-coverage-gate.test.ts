import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Exercises the Gate 2 narrow extension script (.claude/scripts/validate-review-coverage.cjs)
// that gate2-check.sh calls on a review-session verdict's embedded coverage block.
const REPO = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: path.dirname(new URL(import.meta.url).pathname), encoding: "utf-8" }).trim();
const VALIDATOR = path.join(REPO, ".claude", "scripts", "validate-review-coverage.cjs");

const cov = (report: object) => ({ report, sha256: crypto.createHash("sha256").update(JSON.stringify(report)).digest("hex") });

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "mk-g2cov-")); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

function runValidator(verdict: unknown): number {
	const p = path.join(dir, "verdict.json");
	fs.writeFileSync(p, JSON.stringify(verdict));
	try { execFileSync("node", [VALIDATOR, p], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }); return 0; }
	catch (e) { return (e as { status?: number }).status ?? 1; }
}

describe("gate2 review-coverage extension", () => {
	it("is INERT for a normal (non-review) verdict — exit 0", () => {
		expect(runValidator({ decision: "PASS", dimensions: [] })).toBe(0);
	});

	it("passes a review PASS with complete, session-observed, hash-clean coverage", () => {
		expect(runValidator({ review_session: "s", decision: "PASS", coverage: cov({ complete: true, evidenceLevel: "session-observed", gaps: [] }) })).toBe(0);
	});

	it("BLOCKS a PASS whose coverage is attested (exit 2)", () => {
		expect(runValidator({ review_session: "s", decision: "PASS", coverage: cov({ complete: true, evidenceLevel: "attested", gaps: [] }) })).toBe(2);
	});

	it("BLOCKS when coverage is incomplete (exit 2)", () => {
		expect(runValidator({ review_session: "s", decision: "PASS_WITH_RISK", coverage: cov({ complete: false, evidenceLevel: "attested", gaps: [{ type: "x" }] }) })).toBe(2);
	});

	it("BLOCKS a tampered coverage hash (exit 2)", () => {
		expect(runValidator({ review_session: "s", decision: "PASS", coverage: { report: { complete: true, evidenceLevel: "session-observed" }, sha256: "BADHASH" } })).toBe(2);
	});

	it("BLOCKS a review verdict with no coverage block (exit 2)", () => {
		expect(runValidator({ review_session: "s", decision: "PASS" })).toBe(2);
	});
});
