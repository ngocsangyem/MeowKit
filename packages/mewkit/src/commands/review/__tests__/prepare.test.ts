import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Exec, type ExecResult, reviewPrepare } from "../prepare.js";
import { safeParseReviewManifest } from "../../../review/schema.js";

const DIFF = "diff --git a/src/api/users.ts b/src/api/users.ts\n--- a/src/api/users.ts\n+++ b/src/api/users.ts\n@@\n+export function getUserById(id) {}\n";
const OK = (out: string): ExecResult => ({ ok: true, out, err: "" });
const FAIL = (err: string): ExecResult => ({ ok: false, out: "", err });

// A fake exec that plays git/gh/worktree for a single-remote `me/repo` layout.
function makeExec(overrides: Partial<{ ghMeta: ExecResult; ghChecks: ExecResult; remotes: string }> = {}): Exec {
	return (file, args) => {
		if (file === "git" && args[0] === "remote") return OK(overrides.remotes ?? "origin\tgit@github.com:me/repo.git (fetch)\norigin\tgit@github.com:me/repo.git (push)\n");
		if (file === "node" && args[1] === "review-pr") {
			const pr = args[args.indexOf("--pr") + 1];
			const session = args[args.indexOf("--session") + 1];
			return OK(JSON.stringify({
				success: true,
				manifest: {
					schemaVersion: "1.0.0", session, nonce: "nonce123", worktreePath: `.worktrees/review-pr-${pr}-${session}`,
					pr: Number(pr), ref: `refs/mewkit/review-pr-${pr}-${session}`, headSha: "h".repeat(40), baseSha: "b".repeat(40),
					baseBranch: "main", baseRemote: "origin", host: "github", owner: "me", repo: "repo", createdAt: "2026-07-20T00:00:00.000Z",
				},
			}));
		}
		if (file === "git" && args[0] === "diff") return OK(DIFF);
		if (file === "gh" && args[1] === "view") return overrides.ghMeta ?? OK('{"title":"t","body":"b"}');
		if (file === "gh" && args[1] === "checks") return overrides.ghChecks ?? OK("all green");
		if (file === "git" && args[0] === "grep") return OK("src/routes/users.ts:12:getUserById(x)");
		return FAIL(`unexpected exec: ${file} ${args.join(" ")}`);
	};
}

let cwd: string;
beforeEach(() => { cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-prepare-")); });
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }); });

describe("reviewPrepare", () => {
	it("rejects an ambiguous bare number across multiple remotes", async () => {
		const exec: Exec = (file, args) => {
			if (file === "git" && args[0] === "remote") return OK("origin\tgit@github.com:me/fork.git (fetch)\nupstream\thttps://github.com/acme/repo.git (fetch)\n");
			return FAIL("should not reach");
		};
		const r = await reviewPrepare({ target: "7", cwd, json: true, deps: { exec, sessionId: () => "s1" } });
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/ambiguous/);
	});

	it("rejects an invalid target before touching git", async () => {
		const r = await reviewPrepare({ target: "not a pr", cwd, json: true, deps: { exec: makeExec(), sessionId: () => "s1" } });
		expect(r.ok).toBe(false);
	});

	it("captures a hashed immutable diff, impact map, and untrusted metadata", async () => {
		const r = await reviewPrepare({ target: "me/repo#7", cwd, json: true, deps: { exec: makeExec(), sessionId: () => "sess-a" } });
		expect(r.ok).toBe(true);
		const dir = path.join(cwd, "tasks", "reviews", "sess-a");
		expect(fs.existsSync(path.join(dir, "diff.patch"))).toBe(true);
		expect(fs.existsSync(path.join(dir, "impact-map.json"))).toBe(true);
		expect(fs.existsSync(path.join(dir, "manifest.json"))).toBe(true);
		expect(fs.existsSync(path.join(dir, "untrusted", "README.txt"))).toBe(true);
		expect(fs.existsSync(path.join(dir, "untrusted", "pr-metadata.json"))).toBe(true);

		const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf-8"));
		expect(safeParseReviewManifest(manifest).success).toBe(true);
		expect(manifest.diffSha256).toBe(crypto.createHash("sha256").update(DIFF).digest("hex"));

		const impact = JSON.parse(fs.readFileSync(path.join(dir, "impact-map.json"), "utf-8"));
		expect(impact.searchTerms).toContain("getUserById");
		// Only path:line is kept — the matched (attacker-controlled) source line is stripped (H1).
		expect(impact.callers[0].hits[0]).toBe("src/routes/users.ts:12");
		expect(impact.callers[0].hits[0]).not.toContain("getUserById(x)");
	});

	it("records context-unavailable when gh degrades, never silently omits", async () => {
		const exec = makeExec({ ghMeta: FAIL("HTTP 403 rate limit"), ghChecks: FAIL("no checks") });
		const r = await reviewPrepare({ target: "me/repo#7", cwd, json: true, deps: { exec, sessionId: () => "sess-b" } });
		expect(r.ok).toBe(true);
		const manifest = JSON.parse(fs.readFileSync(path.join(cwd, "tasks", "reviews", "sess-b", "manifest.json"), "utf-8"));
		expect(manifest.contextUnavailable).toEqual(expect.arrayContaining(["pr-metadata", "ci-checks"]));
	});

	it("re-running creates a NEW session and never mutates the old one", async () => {
		await reviewPrepare({ target: "me/repo#7", cwd, json: true, deps: { exec: makeExec(), sessionId: () => "run-1" } });
		const firstDiff = fs.readFileSync(path.join(cwd, "tasks", "reviews", "run-1", "diff.patch"), "utf-8");
		await reviewPrepare({ target: "me/repo#7", cwd, json: true, deps: { exec: makeExec(), sessionId: () => "run-2" } });
		expect(fs.existsSync(path.join(cwd, "tasks", "reviews", "run-1"))).toBe(true);
		expect(fs.existsSync(path.join(cwd, "tasks", "reviews", "run-2"))).toBe(true);
		expect(fs.readFileSync(path.join(cwd, "tasks", "reviews", "run-1", "diff.patch"), "utf-8")).toBe(firstDiff);
	});
});
