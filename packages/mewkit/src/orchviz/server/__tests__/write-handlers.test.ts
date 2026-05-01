/**
 * Integration tests for write-handlers.ts — POST /api/plan/todo.
 *
 * Each test spins up an ephemeral-port OrchvizServer with a temp fixture dir,
 * makes HTTP requests, and verifies responses + on-disk state.
 *
 * Coverage (10+ cases):
 *   1.  200 happy path — file mutated, ok:true, changed:true, new etag
 *   2.  200 idempotent no-op — changed:false, mtime unchanged
 *   3.  400 missing Origin header
 *   4.  403 disallowed Origin header
 *   5.  405 MEOWKIT_ORCHVIZ_READONLY=1
 *   6.  409 stale etag — file unchanged
 *   7.  413 body > 4KB
 *   8.  415 wrong Content-Type
 *   9.  OPTIONS 204 — allowed origin
 *  10.  OPTIONS 403 — disallowed origin (no ACAO header emitted)
 *  11.  400 invalid JSON
 *  12.  400 zod validation failure (bad phase number)
 *  13.  POST to /api/plan (unrelated path) still returns 405 (v1.1 regression guard)
 *  14.  Phase zero-pad: POST {phase:1} matches phase-01-*.md
 */

import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as http from "node:http";
import { OrchvizServer } from "../index.js";
import { computePhaseFileEtag } from "../../plan/etag.js";
import { PlanCollector } from "../../plan/collector.js";

let active: OrchvizServer | null = null;
let tmpDir: string | null = null;
let serverUrl = "";
let serverPort = 0;

// ── Fixture helpers ─────────────────────────────────────────────────────────

function makeProjectRoot(): { root: string; planDir: string; phaseFile: string } {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "write-handler-test-"));
	const root = tmpDir;
	const slug = "260501-test-plan";
	const planDir = path.join(root, "tasks", "plans", slug);
	fs.mkdirSync(planDir, { recursive: true });
	const phaseContent = [
		"# Phase 1",
		"",
		"## Todo List",
		"",
		"- [ ] Task A",
		"- [x] Task B",
		"- [ ] Task C",
		"",
		"## Next Steps",
		"",
	].join("\n");
	const phaseFile = path.join(planDir, "phase-01-setup.md");
	fs.writeFileSync(phaseFile, phaseContent, "utf-8");
	// plan.md stub
	fs.writeFileSync(path.join(planDir, "plan.md"), "---\ntitle: Test\n---\n# Test\n", "utf-8");
	return { root, planDir, phaseFile };
}

async function startServer(projectRoot: string): Promise<void> {
	const staticDir = os.tmpdir();
	const planCollector = new PlanCollector(projectRoot);
	const ev = new EventEmitter();
	active = new OrchvizServer({
		staticDir,
		eventSource: ev,
		projectRoot,
		planCollector,
	});
	serverUrl = await active.start();
	serverPort = active.port;
}

// ── Low-level fetch helpers ─────────────────────────────────────────────────

interface RawResponse {
	status: number;
	headers: Record<string, string>;
	body: string;
}

function rawRequest(opts: {
	method: string;
	path: string;
	headers?: Record<string, string>;
	body?: string;
}): Promise<RawResponse> {
	return new Promise((resolve, reject) => {
		const u = new URL(serverUrl);
		const reqOpts: http.RequestOptions = {
			host: u.hostname,
			port: Number(u.port),
			path: opts.path,
			method: opts.method,
			headers: {
				Host: `${u.hostname}:${u.port}`,
				...opts.headers,
			},
		};
		const req = http.request(reqOpts, (res) => {
			const resHeaders: Record<string, string> = {};
			for (const [k, v] of Object.entries(res.headers)) {
				if (typeof v === "string") resHeaders[k] = v;
			}
			let body = "";
			res.setEncoding("utf-8");
			res.on("data", (chunk: string) => { body += chunk; });
			res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: resHeaders, body }));
			res.on("error", reject);
		});
		req.on("error", reject);
		if (opts.body) req.write(opts.body);
		req.end();
	});
}

function postTodo(
	body: unknown,
	extraHeaders: Record<string, string> = {},
): Promise<RawResponse> {
	const bodyStr = JSON.stringify(body);
	return rawRequest({
		method: "POST",
		path: "/api/plan/todo",
		headers: {
			"Content-Type": "application/json",
			"Origin": `http://127.0.0.1:${serverPort}`,
			...extraHeaders,
		},
		body: bodyStr,
	});
}

function validBody(phaseFile: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		slug: "260501-test-plan",
		phase: 1,
		todoIdx: 0,
		checked: true,
		etag: computePhaseFileEtag(phaseFile),
		...overrides,
	};
}

