import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reviewSubmit } from "../submit.js";

const SESSION = "sess-submit";
const HEAD = "a".repeat(40);
const PAYLOAD = { host: "github", owner: "o", repo: "r", pr: 7, headSha: HEAD, event: "APPROVE", body: "PASS" };
const HASH = crypto.createHash("sha256").update(JSON.stringify(PAYLOAD)).digest("hex");

let cwd: string;
let sessionDir: string;
let calls: string[][];

// Fake gh: head SHA re-fetch returns `headNow`; `gh pr review` succeeds and is recorded.
function fakeExec(headNow = HEAD) {
	return (file: string, args: string[]) => {
		calls.push([file, ...args]);
		if (file === "gh" && args[0] === "api") return { ok: true, out: `${headNow}\n`, err: "" };
		if (file === "gh" && args[0] === "pr" && args[1] === "review") return { ok: true, out: "posted", err: "" };
		return { ok: false, out: "", err: "unexpected" };
	};
}

beforeEach(() => {
	cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mk-submit-"));
	sessionDir = path.join(cwd, "tasks", "reviews", SESSION);
	fs.mkdirSync(sessionDir, { recursive: true });
	fs.writeFileSync(path.join(sessionDir, "submit-payload.json"), JSON.stringify(PAYLOAD));
	calls = [];
});
afterEach(() => {
	fs.rmSync(cwd, { recursive: true, force: true });
	process.exitCode = 0;
});

describe("reviewSubmit — write guards", () => {
	it("refuses without --reply (no write authority)", async () => {
		const r = await reviewSubmit({ session: SESSION, confirm: HASH, cwd, json: true, deps: { exec: fakeExec() } });
		expect(r.ok).toBe(false);
		expect(calls).toHaveLength(0);
	});

	it("refuses without --confirm and surfaces the payload hash to confirm", async () => {
		const r = await reviewSubmit({ session: SESSION, reply: true, cwd, json: true, deps: { exec: fakeExec() } });
		expect(r.ok).toBe(false);
		expect(r.error).toContain(HASH);
		expect(calls).toHaveLength(0);
	});

	it("refuses a stale/wrong confirmation hash", async () => {
		const r = await reviewSubmit({
			session: SESSION,
			reply: true,
			confirm: "wronghash",
			cwd,
			json: true,
			deps: { exec: fakeExec() },
		});
		expect(r.ok).toBe(false);
		expect(calls).toHaveLength(0); // never re-fetches / posts
	});

	it("posts exactly one review with the correct event flag when authorized", async () => {
		const r = await reviewSubmit({
			session: SESSION,
			reply: true,
			confirm: HASH,
			cwd,
			json: true,
			deps: { exec: fakeExec() },
		});
		expect(r).toMatchObject({ ok: true, posted: true });
		const review = calls.find((c) => c[1] === "pr" && c[2] === "review");
		expect(review).toContain("--approve");
		expect(fs.existsSync(path.join(sessionDir, "submitted.json"))).toBe(true);
	});

	it("aborts WITHOUT posting when the PR head changed since prepare", async () => {
		const r = await reviewSubmit({
			session: SESSION,
			reply: true,
			confirm: HASH,
			cwd,
			json: true,
			deps: { exec: fakeExec("b".repeat(40)) },
		});
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/head changed/);
		expect(calls.some((c) => c[1] === "pr" && c[2] === "review")).toBe(false); // no post
		expect(fs.existsSync(path.join(sessionDir, "submitted.json"))).toBe(false);
	});

	it("is idempotent — a second submit does not double-post", async () => {
		await reviewSubmit({ session: SESSION, reply: true, confirm: HASH, cwd, json: true, deps: { exec: fakeExec() } });
		calls = [];
		const r2 = await reviewSubmit({
			session: SESSION,
			reply: true,
			confirm: HASH,
			cwd,
			json: true,
			deps: { exec: fakeExec() },
		});
		expect(r2.alreadyPosted).toBe(true);
		expect(calls.some((c) => c[1] === "pr" && c[2] === "review")).toBe(false);
	});
});
