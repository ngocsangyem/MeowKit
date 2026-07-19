import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	FindingSchema,
	SubmitPayloadSchema,
	VerdictStateSchema,
	parseReviewManifest,
	safeParseReviewManifest,
} from "../schema.js";

// Repo root — resolved from git, not CWD, so the suite runs from any directory.
const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	cwd: path.dirname(new URL(import.meta.url).pathname),
	encoding: "utf-8",
}).trim();
const WORKTREE_CJS = path.join(REPO_ROOT, ".claude", "skills", "worktree", "scripts", "worktree.cjs");

const validManifest = {
	schemaVersion: "1.0.0",
	session: "ci-example",
	nonce: "abc123def456",
	worktreePath: ".worktrees/review-pr-7-ci-example",
	pr: 7,
	ref: "refs/mewkit/review-pr-7-ci-example",
	headSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
	baseSha: "cafebabecafebabecafebabecafebabecafebabe",
	baseBranch: "main",
	baseRemote: "origin",
	host: "github",
	owner: "ngocsangyem",
	repo: "MeowKit",
	createdAt: "2026-07-19T00:00:00.000Z",
};

describe("ReviewManifestSchema", () => {
	it("accepts a well-formed manifest", () => {
		expect(safeParseReviewManifest(validManifest).success).toBe(true);
	});

	it("rejects a missing required field (headSha)", () => {
		const missing: Record<string, unknown> = { ...validManifest };
		delete missing.headSha;
		expect(safeParseReviewManifest(missing).success).toBe(false);
	});

	it("rejects a non-positive PR number", () => {
		expect(safeParseReviewManifest({ ...validManifest, pr: 0 }).success).toBe(false);
		expect(safeParseReviewManifest({ ...validManifest, pr: -3 }).success).toBe(false);
	});

	it("rejects an empty SHA (min length)", () => {
		expect(safeParseReviewManifest({ ...validManifest, headSha: "" }).success).toBe(false);
	});

	it("rejects an unsupported host", () => {
		expect(safeParseReviewManifest({ ...validManifest, host: "gitlab" }).success).toBe(false);
	});

	it("keeps unknown forward-compat fields (passthrough)", () => {
		const parsed = parseReviewManifest({ ...validManifest, futureField: 42 });
		expect((parsed as Record<string, unknown>).futureField).toBe(42);
	});

	// Injection-class regression: ref/worktreePath reach git + the filesystem, so a
	// tampered manifest carrying shell metacharacters or an out-of-namespace path
	// must be rejected by the contract (not just neutralized downstream).
	it("rejects a ref carrying shell metacharacters", () => {
		expect(safeParseReviewManifest({ ...validManifest, ref: "refs/x ; rm -rf / #" }).success).toBe(false);
	});

	it("rejects a worktreePath outside the review namespace", () => {
		expect(safeParseReviewManifest({ ...validManifest, worktreePath: "../../etc/passwd" }).success).toBe(false);
		expect(safeParseReviewManifest({ ...validManifest, worktreePath: ".worktrees/feat-x" }).success).toBe(false);
	});
});

describe("FindingSchema", () => {
	it("accepts a finding with severity + confidence", () => {
		expect(
			FindingSchema.safeParse({
				location: "src/a.ts:12",
				failureScenario: "empty input → throws",
				severity: "CRITICAL",
				confidence: "HIGH",
			}).success,
		).toBe(true);
	});

	it("rejects an out-of-vocab severity", () => {
		expect(
			FindingSchema.safeParse({
				location: "src/a.ts:12",
				failureScenario: "x",
				severity: "BLOCKER",
				confidence: "HIGH",
			}).success,
		).toBe(false);
	});
});

describe("VerdictStateSchema", () => {
	it("accepts PASS_WITH_RISK (I3: WARN maps here, no decision-level WARN)", () => {
		const r = VerdictStateSchema.safeParse({
			decision: "PASS_WITH_RISK",
			dimensions: [{ name: "Correctness", verdict: "WARN" }],
		});
		expect(r.success).toBe(true);
	});

	it("rejects a decision-level WARN", () => {
		expect(
			VerdictStateSchema.safeParse({ decision: "WARN", dimensions: [] }).success,
		).toBe(false);
	});
});

describe("SubmitPayloadSchema", () => {
	it("binds a submit to a head SHA and a review event", () => {
		expect(
			SubmitPayloadSchema.safeParse({
				host: "github",
				owner: "o",
				repo: "r",
				pr: 1,
				headSha: "deadbeef",
				event: "APPROVE",
				body: "lgtm",
			}).success,
		).toBe(true);
	});
});

// Cross-boundary parity: the CommonJS `worktree review-pr` action cannot import the
// Zod schema, so this proves the manifest it emits validates under this contract.
// Dry-run does no network/git-mutation; SHAs are placeholders but non-empty.
describe("worktree.cjs manifest ↔ schema parity", () => {
	it("dry-run manifest parses under ReviewManifestSchema", () => {
		const out = execFileSync(
			"node",
			[WORKTREE_CJS, "review-pr", "--pr", "7", "--remote", "origin", "--session", "parity-check", "--dry-run", "--json"],
			{ cwd: REPO_ROOT, encoding: "utf-8" },
		);
		const parsed = JSON.parse(out);
		expect(parsed.success).toBe(true);
		expect(parsed.dryRun).toBe(true);
		const result = safeParseReviewManifest(parsed.wouldCreate?.manifest);
		expect(result.success).toBe(true);
	});
});
