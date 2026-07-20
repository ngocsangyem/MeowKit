import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildRoster } from "../../../review/roster.js";
import { reviewCompose } from "../compose.js";

const SESSION = "sess-compose";
const IMPACT = { scoutRequired: false, stats: { sourceChanged: 40, totalChanged: 50 }, changedFiles: [] };
const DIFF = "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,0 +1,1 @@\n+  const risky = eval(x);\n";
// gh unavailable → selfPR stays false, deterministically.
const noGh = { exec: () => ({ ok: false, out: "", err: "no gh" }) };

let cwd: string;
let sessionDir: string;

function seedSession(opts: { findings?: unknown[]; ci?: string; observed?: boolean; tamperDiff?: boolean; completeCoverage?: boolean } = {}) {
	fs.mkdirSync(path.join(sessionDir, "untrusted"), { recursive: true });
	fs.writeFileSync(path.join(sessionDir, "diff.patch"), DIFF);
	fs.writeFileSync(path.join(sessionDir, "impact-map.json"), JSON.stringify(IMPACT));
	const diffSha = crypto.createHash("sha256").update(opts.tamperDiff ? "TAMPERED" : DIFF).digest("hex");
	fs.writeFileSync(path.join(sessionDir, "manifest.json"), JSON.stringify({
		schemaVersion: "1.0.0", session: SESSION, nonce: "n", worktreePath: `.worktrees/review-pr-7-${SESSION}`,
		pr: 7, ref: `refs/mewkit/review-pr-7-${SESSION}`, headSha: "h".repeat(40), baseSha: "b".repeat(40),
		baseBranch: "main", baseRemote: "origin", host: "github", owner: "o", repo: "r", createdAt: "2026-07-20T00:00:00.000Z", diffSha256: diffSha,
	}));
	// Full (or partial) coverage evidence for the small roster.
	const roster = buildRoster(IMPACT);
	const reads = roster.entries.flatMap((e) => e.expectedReads.map((t) => ({ reviewer: e.id, target: t })));
	const usable = opts.completeCoverage === false ? reads.filter((r) => r.reviewer !== "security") : reads;
	fs.writeFileSync(path.join(sessionDir, "evidence.jsonl"), usable.map((r) => JSON.stringify({ session: SESSION, kind: "read", target: r.target, at: "t", reviewer: r.reviewer, source: "cli" })).join("\n"));
	if (opts.observed) fs.writeFileSync(path.join(sessionDir, "hook-evidence.jsonl"), [...new Set(reads.map((r) => r.target))].map((t) => JSON.stringify({ session: SESSION, kind: "read", target: t, at: "t", source: "hook" })).join("\n"));
	if (opts.findings) fs.writeFileSync(path.join(sessionDir, "findings.json"), JSON.stringify(opts.findings));
	if (opts.ci !== undefined) fs.writeFileSync(path.join(sessionDir, "untrusted", "ci-checks.txt"), opts.ci);
}

beforeEach(() => { cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-compose-")); sessionDir = path.join(cwd, "tasks", "reviews", SESSION); fs.mkdirSync(sessionDir, { recursive: true }); });
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }); process.exitCode = 0; });
const run = () => reviewCompose({ session: SESSION, cwd, json: true, deps: noGh });

describe("reviewCompose — mechanical gate", () => {
	it("clean + session-observed + green → PASS / APPROVE, proof + payload written", async () => {
		seedSession({ observed: true, findings: [] });
		const r = await run();
		expect(r).toMatchObject({ ok: true, decision: "PASS", event: "APPROVE" });
		expect(fs.existsSync(path.join(sessionDir, `${SESSION}-verdict.json`))).toBe(true);
		expect(fs.existsSync(path.join(sessionDir, "submit-payload.json"))).toBe(true);
		const proof = JSON.parse(fs.readFileSync(path.join(sessionDir, `${SESSION}-verdict.json`), "utf-8"));
		expect(proof.coverage.sha256).toBeTruthy();
		expect(proof.decision).toBe("PASS");
	});

	it("REFUSES (no verdict) when coverage has gaps", async () => {
		seedSession({ observed: true, completeCoverage: false });
		const r = await run();
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/coverage incomplete/);
		expect(fs.existsSync(path.join(sessionDir, `${SESSION}-verdict.json`))).toBe(false);
	});

	it("caps at PASS_WITH_RISK when evidence is attested (no hook corroboration)", async () => {
		seedSession({ observed: false, findings: [] });
		const r = await run();
		expect(r.decision).toBe("PASS_WITH_RISK");
		expect(r.event).toBe("COMMENT");
		expect(r.reasons?.join(" ")).toMatch(/attested/);
	});

	it("BLOCKED on a confirmed Critical finding", async () => {
		seedSession({ observed: true, findings: [{ location: "src/a.ts:1", failureScenario: "eval injection", severity: "CRITICAL", confidence: "HIGH" }] });
		const r = await run();
		expect(r.decision).toBe("BLOCKED");
		expect(r.event).toBe("REQUEST_CHANGES");
	});

	it("caps at PASS_WITH_RISK when CI is red", async () => {
		seedSession({ observed: true, findings: [], ci: "build\tfailure\tCI failed" });
		const r = await run();
		expect(r.decision).toBe("PASS_WITH_RISK");
	});

	it("REFUSES when the diff hash does not match the manifest (tamper)", async () => {
		seedSession({ observed: true, tamperDiff: true });
		const r = await run();
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/hash does not match/);
	});

	it("REFUSES an invalid finding (schema)", async () => {
		seedSession({ observed: true, findings: [{ location: "x", severity: "NOPE" }] });
		const r = await run();
		expect(r.ok).toBe(false);
	});

	it("resolves an inline anchor by snippet against the captured diff", async () => {
		seedSession({ observed: true, findings: [{ location: "src/a.ts", failureScenario: "eval", severity: "MAJOR", confidence: "MEDIUM", snippet: "const risky = eval(x);" }] });
		await run();
		const proof = JSON.parse(fs.readFileSync(path.join(sessionDir, `${SESSION}-verdict.json`), "utf-8"));
		expect(proof.findings[0].anchor).toMatchObject({ file: "src/a.ts", line: 1 });
	});
});
