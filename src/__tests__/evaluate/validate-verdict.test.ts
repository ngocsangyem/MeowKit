// Evaluator-integrity regression suite for evaluate/scripts/validate-verdict.sh + recompute-score.py.
// The load-bearing guard: the audit's forged verdict (overall PASS + weighted_score 0.01 + junk
// evidence) must be REJECTED forever. Also covers score-deviation, missing rubric coverage,
// hard-fail propagation, missing evaluator identity, and the valid path.
//
// The validator recomputes the score from the REAL .claude/rubrics preset, so the test spawns it
// with cwd = repo root (where .claude/rubrics lives) and writes each verdict + its evidence dir in
// a throwaway tmp dir passed by absolute path.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(process.cwd());
const VALIDATOR = path.join(REPO_ROOT, ".claude/skills/evaluate/scripts/validate-verdict.sh");

let tmp: string | null = null;
afterEach(() => {
	if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
	tmp = null;
});

const FM = [
	"---",
	"task: demo",
	"evaluator_run: 2026-07-18T00:00:00Z",
	"rubric_preset: frontend-app",
	"overall: PASS",
	"weighted_score: 1.0",
	"hard_fail_triggered: false",
	"evaluator: {agent: evaluator, session: s1, date: 2026-07-18}",
	"---",
].join("\n");

const RUBRICS = ["product-depth", "functionality", "design-quality", "originality"] as const;
const WEIGHTS: Record<string, string> = { "product-depth": "0.30", functionality: "0.30", "design-quality": "0.20", originality: "0.20" };

/** Build a verdict body whose per-rubric section carries the given verdicts + an evidence citation. */
function body(verdicts: Record<string, "PASS" | "WARN" | "FAIL">): string {
	const lines = ["## Per-Rubric Results"];
	for (const r of RUBRICS) {
		lines.push(`### ${r} (weight ${WEIGHTS[r]}, hard_fail FAIL) — ${verdicts[r]}`);
		lines.push("- **Evidence:** `EVID/transcript.txt`");
	}
	return lines.join("\n");
}

/** Write a verdict + evidence dir; return the verdict path. `fm` overrides the default frontmatter. */
function writeVerdict(name: string, fm: string, bodyText: string, evidence = "captured transcript, no console errors\n"): string {
	tmp = tmp ?? fs.mkdtempSync(path.join(os.tmpdir(), "verdict-"));
	const evDir = path.join(tmp, `${name}-evalverdict-evidence`);
	fs.mkdirSync(evDir, { recursive: true });
	fs.writeFileSync(path.join(evDir, "transcript.txt"), evidence);
	const rel = `${name}-evalverdict-evidence`;
	const vpath = path.join(tmp, `${name}-evalverdict.md`);
	fs.writeFileSync(vpath, `${fm}\n${bodyText.replace(/EVID/g, rel)}\n`);
	return vpath;
}

function run(vpath: string) {
	const r = spawnSync("bash", [VALIDATOR, vpath], { cwd: REPO_ROOT, encoding: "utf8" });
	return { status: r.status, out: `${r.stdout ?? ""}\n${r.stderr ?? ""}` };
}

