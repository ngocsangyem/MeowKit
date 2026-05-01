/**
 * Security smoke tests — adversarial and regression cases for OrchvizServer.
 *
 *   Adv-3  Symlink-out (M15): symlink inside planDir → 403; target unchanged
 *   Adv-4  Slow-loris (M11): body trickle triggers 5s timeout socket destroy
 *   R2-13  Orphaned .orchviz-tmp-* > 5min cleaned on next write
 *   V1-1   GET /api/plan most-recent works (no slug)
 *   V1-2   serveStatic 404 on unknown path
 *   V1-3   SSE /events responds with text/event-stream
 *   V1-4   Bad Host header → 403
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as http from "node:http";
import { OrchvizServer } from "../index.js";
import { PlanCollector } from "../../plan/collector.js";
import { computePhaseFileEtag } from "../../plan/etag.js";
import { resetPlansDirCache } from "../write-utils.js";

let active: OrchvizServer | null = null;
let tmpDir: string | null = null;
let serverUrl = "";
let serverPort = 0;
let currentSlug = "";

function makeProjectRoot(): string {
	currentSlug = `260501-smoke-${Date.now()}`;
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "security-smoke-"));
	const plansDir = path.join(tmpDir, "tasks", "plans", currentSlug);
	fs.mkdirSync(plansDir, { recursive: true });
	fs.writeFileSync(path.join(plansDir, "phase-01-smoke.md"),
		"# Phase 1\n\n## Todo List\n\n- [ ] Smoke task A\n- [ ] Smoke task B\n", "utf-8");
	fs.writeFileSync(path.join(plansDir, "plan.md"),
		"---\ntitle: Smoke\nstatus: draft\n---\n# Smoke\n", "utf-8");
	return tmpDir;
}

async function startServer(root: string): Promise<void> {
	resetPlansDirCache();
	const planCollector = new PlanCollector(root);
	const ev = new EventEmitter();
	active = new OrchvizServer({ staticDir: os.tmpdir(), eventSource: ev, projectRoot: root,
		planCollector, planProvider: (slug?: string) => planCollector.snapshot(slug) });
	serverUrl = await active.start();
	serverPort = active.port;
}

/** GET that resolves on headers (safe for SSE — doesn't wait for stream end). */
function headGet(urlPath: string, hdrs: Record<string, string> = {}): Promise<{ status: number; body: string; ct: string }> {
	const u = new URL(serverUrl);
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ hostname: u.hostname, port: Number(u.port), path: urlPath, method: "GET",
				headers: { Host: `${u.hostname}:${u.port}`, ...hdrs } },
			(res) => {
				const ct = typeof res.headers["content-type"] === "string" ? res.headers["content-type"] : "";
				let body = "";
				res.setEncoding("utf-8");
				res.on("data", (c: string) => { body += c; });
				res.on("end", () => resolve({ status: res.statusCode ?? 0, body, ct }));
				// For SSE: destroy after first data or after 50ms so the stream doesn't hang
				setTimeout(() => { try { res.destroy(); req.destroy(); } catch { /* ok */ }
					resolve({ status: res.statusCode ?? 0, body, ct }); }, 50);
				res.on("error", (e: NodeJS.ErrnoException) => {
					if (e.code === "ECONNRESET" || e.code === "ERR_HTTP_SOCKET_CLOSED") return;
					reject(e);
				});
			},
		);
		req.on("error", (e: NodeJS.ErrnoException) => {
			if (e.code === "ECONNRESET") return;
			reject(e);
		});
		req.end();
	});
}

function postTodo(body: unknown, extraHdrs: Record<string, string> = {}): Promise<{ status: number; body: string }> {
	const u = new URL(serverUrl);
	const bodyStr = JSON.stringify(body);
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ hostname: u.hostname, port: Number(u.port), path: "/api/plan/todo", method: "POST",
				headers: { Host: `${u.hostname}:${u.port}`, "Content-Type": "application/json",
					Origin: `http://127.0.0.1:${serverPort}`, "Content-Length": String(Buffer.byteLength(bodyStr)), ...extraHdrs } },
			(res) => {
				let body = "";
				res.setEncoding("utf-8");
				res.on("data", (c: string) => { body += c; });
				res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
				res.on("error", reject);
			},
		);
		req.on("error", reject);
		req.write(bodyStr);
		req.end();
	});
}

beforeEach(async () => { delete process.env.MEOWKIT_ORCHVIZ_READONLY; await startServer(makeProjectRoot()); });
afterEach(async () => {
	delete process.env.MEOWKIT_ORCHVIZ_READONLY;
	if (active) { await active.stop(); active = null; }
	if (tmpDir) { fs.rmSync(tmpDir, { recursive: true, force: true }); tmpDir = null; }
	resetPlansDirCache();
});

