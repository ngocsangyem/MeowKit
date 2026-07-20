import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildRoster, writeRoster } from "../../../review/roster.js";
import { reviewCoverage } from "../coverage.js";
import { reviewRead } from "../read.js";

// Release-gating live-capture test (plan C2): drive the ACTUAL PostToolUse:Bash
// dispatcher (.claude/hooks/dispatch.cjs → review-evidence-tag.cjs) for real, then
// assert the CLI receipts + the hook-tagged events intersect to `session-observed`.
// Exercises the real handler code path, not a re-implementation of it.

const REPO = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	cwd: path.dirname(new URL(import.meta.url).pathname),
	encoding: "utf-8",
}).trim();
const DISPATCH = path.join(REPO, ".claude", "hooks", "dispatch.cjs");
const SESSION = "sess-int";
const IMPACT = { scoutRequired: false, stats: { sourceChanged: 40, totalChanged: 50 }, changedFiles: [] };

let cwd: string;
let sessionDir: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-int-"));
	sessionDir = path.join(cwd, "tasks", "reviews", SESSION);
	fs.mkdirSync(sessionDir, { recursive: true });
	fs.writeFileSync(path.join(sessionDir, "impact-map.json"), JSON.stringify(IMPACT));
	fs.writeFileSync(path.join(sessionDir, "diff.patch"), "diff\n");
	writeRoster(sessionDir, buildRoster(IMPACT), SESSION); // materializes briefs/*.md
	fs.writeFileSync(path.join(sessionDir, "manifest.json"), JSON.stringify({
		schemaVersion: "1.0.0", session: SESSION, nonce: "n", worktreePath: `.worktrees/review-pr-7-${SESSION}`,
		pr: 7, ref: `refs/mewkit/review-pr-7-${SESSION}`, headSha: "h".repeat(40), baseSha: "b".repeat(40),
		baseBranch: "main", baseRemote: "origin", host: "github", owner: "o", repo: "r", createdAt: "t",
	}));
});
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }); process.exitCode = 0; });

// Fire the REAL dispatcher exactly as Claude Code would for a Bash PostToolUse.
function fireBashHook(command: string) {
	execFileSync("node", [DISPATCH, "PostToolUse", "Bash"], {
		input: JSON.stringify({ tool_input: { command }, cwd }),
		encoding: "utf-8",
		env: { ...process.env, CLAUDE_PROJECT_DIR: REPO },
	});
}

const assignedReads = () => buildRoster(IMPACT).entries.flatMap((e) => e.expectedReads.map((t) => ({ as: e.id, target: t })));

describe("live-capture evidence chain (real dispatcher)", () => {
	it("every roster read done via CLI + real hook tag → coverage session-observed & approve-eligible", async () => {
		for (const { as, target } of assignedReads()) {
			await reviewRead({ session: SESSION, as, target, cwd });
			fireBashHook(`mewkit review read --session ${SESSION} --as ${as} ${target}`);
		}
		expect(fs.existsSync(path.join(sessionDir, "hook-evidence.jsonl"))).toBe(true);
		const cov = await reviewCoverage({ session: SESSION, cwd, json: true });
		expect(cov.complete).toBe(true);
		expect(cov.evidenceLevel).toBe("session-observed");
		expect(cov.approveEligible).toBe(true);
	});

	it("without the hook firing, the same CLI reads stay attested", async () => {
		for (const { as, target } of assignedReads()) await reviewRead({ session: SESSION, as, target, cwd });
		const cov = await reviewCoverage({ session: SESSION, cwd, json: true });
		expect(cov.complete).toBe(true);
		expect(cov.evidenceLevel).toBe("attested");
	});

	it("the handler is INERT for non-review Bash (no ambient logging)", () => {
		fireBashHook("ls -la /tmp");
		expect(fs.existsSync(path.join(sessionDir, "hook-evidence.jsonl"))).toBe(false);
	});

	it("the handler is INERT when the session dir does not exist (fail-open)", () => {
		fireBashHook("mewkit review read --session ghost-session --as correctness diff.patch");
		expect(fs.existsSync(path.join(cwd, "tasks", "reviews", "ghost-session"))).toBe(false);
	});
});
