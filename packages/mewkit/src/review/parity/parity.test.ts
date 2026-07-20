import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveImpactFromDiff } from "../impact-map.js";
import { matchRemote, parseGitRemotes, parsePrTarget } from "../pr-target.js";
import { buildRoster } from "../roster.js";
import { safeParseFinding, safeParseReviewManifest } from "../schema.js";
import { computeVerdict, type VerdictInput } from "../verdict.js";
import { reviewCompose } from "../../commands/review/compose.js";
import { reviewCoverage } from "../../commands/review/coverage.js";
import { reviewRead } from "../../commands/review/read.js";
import { reviewSubmit } from "../../commands/review/submit.js";

// ── Operational-parity qualification matrix (Phase 7). Deterministic: no network, no
// live GitHub, no model calls. One test per capability-table row; safety-critical rows
// are tagged [SC]. Scenarios 21-23 gate alongside the 20-row matrix. The Qwen `/review`
// reference source is NOT present in-tree, so this is a SPEC-DRIVEN matrix (scenarios
// from the design report + plan contracts), not a line-traced comparison — the residual
// gap is documented in the Phase 7 report.

const REPO = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	cwd: path.dirname(new URL(import.meta.url).pathname),
	encoding: "utf-8",
}).trim();
const readRepo = (rel: string) => fs.readFileSync(path.join(REPO, rel), "utf-8");
const require = createRequire(import.meta.url);
// The worktree ownership guard is CommonJS (.cjs) — load it via require for the
// isolation/cleanup scenarios (02, 20).
const reviewPrCjs = require(path.join(REPO, ".claude/skills/worktree/scripts/lib/worktree-review-pr.cjs"));
const cleanVerdict: VerdictInput = {
	confirmedCritical: false,
	coverageComplete: true,
	evidenceLevel: "session-observed",
	ciRed: false,
	ciAllSkipped: false,
	contextUnavailable: [],
	selfPR: false,
};

let cwd: string;
beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-parity-"));
});
afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
	process.exitCode = 0;
});

// Seed a review session under cwd for coverage/compose scenarios.
const IMPACT = { scoutRequired: false, stats: { sourceChanged: 40, totalChanged: 50 }, changedFiles: [] };
const DIFF = "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,0 +1,1 @@\n+const x = 1;\n";
function seedSession(
	session: string,
	opts: { observed?: boolean; complete?: boolean; findings?: unknown[]; ci?: string } = {},
) {
	const dir = path.join(cwd, "tasks", "reviews", session);
	fs.mkdirSync(path.join(dir, "untrusted"), { recursive: true });
	fs.writeFileSync(path.join(dir, "diff.patch"), DIFF);
	fs.writeFileSync(path.join(dir, "impact-map.json"), JSON.stringify(IMPACT));
	fs.writeFileSync(
		path.join(dir, "manifest.json"),
		JSON.stringify({
			schemaVersion: "1.0.0",
			session,
			nonce: "n",
			worktreePath: `.worktrees/review-pr-7-${session}`,
			pr: 7,
			ref: `refs/mewkit/review-pr-7-${session}`,
			headSha: "h".repeat(40),
			baseSha: "b".repeat(40),
			baseBranch: "main",
			baseRemote: "origin",
			host: "github",
			owner: "o",
			repo: "r",
			createdAt: "t",
			diffSha256: crypto.createHash("sha256").update(DIFF).digest("hex"),
		}),
	);
	const reads = buildRoster(IMPACT).entries.flatMap((e) => e.expectedReads.map((t) => ({ reviewer: e.id, target: t })));
	const usable = opts.complete === false ? reads.filter((r) => r.reviewer !== "security") : reads;
	fs.writeFileSync(
		path.join(dir, "evidence.jsonl"),
		usable
			.map((r) =>
				JSON.stringify({ session, kind: "read", target: r.target, at: "t", reviewer: r.reviewer, source: "cli" }),
			)
			.join("\n"),
	);
	if (opts.observed)
		fs.writeFileSync(
			path.join(dir, "hook-evidence.jsonl"),
			[...new Set(reads.map((r) => r.target))]
				.map((t) => JSON.stringify({ session, kind: "read", target: t, at: "t", source: "hook" }))
				.join("\n"),
		);
	if (opts.findings) fs.writeFileSync(path.join(dir, "findings.json"), JSON.stringify(opts.findings));
	if (opts.ci !== undefined) fs.writeFileSync(path.join(dir, "untrusted", "ci-checks.txt"), opts.ci);
	return dir;
}
const noGh = { exec: () => ({ ok: false, out: "", err: "" }) };
const REMOTES = parseGitRemotes(
	"origin\tgit@github.com:me/fork.git (fetch)\nupstream\thttps://github.com/acme/widget.git (fetch)\n",
);