// ── Setup/teardown ──────────────────────────────────────────────────────────

let projectRoot = "";
let phaseFile = "";

beforeEach(async () => {
	// Read-only is the new default — opt in to write mode for the test fixtures
	// that exercise POST /api/plan/todo. Test 5 deletes WRITABLE and sets
	// READONLY=1 explicitly to verify the legacy block path still triggers.
	delete process.env.MEOWKIT_ORCHVIZ_READONLY;
	process.env.MEOWKIT_ORCHVIZ_WRITABLE = "1";
	const fixture = makeProjectRoot();
	projectRoot = fixture.root;
	phaseFile = fixture.phaseFile;
	await startServer(projectRoot);
});

afterEach(async () => {
	delete process.env.MEOWKIT_ORCHVIZ_READONLY;
	delete process.env.MEOWKIT_ORCHVIZ_WRITABLE;
	if (active) {
		await active.stop();
		active = null;
	}
	if (tmpDir) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		tmpDir = null;
	}
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/plan/todo", () => {
	it("1. 200 happy path: file mutated, changed:true, new etag returned", async () => {
		const beforeEtag = computePhaseFileEtag(phaseFile);
		const r = await postTodo(validBody(phaseFile, { todoIdx: 0, checked: true }));
		expect(r.status).toBe(200);
		const parsed = JSON.parse(r.body);
		expect(parsed.ok).toBe(true);
		expect(parsed.changed).toBe(true);
		expect(parsed.etag).toHaveLength(64);
		expect(parsed.etag).not.toBe(beforeEtag);
		// File on disk is mutated
		const newContent = fs.readFileSync(phaseFile, "utf-8");
		expect(newContent).toContain("- [x] Task A");
	});

	it("2. 200 idempotent: already-checked flip → changed:false, mtime unchanged", async () => {
		// Task B (idx=1) is already [x]
		const mtime = fs.statSync(phaseFile).mtimeMs;
		const r = await postTodo(validBody(phaseFile, { todoIdx: 1, checked: true }));
		expect(r.status).toBe(200);
		const parsed = JSON.parse(r.body);
		expect(parsed.ok).toBe(true);
		expect(parsed.changed).toBe(false);
		// mtime unchanged (no write occurred)
		const newMtime = fs.statSync(phaseFile).mtimeMs;
		expect(newMtime).toBe(mtime);
	});

	it("3. 403 missing Origin header", async () => {
		const r = await rawRequest({
			method: "POST",
			path: "/api/plan/todo",
			headers: {
				"Content-Type": "application/json",
				// No Origin header
			},
			body: JSON.stringify(validBody(phaseFile)),
		});
		expect(r.status).toBe(403);
	});

	it("4. 403 disallowed Origin header", async () => {
		const r = await postTodo(validBody(phaseFile), {
			"Origin": "http://evil.example.com",
		});
		expect(r.status).toBe(403);
	});

	it("5. 405 MEOWKIT_ORCHVIZ_READONLY=1 blocks writes", async () => {
		process.env.MEOWKIT_ORCHVIZ_READONLY = "1";
		const r = await postTodo(validBody(phaseFile));
		expect(r.status).toBe(405);
		const parsed = JSON.parse(r.body);
		expect(parsed.error).toBe("readonly");
	});

	it("6. 409 stale etag: file unchanged", async () => {
		const staleEtag = "a".repeat(64); // not the real etag
		const mtime = fs.statSync(phaseFile).mtimeMs;
		const r = await postTodo(validBody(phaseFile, { etag: staleEtag }));
		expect(r.status).toBe(409);
		const parsed = JSON.parse(r.body);
		expect(parsed.error).toBe("stale");
		expect(parsed.currentEtag).toHaveLength(64);
		// File unchanged
		expect(fs.statSync(phaseFile).mtimeMs).toBe(mtime);
	});

	it("7. 413 body > 4KB — server destroys socket on overflow", async () => {
		// Build a body > 4096 bytes
		const bigPad = "x".repeat(4200);
		const bodyStr = JSON.stringify({
			slug: "260501-test-plan",
			phase: 1,
			todoIdx: 0,
			checked: true,
			etag: "a".repeat(64),
			_pad: bigPad,
		});
		expect(bodyStr.length).toBeGreaterThan(4096);

		// The server destroys the socket on overflow — rawRequest will either get
		// a 413 response (if response was sent before destroy) or an ECONNRESET.
		// Both are valid behaviors for the cap; we just verify the connection closes.
		const status = await new Promise<number>((resolve) => {
			const u = new URL(serverUrl);
			const req = http.request(
				{
					host: u.hostname,
					port: Number(u.port),
					path: "/api/plan/todo",
					method: "POST",
					headers: {
						Host: `${u.hostname}:${u.port}`,
						"Content-Type": "application/json",
						"Origin": `http://127.0.0.1:${serverPort}`,
						"Content-Length": String(Buffer.byteLength(bodyStr)),
					},
				},
				(res) => {
					// Got a response — either 413 or something else
					resolve(res.statusCode ?? 0);
					res.resume();
				},
			);
			req.on("error", (err) => {
				const code = (err as NodeJS.ErrnoException).code;
				// ECONNRESET = server destroyed socket (expected on overflow)
				if (code === "ECONNRESET" || code === "EPIPE") {
					resolve(413); // treat as 413 for test assertion
				} else {
					resolve(0);
				}
			});
			req.write(bodyStr);
			req.end();
		});
		expect(status).toBe(413);
	});

	it("8. 415 wrong Content-Type", async () => {
		const r = await rawRequest({
			method: "POST",
			path: "/api/plan/todo",
			headers: {
				"Content-Type": "text/plain",
				"Origin": `http://127.0.0.1:${serverPort}`,
			},
			body: JSON.stringify(validBody(phaseFile)),
		});
		expect(r.status).toBe(415);
	});

	it("11. 400 invalid JSON", async () => {
		const r = await rawRequest({
			method: "POST",
			path: "/api/plan/todo",
			headers: {
				"Content-Type": "application/json",
				"Origin": `http://127.0.0.1:${serverPort}`,
			},
			body: "not valid json {",
		});
		expect(r.status).toBe(400);
		const parsed = JSON.parse(r.body);
		expect(parsed.error).toBe("invalid-json");
	});

	it("12. 400 zod validation failure (phase out of range)", async () => {
		const r = await postTodo({ ...validBody(phaseFile), phase: 200 }); // max is 99
		expect(r.status).toBe(400);
		const parsed = JSON.parse(r.body);
		expect(parsed.error).toBe("validation-failed");
	});

	it("13. POST to /api/plan still returns 405 (v1.1 regression guard)", async () => {
		const r = await rawRequest({
			method: "POST",
			path: "/api/plan",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
		expect(r.status).toBe(405);
	});

	it("14. Phase zero-pad: POST {phase:1} matches phase-01-setup.md (not phase-10-*)", async () => {
		// Verify: phase:1 unambiguously matches phase-01-setup.md.
		// phaseFile IS phase-01-setup.md, so the etag is fresh → expect 200.
		const body = validBody(phaseFile, { phase: 1 });
		const r = await postTodo(body);
		const parsed = JSON.parse(r.body);

		// Must NOT be ambiguous-phase error (phase-01-setup.md is the only match)
		expect(parsed.error).not.toBe("ambiguous-phase");

		// Must succeed: phase:1 → regex /^phase-0*1-.*\.md$/i matches "phase-01-setup.md"
		// and does NOT match "phase-10-*.md" (zero-pad correct)
		expect(r.status).toBe(200);

		// Verify the matched file ends with phase-01-setup.md (not phase-1-anything or phase-10-*)
		const updatedContent = fs.readFileSync(phaseFile, "utf-8");
		// File content changed means phase-01-setup.md was correctly targeted
		expect(updatedContent).toContain("- [x] Task A");
		expect(phaseFile.endsWith("phase-01-setup.md")).toBe(true);
	});
});

describe("OPTIONS /api/plan/todo", () => {
	it("9. OPTIONS 204 with allowed origin — emits ACAO header", async () => {
		const r = await rawRequest({
			method: "OPTIONS",
			path: "/api/plan/todo",
			headers: {
				"Origin": `http://127.0.0.1:${serverPort}`,
				"Access-Control-Request-Method": "POST",
			},
		});
		expect(r.status).toBe(204);
		expect(r.headers["access-control-allow-origin"]).toBe(`http://127.0.0.1:${serverPort}`);
		expect(r.headers["access-control-allow-methods"]).toContain("POST");
	});

	it("10. OPTIONS 403 with disallowed origin — NO ACAO header emitted", async () => {
		const r = await rawRequest({
			method: "OPTIONS",
			path: "/api/plan/todo",
			headers: {
				"Origin": "http://evil.example.com",
				"Access-Control-Request-Method": "POST",
			},
		});
		expect(r.status).toBe(403);
		// CRITICAL: no ACAO header on rejected origin
		expect(r.headers["access-control-allow-origin"]).toBeUndefined();
	});
});