describe("Adv-3: symlink-out (M15)", () => {
	it("POST to symlinked phase outside planDir → 4xx; target unchanged", async () => {
		const outsideTarget = path.join(os.tmpdir(), `orchviz-outside-${Date.now()}.md`);
		fs.writeFileSync(outsideTarget, "sensitive data — must not be touched", "utf-8");
		try {
			const planDir = path.join(tmpDir!, "tasks", "plans", currentSlug);
			try { fs.symlinkSync(outsideTarget, path.join(planDir, "phase-09-evil.md")); }
			catch { fs.unlinkSync(outsideTarget); return; }
			const etag = computePhaseFileEtag(path.join(planDir, "phase-01-smoke.md"));
			const r = await postTodo({ slug: currentSlug, phase: 9, todoIdx: 0, checked: true, etag });
			expect([400, 403]).toContain(r.status);
			expect((JSON.parse(r.body) as Record<string, unknown>).ok).toBeUndefined();
			expect(fs.readFileSync(outsideTarget, "utf-8")).toBe("sensitive data — must not be touched");
		} finally { try { fs.unlinkSync(outsideTarget); } catch { /* ok */ } }
	});
});

describe("Adv-4: slow-loris (M11)", () => {
	it("server destroys socket at 5s timeout", async () => {
		const start = Date.now();
		const result = await new Promise<{ closed: boolean; elapsed: number }>((resolve) => {
			const u = new URL(serverUrl);
			const req = http.request(
				{ hostname: u.hostname, port: Number(u.port), path: "/api/plan/todo", method: "POST",
					headers: { Host: `${u.hostname}:${u.port}`, "Content-Type": "application/json",
						Origin: `http://127.0.0.1:${serverPort}`, "Transfer-Encoding": "chunked" } },
				(res) => { res.resume(); resolve({ closed: true, elapsed: Date.now() - start }); },
			);
			req.on("error", (err) => { const c = (err as NodeJS.ErrnoException).code;
				resolve({ closed: c === "ECONNRESET" || c === "EPIPE" || c === "ECONNREFUSED", elapsed: Date.now() - start }); });
			let sent = 0;
			const tick = setInterval(() => {
				sent++;
				try { req.write("{"); } catch { clearInterval(tick); resolve({ closed: true, elapsed: Date.now() - start }); }
				if (sent > 10) { clearInterval(tick); req.destroy(); resolve({ closed: false, elapsed: Date.now() - start }); }
			}, 1000);
		});
		expect(result.closed).toBe(true);
		expect(result.elapsed).toBeLessThan(6500);
	}, 8000);
});

describe("R2-13: orphan tmp cleanup", () => {
	it("orphaned .orchviz-tmp-* older than 5min removed on next write", async () => {
		const planDir = path.join(tmpDir!, "tasks", "plans", currentSlug);
		const orphan1 = path.join(planDir, ".orchviz-tmp-fakeorphan1");
		const orphan2 = path.join(planDir, ".orchviz-tmp-fakeorphan2");
		fs.writeFileSync(orphan1, "o1"); fs.writeFileSync(orphan2, "o2");
		const t = new Date(Date.now() - 6 * 60 * 1000);
		fs.utimesSync(orphan1, t, t); fs.utimesSync(orphan2, t, t);
		const etag = computePhaseFileEtag(path.join(planDir, "phase-01-smoke.md"));
		const r = await postTodo({ slug: currentSlug, phase: 1, todoIdx: 0, checked: true, etag });
		expect(r.status).toBe(200);
		expect(JSON.parse(r.body)).toMatchObject({ ok: true });
		expect(fs.existsSync(orphan1)).toBe(false);
		expect(fs.existsSync(orphan2)).toBe(false);
	});
});

describe("V1.1 regression smokes", () => {
	it("V1-1: GET /api/plan returns 200 with non-null plan", async () => {
		const { status, body } = await headGet("/api/plan");
		expect(status).toBe(200);
		const json = JSON.parse(body) as { plan: unknown; readonly: boolean };
		expect(json.plan).not.toBeNull();
	});
	it("V1-2: GET /nonexistent → 404", async () => {
		expect((await headGet("/nonexistent-path-xyz")).status).toBe(404);
	});
	it("V1-3: GET /events returns text/event-stream", async () => {
		const { status, ct } = await headGet("/events");
		expect(status).toBe(200);
		expect(ct).toContain("text/event-stream");
	});
	it("V1-4: bad Host → 403", async () => {
		expect((await headGet("/api/plan", { Host: "evil.example.com" })).status).toBe(403);
	});
});