describe("Parity matrix (20 capability rows)", () => {
	it("01 PR target parsing rejects ambiguous/invalid input", () => {
		expect(parsePrTarget("not a pr").ok).toBe(false);
		expect(matchRemote(REMOTES, { host: "github", pr: 9 }).ok).toBe(false); // bare number, ambiguous
	});

	it("02 [SC] same-repo isolation: the main worktree can never be cleaned by a review flow", () => {
		const main = { path: "/repo", branch: "main", detached: false, isMainWorktree: true };
		expect(
			reviewPrCjs.isOwnedReviewWorktree(
				{ pr: 7, session: "s", nonce: "n", worktreePath: ".worktrees/review-pr-7-s" },
				main,
				{ nonce: "n" },
			).ok,
		).toBe(false);
	});

	it("03 [SC] wrong / ambiguous remote rejected", () => {
		expect(matchRemote(REMOTES, { host: "github", owner: "ghost", repo: "nope", pr: 1 }).ok).toBe(false);
		expect(matchRemote(REMOTES, { host: "github", owner: "acme", repo: "widget", pr: 1 }, "origin").ok).toBe(false); // override points at fork
	});

	it("04 SHA binding: manifest carries the head/base SHA captured at prepare", () => {
		const dir = seedSession("s04");
		const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf-8"));
		expect(safeParseReviewManifest(m).success).toBe(true);
		expect(m.headSha).toHaveLength(40);
	});

	it("05 [SC] head change before submit → abort/restart, no post", async () => {
		const dir = seedSession("s05");
		fs.writeFileSync(
			path.join(dir, "submit-payload.json"),
			JSON.stringify({
				host: "github",
				owner: "o",
				repo: "r",
				pr: 7,
				headSha: "h".repeat(40),
				event: "APPROVE",
				body: "x",
			}),
		);
		const payload = JSON.parse(fs.readFileSync(path.join(dir, "submit-payload.json"), "utf-8"));
		const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
		const calls: string[][] = [];
		const r = await reviewSubmit({
			session: "s05",
			reply: true,
			confirm: hash,
			cwd,
			json: true,
			deps: {
				exec: (f, a) => {
					calls.push([f, ...a]);
					return f === "gh" && a[0] === "api"
						? { ok: true, out: "DIFFERENT".padEnd(40, "x"), err: "" }
						: { ok: true, out: "", err: "" };
				},
			},
		});
		expect(r.ok).toBe(false);
		expect(calls.some((c) => c[1] === "pr" && c[2] === "review")).toBe(false);
	});

	it("06 immutable diff manifest: hash mismatch detected → compose refuses", async () => {
		const dir = seedSession("s06", { observed: true });
		fs.writeFileSync(path.join(dir, "diff.patch"), `${DIFF}TAMPER\n`);
		const r = await reviewCompose({ session: "s06", cwd, json: true, deps: noGh });
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/hash does not match/);
	});

	it("07 project rules / PR content treated as data (untrusted quarantine marker)", () => {
		// prepare writes untrusted/README.txt with the DATA-not-instructions marker.
		expect(readRepo(".claude/skills/review-pr/SKILL.md")).toMatch(/untrusted DATA|UNTRUSTED DATA|untrusted\//);
	});

	it("08 small diff → dimension roster; large diff → territory + whole-diff roster", () => {
		expect(
			buildRoster({ scoutRequired: false, stats: { sourceChanged: 50, totalChanged: 60 }, changedFiles: [] }).tier,
		).toBe("small");
		const large = buildRoster({
			scoutRequired: false,
			stats: { sourceChanged: 5000, totalChanged: 6000 },
			changedFiles: [{ path: "src/a.ts", kind: "source", deleted: false, added: 3, removed: 1 }],
		});
		expect(large.tier).toBe("large");
		expect(large.entries.some((e) => e.dimension === "territory")).toBe(true);
		expect(large.entries.some((e) => e.wholeDiff)).toBe(true);
	});

	it("09 all review lenses present in generated briefs", () => {
		const dims = buildRoster({
			scoutRequired: false,
			stats: { sourceChanged: 50, totalChanged: 60 },
			changedFiles: [],
		}).entries.map((e) => e.dimension);
		expect(dims).toEqual(expect.arrayContaining(["issue-fidelity", "correctness", "security", "tests", "build-test"]));
	});

	it("10 [SC] missing session-observed read caps approval", async () => {
		seedSession("s10", { observed: false, findings: [] }); // attested (no hook corroboration)
		const r = await reviewCompose({ session: "s10", cwd, json: true, deps: noGh });
		expect(r.decision).toBe("PASS_WITH_RISK"); // NOT PASS/APPROVE
		expect(r.event).not.toBe("APPROVE");
	});

	it("11 build/test evidence step is specified from the session worktree", () => {
		expect(readRepo(".claude/skills/review/step-04-verdict.md")).toMatch(/[Bb]uild\/test evidence/);
	});

	it("12 finding schema enforcement (reject a finding without a failure scenario)", () => {
		expect(safeParseFinding({ location: "a.ts:1", severity: "MAJOR", confidence: "LOW" }).success).toBe(false);
	});

	it("13 batch verification gates Critical findings (Critical → BLOCKED)", () => {
		expect(computeVerdict({ ...cleanVerdict, confirmedCritical: true }).decision).toBe("BLOCKED");
		expect(readRepo(".claude/skills/review/step-04-verdict.md")).toMatch(/[Bb]atch verification/);
	});

	it("14 reverse audit runs exactly once (single-round bound stated)", () => {
		expect(readRepo(".claude/skills/review/step-04-verdict.md")).toMatch(/exactly ONE round|No second round/);
	});

	it("15 [SC] red CI caps approval", () => {
		expect(computeVerdict({ ...cleanVerdict, ciRed: true }).decision).toBe("PASS_WITH_RISK");
	});

	it("16 deterministic verdict from evidence + caps (same input → same output)", () => {
		expect(computeVerdict(cleanVerdict)).toEqual(computeVerdict(cleanVerdict));
		expect(computeVerdict(cleanVerdict).decision).toBe("PASS");
	});

	it("17 Gate 2 proof bundle accepted by verdict-gate + coverage validator", async () => {
		const dir = seedSession("s17", { observed: true, findings: [] });
		await reviewCompose({ session: "s17", cwd, json: true, deps: noGh });
		const proofPath = path.join(dir, "s17-verdict.json");
		expect(fs.existsSync(proofPath)).toBe(true);
		// the gate2 coverage validator accepts a session-observed complete PASS bundle
		let code = 0;
		try {
			execFileSync("node", [path.join(REPO, ".claude/scripts/validate-review-coverage.cjs"), proofPath], {
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch (e) {
			code = (e as { status?: number }).status ?? 1;
		}
		expect(code).toBe(0);
	});

	it("18 [SC] submit without --reply + confirmation cannot write GitHub", async () => {
		const dir = path.join(cwd, "tasks", "reviews", "s18");
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(
			path.join(dir, "submit-payload.json"),
			JSON.stringify({
				host: "github",
				owner: "o",
				repo: "r",
				pr: 7,
				headSha: "h".repeat(40),
				event: "APPROVE",
				body: "x",
			}),
		);
		const calls: string[][] = [];
		const r = await reviewSubmit({
			session: "s18",
			cwd,
			json: true,
			deps: {
				exec: (f, a) => {
					calls.push([f, ...a]);
					return { ok: true, out: "", err: "" };
				},
			},
		});
		expect(r.ok).toBe(false);
		expect(calls).toHaveLength(0);
	});

	it("19 [SC] deleted export breaking a caller is surfaced (removed-behavior + scout)", () => {
		const d =
			"diff --git a/src/api.ts b/src/api.ts\ndeleted file mode 100644\n--- a/src/api.ts\n+++ /dev/null\n@@\n-export const getUser = 1;\n";
		const m = deriveImpactFromDiff(d);
		expect(m.removedOrRenamed.length).toBeGreaterThan(0);
		expect(m.scoutRequired).toBe(true);
	});

	it("20 [SC] cleanup removes only session worktree; a non-session worktree survives", () => {
		const feature = { path: "/repo/.worktrees/feat-x", branch: "feat/x", detached: false, isMainWorktree: false };
		expect(
			reviewPrCjs.isOwnedReviewWorktree(
				{ pr: 7, session: "s", nonce: "n", worktreePath: ".worktrees/review-pr-7-s" },
				feature,
				{ nonce: "n" },
			).ok,
		).toBe(false);
	});
});

describe("Additional gating scenarios (21-23)", () => {
	it("21 [SC] fork layout: pull/N/head fetched from the BASE remote, never the fork", () => {
		const r = matchRemote(REMOTES, { host: "github", owner: "acme", repo: "widget", pr: 9 });
		expect(r.ok && r.value.remote).toBe("upstream"); // base repo remote, not origin (the fork)
	});

	it("22 live-capture (NOT stubbed): real hook dispatcher corroborates a session-observed chain", async () => {
		const session = "s22";
		const dir = path.join(cwd, "tasks", "reviews", session);
		fs.mkdirSync(path.join(dir, "briefs"), { recursive: true });
		fs.writeFileSync(path.join(dir, "impact-map.json"), JSON.stringify(IMPACT));
		fs.writeFileSync(path.join(dir, "diff.patch"), DIFF);
		const { writeRoster } = await import("../roster.js");
		writeRoster(dir, buildRoster(IMPACT), session);
		fs.writeFileSync(
			path.join(dir, "manifest.json"),
			JSON.stringify({
				schemaVersion: "1.0.0",
				session,
				nonce: "n",
				worktreePath: `.worktrees/review-pr-7-${session}`,
				pr: 7,
				ref: `refs/mewkit/review-pr-7-${session}`,
				headSha: "h".repeat(40),
				baseSha: "b".repeat(40),
				baseBranch: "main",
				baseRemote: "origin",
				host: "github",
				owner: "o",
				repo: "r",
				createdAt: "t",
			}),
		);
		const dispatch = path.join(REPO, ".claude/hooks/dispatch.cjs");
		for (const e of buildRoster(IMPACT).entries) {
			for (const t of e.expectedReads) {
				await reviewRead({ session, as: e.id, target: t, cwd });
				execFileSync("node", [dispatch, "PostToolUse", "Bash"], {
					input: JSON.stringify({
						tool_input: { command: `mewkit review read --session ${session} --as ${e.id} ${t}` },
						cwd,
					}),
					encoding: "utf-8",
					env: { ...process.env, CLAUDE_PROJECT_DIR: REPO },
				});
			}
		}
		const cov = await reviewCoverage({ session, cwd, json: false, silent: true });
		expect(cov.complete).toBe(true);
		expect(cov.evidenceLevel).toBe("session-observed");
	});

	it("23 impact-map escalation: deleted export + new util across dirs → scout required with citations", () => {
		const d = [
			"diff --git a/src/api/old.ts b/src/api/old.ts",
			"deleted file mode 100644",
			"--- a/src/api/old.ts",
			"+++ /dev/null",
			"@@",
			"-export function gone() {}",
			"diff --git a/src/lib/new-util.ts b/src/lib/new-util.ts",
			"--- a/src/lib/new-util.ts",
			"+++ b/src/lib/new-util.ts",
			"@@ -0,0 +1,1 @@",
			"+export function helper() {}",
		].join("\n");
		const m = deriveImpactFromDiff(d);
		expect(m.scoutRequired).toBe(true);
		expect(m.riskFlags).toContain("ABSTRACTION");
		expect(m.searchTerms).toEqual(expect.arrayContaining(["helper"]));
	});
});
