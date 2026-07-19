import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reviewRead } from "../read.js";

let cwd: string;
let sessionDir: string;
let worktreeDir: string;
const SESSION = "sess-read";

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-read-"));
	sessionDir = path.join(cwd, "tasks", "reviews", SESSION);
	worktreeDir = path.join(cwd, ".worktrees", `review-pr-7-${SESSION}`);
	fs.mkdirSync(sessionDir, { recursive: true });
	fs.mkdirSync(path.join(worktreeDir, "src"), { recursive: true });
	fs.writeFileSync(path.join(sessionDir, "diff.patch"), "the diff\n");
	fs.writeFileSync(path.join(worktreeDir, "src", "a.ts"), "source\n");
	fs.writeFileSync(path.join(sessionDir, "manifest.json"), JSON.stringify({
		schemaVersion: "1.0.0", session: SESSION, nonce: "n", worktreePath: `.worktrees/review-pr-7-${SESSION}`,
		pr: 7, ref: `refs/mewkit/review-pr-7-${SESSION}`, headSha: "h".repeat(40), baseSha: "b".repeat(40),
		baseBranch: "main", baseRemote: "origin", host: "github", owner: "o", repo: "r", createdAt: "t",
	}));
});
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }); process.exitCode = 0; });

const evidence = () => {
	const f = path.join(sessionDir, "evidence.jsonl");
	return fs.existsSync(f) ? fs.readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
};

describe("reviewRead", () => {
	it("reads a session-dir artifact and appends a CLI evidence receipt", async () => {
		const r = await reviewRead({ session: SESSION, as: "correctness", target: "diff.patch", cwd, now: () => "T" });
		expect(r.ok).toBe(true);
		expect(r.content).toBe("the diff\n");
		const ev = evidence();
		expect(ev).toHaveLength(1);
		expect(ev[0]).toMatchObject({ session: SESSION, kind: "read", target: "diff.patch", reviewer: "correctness", source: "cli" });
	});

	it("reads a source file inside the review worktree", async () => {
		const r = await reviewRead({ session: SESSION, as: "correctness", target: "src/a.ts", cwd });
		expect(r.ok).toBe(true);
		expect(r.content).toBe("source\n");
	});

	it("REFUSES a path-traversal target and records NO evidence", async () => {
		const r = await reviewRead({ session: SESSION, as: "correctness", target: "../../../etc/passwd", cwd });
		expect(r.ok).toBe(false);
		expect(evidence()).toHaveLength(0);
	});

	it("REFUSES an absolute path outside the roots", async () => {
		const r = await reviewRead({ session: SESSION, as: "correctness", target: "/etc/hosts", cwd });
		expect(r.ok).toBe(false);
	});

	it("REFUSES a symlink whose target escapes the worktree (exfiltration guard)", async () => {
		const secret = path.join(cwd, "outside-secret.txt");
		fs.writeFileSync(secret, "TOP-SECRET\n");
		fs.symlinkSync(secret, path.join(worktreeDir, "src", "evil.ts"));
		const r = await reviewRead({ session: SESSION, as: "security", target: "src/evil.ts", cwd });
		expect(r.ok).toBe(false);
		expect(r.content).toBeUndefined();
		expect(evidence()).toHaveLength(0);
	});

	it("rejects an invalid session id", async () => {
		const r = await reviewRead({ session: "bad/slash", as: "correctness", target: "diff.patch", cwd });
		expect(r.ok).toBe(false);
	});

	it("fails when the session does not exist", async () => {
		const r = await reviewRead({ session: "no-such-session", as: "correctness", target: "diff.patch", cwd });
		expect(r.ok).toBe(false);
	});
});