describe("validate-verdict.sh (v2 — recompute + provenance)", () => {
	it("accepts a valid verdict (all rubrics PASS, score follows) — exit 0", () => {
		const v = writeVerdict("valid", FM, body({ "product-depth": "PASS", functionality: "PASS", "design-quality": "PASS", originality: "PASS" }));
		const r = run(v);
		expect(r.status, r.out).toBe(0);
		expect(r.out).toMatch(/VERDICT_VALID/);
	});

	it("REJECTS the committed audit forged fixture (PASS + weighted_score 0.01) — exit 1, forever", () => {
		// Load the PERMANENT committed fixture, not a generated one, so the audit's exact shape
		// stays a durable regression guard.
		const fixture = fs.readFileSync(path.join(REPO_ROOT, "src/__tests__/evaluate/fixtures/forged-evalverdict.md"), "utf8");
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verdict-"));
		const evDir = path.join(tmp, "forged-evalverdict-evidence");
		fs.mkdirSync(evDir, { recursive: true });
		fs.writeFileSync(path.join(evDir, "junk.txt"), "total garbage, no real verification\n");
		const vpath = path.join(tmp, "forged-evalverdict.md");
		fs.writeFileSync(vpath, fixture.replace(/EVID/g, "forged-evalverdict-evidence"));
		const r = run(vpath);
		expect(r.status).toBe(1);
		expect(r.out).toMatch(/VERDICT_INVALID/);
		expect(r.out).toMatch(/mismatch: declared 0.01, recomputed 1/);
	});

	it("rejects a score deviating >0.01 from the recomputed value, printing both — exit 1", () => {
		// All PASS ⇒ recompute 1.0; declare 0.50 ⇒ mismatch.
		const fm = FM.replace("weighted_score: 1.0", "weighted_score: 0.50");
		const v = writeVerdict("dev", fm, body({ "product-depth": "PASS", functionality: "PASS", "design-quality": "PASS", originality: "PASS" }));
		const r = run(v);
		expect(r.status).toBe(1);
		expect(r.out).toMatch(/declared 0.5.*recomputed 1|recomputed 1.*declared 0.5/);
	});

	it("rejects missing rubric coverage — exit 1", () => {
		const partial = ["## Per-Rubric Results",
			"### product-depth (weight 0.30, hard_fail FAIL) — PASS",
			"- **Evidence:** `EVID/transcript.txt`",
			"### functionality (weight 0.30, hard_fail FAIL) — PASS",
			"- **Evidence:** `EVID/transcript.txt`"].join("\n");
		const v = writeVerdict("cov", FM, partial);
		const r = run(v);
		expect(r.status).toBe(1);
		expect(r.out).toMatch(/missing rubric section/);
	});

	it("enforces hard-fail propagation: a FAIL rubric with overall PASS is rejected — exit 1", () => {
		// functionality FAIL ⇒ hard_fail ⇒ expected overall FAIL; declaring PASS is inconsistent.
		const fm = FM.replace("weighted_score: 1.0", "weighted_score: 0.70");
		const v = writeVerdict("hf", fm, body({ "product-depth": "PASS", functionality: "FAIL", "design-quality": "PASS", originality: "PASS" }));
		const r = run(v);
		expect(r.status).toBe(1);
		expect(r.out).toMatch(/overall mismatch|hard.fail/i);
	});

	it("rejects a verdict with no evaluator identity — exit 1", () => {
		const noEval = FM.split("\n").filter((l) => !l.startsWith("evaluator:")).join("\n");
		const v = writeVerdict("noid", noEval, body({ "product-depth": "PASS", functionality: "PASS", "design-quality": "PASS", originality: "PASS" }));
		const r = run(v);
		expect(r.status).toBe(1);
		expect(r.out).toMatch(/missing required frontmatter field: evaluator/);
	});

	it("FAILS CLOSED for a PASS verdict when recompute-score.py is absent (no false score_recomputed stamp)", () => {
		// Simulate a partial install / mirror drift: validate-verdict.sh present, recompute script
		// NOT beside it. A PASS must be blocked, not accepted-and-falsely-stamped.
		const v = writeVerdict("noscript", FM, body({ "product-depth": "PASS", functionality: "PASS", "design-quality": "PASS", originality: "PASS" }));
		const scriptsDir = path.join(tmp as string, "scripts");
		fs.mkdirSync(scriptsDir, { recursive: true });
		fs.copyFileSync(VALIDATOR, path.join(scriptsDir, "validate-verdict.sh")); // no recompute-score.py alongside
		const r = spawnSync("bash", [path.join(scriptsDir, "validate-verdict.sh"), v], { cwd: REPO_ROOT, encoding: "utf8" });
		const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
		expect(r.status, out).toBe(1);
		expect(out).toMatch(/recompute-score\.py not found/);
		expect(fs.readFileSync(v, "utf8")).not.toMatch(/score_recomputed: true/);
	});

	it("KNOWINGLY accepts a self-consistent verdict with weak evidence — documents the anti-accidental boundary", () => {
		// Boundary (see step-04): recompute checks the score FOLLOWS from the per-rubric verdicts;
		// it does NOT judge whether each verdict is honest. An all-PASS verdict with junk-content
		// (but valid-type) evidence passes recompute — catching that is the skeptic-evaluator's job.
		// This test locks the KNOWN limitation so a future behavior change is deliberate, not silent.
		const v = writeVerdict("selfconsistent", FM, body({ "product-depth": "PASS", functionality: "PASS", "design-quality": "PASS", originality: "PASS" }), "no real verification happened here\n");
		const r = run(v);
		expect(r.status, r.out).toBe(0);
	});
});
