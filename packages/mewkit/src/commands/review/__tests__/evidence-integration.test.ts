import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reviewCoverage } from "../coverage.js";
import { reviewRead } from "../read.js";

// Release-gating live-capture test (plan C2): drive the ACTUAL PostToolUse:Bash
// dispatcher (.claude/hooks/dispatch.cjs → review-evidence-tag.cjs) for real, then
// assert the CLI receipt + the hook-tagged event intersect to `session-observed`.
// This is the runtime proof the stubbed parity matrix (Phase 7) cannot give: it
// exercises the real handler code path, not a re-implementation of it.

const REPO = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	cwd: path.dirname(new URL(import.meta.url).pathname),
	encoding: "utf-8",
}).trim();
const DISPATCH = path.join(REPO, ".claude", "hooks", "dispatch.cjs");
const SESSION = "sess-int";
const REQUIRED = ["diff.patch", "briefs/correctness.md"];

let cwd: string;
let sessionDir: string;

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-int-"));
	sessionDir = path.join(cwd, "tasks", "reviews", SESSION);
	fs.mkdirSync(path.join(sessionDir, "briefs"), { recursive: true });
	fs.writeFileSync(path.join(sessionDir, "impact-map.json"), JSON.stringify({ scoutRequired: false }));
	fs.writeFileSync(path.join(sessionDir, "diff.patch"), "diff\n");
	fs.writeFileSync(path.join(sessionDir, "briefs", "correctness.md"), "brief\n");
	fs.writeFileSync(path.join(sessionDir, "manifest.json"), JSON.stringify({
		schemaVersion: "1.0.0", session: SESSION, nonce: "n", worktreePath: `.worktrees/review-pr-7-${SESSION}`,
		pr: 7, ref: `refs/mewkit/review-pr-7-${SESSION}`, headSha: "h".repeat(40), baseSha: "b".repeat(40),
		baseBranch: "main", baseRemote: "origin", host: "github", owner: "o", repo: "r", createdAt: "t",
	}));
});
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }); process.exitCode = 0; });

// Fire the REAL dispatcher exactly as Claude Code would for a Bash PostToolUse.
function fireBashHook(command: string) {
	const payload = JSON.stringify({ tool_input: { command }, cwd });
	execFileSync("node", [DISPATCH, "PostToolUse", "Bash"], {
		input: payload,
		encoding: "utf-8",
		env: { ...process.env, CLAUDE_PROJECT_DIR: REPO },
	});
}

describe("live-capture evidence chain (real dispatcher)", () => {
	it("CLI read + real hook tag → coverage reports session-observed", async () => {
		for (const target of REQUIRED) {
			await reviewRead({ session: SESSION, as: "correctness", target, cwd });
			fireBashHook(`mewkit review read --session ${SESSION} --as correctness ${target}`);
		}
		// The real handler must have written the corroborating hook events.
		const hookLog = path.join(sessionDir, "hook-evidence.jsonl");
		expect(fs.existsSync(hookLog)).toBe(true);
		const hookEvents = fs.readFileSync(hookLog, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
		expect(hookEvents.map((e) => e.target).sort()).toEqual([...REQUIRED].sort());
		expect(hookEvents.every((e) => e.source === "hook")).toBe(true);

		const cov = await reviewCoverage({ session: SESSION, cwd, json: true });
		expect(cov.complete).toBe(true);
		expect(cov.evidenceLevel).toBe("session-observed");
		expect(cov.approveEligible).toBe(true);
	});

	it("without the hook firing, the same CLI reads stay attested", async () => {
		for (const target of REQUIRED) await reviewRead({ session: SESSION, as: "correctness", target, cwd });
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
