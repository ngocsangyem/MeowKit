import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reviewCleanup } from "../cleanup.js";

const SESSION = "sess-clean";
let cwd: string;
let sessionDir: string;
let calls: string[][];

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-clean-"));
	sessionDir = path.join(cwd, "tasks", "reviews", SESSION);
	fs.mkdirSync(sessionDir, { recursive: true });
	calls = [];
});
afterEach(() => { fs.rmSync(cwd, { recursive: true, force: true }); process.exitCode = 0; });

const exec = (ok: boolean) => (file: string, args: string[]) => { calls.push([file, ...args]); return { ok, out: ok ? "removed" : "", err: ok ? "" : "refused" }; };

describe("reviewCleanup", () => {
	it("errors when the session does not exist", async () => {
		const r = await reviewCleanup({ session: "ghost", cwd, json: true, deps: { exec: exec(true) } });
		expect(r.ok).toBe(false);
	});

	it("delegates to the manifest-owned worktree cleanup and keeps the session dir", async () => {
		fs.writeFileSync(path.join(sessionDir, "manifest.json"), "{}");
		fs.writeFileSync(path.join(sessionDir, "verdict.md"), "audit trail");
		const r = await reviewCleanup({ session: SESSION, cwd, json: true, deps: { exec: exec(true), worktreeScript: "/x/worktree.cjs" } });
		expect(r.ok).toBe(true);
		const call = calls[0];
		expect(call).toEqual(["node", "/x/worktree.cjs", "review-pr-cleanup", "--manifest", path.join("tasks", "reviews", SESSION, "manifest.json"), "--json"]);
		// audit trail preserved
		expect(fs.existsSync(path.join(sessionDir, "verdict.md"))).toBe(true);
	});

	it("surfaces a refused worktree cleanup as an error (never silent)", async () => {
		fs.writeFileSync(path.join(sessionDir, "manifest.json"), "{}");
		const r = await reviewCleanup({ session: SESSION, cwd, json: true, deps: { exec: exec(false), worktreeScript: "/x/worktree.cjs" } });
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/refused|failed/);
	});
});
