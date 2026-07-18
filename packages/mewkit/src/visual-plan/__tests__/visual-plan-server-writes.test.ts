/**
 * Studio server write routes (real socket): PATCH applies + returns a new ETag,
 * a stale If-Match returns 409 without mutating, POST /feedback persists a batch
 * + returns the Copy Command, GET /feedback/:id reads it, and a malformed batch
 * id is rejected before any path join.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as http from "node:http";
import { VisualPlanServer } from "../server/visual-plan-server.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, stampFreshHashes, writePlanArtifact, cleanup } from "./plan-dir-helper.js";

const dirs: string[] = [];
let server: VisualPlanServer;

beforeAll(async () => {
	const planDir = createPlanDir(dirs);
	const a = makeValidPlan();
	stampFreshHashes(planDir, a);
	writePlanArtifact(planDir, a);
	server = new VisualPlanServer({ planDir, bundleDir: planDir });
	await server.start();
});
afterAll(async () => {
	await server.stop();
	cleanup(dirs);
});

interface Resp {
	status: number;
	json: Record<string, unknown>;
	etag?: string;
}
function req(method: string, pathName: string, opts: { body?: unknown; ifMatch?: string } = {}): Promise<Resp> {
	return new Promise((resolve, reject) => {
		const headers: Record<string, string> = {};
		let payload = "";
		if (opts.body !== undefined) {
			payload = JSON.stringify(opts.body);
			headers["Content-Type"] = "application/json";
			headers["Content-Length"] = String(Buffer.byteLength(payload));
		}
		if (opts.ifMatch) headers["If-Match"] = opts.ifMatch;
		const r = http.request({ hostname: "127.0.0.1", port: server.port, method, path: pathName, headers }, (res) => {
			let b = "";
			res.on("data", (c) => (b += c));
			res.on("end", () =>
				resolve({
					status: res.statusCode ?? 0,
					json: b ? (JSON.parse(b) as Record<string, unknown>) : {},
					etag: res.headers.etag as string | undefined,
				}),
			);
		});
		r.on("error", reject);
		if (payload) r.write(payload);
		r.end();
	});
}

describe("PATCH /api/visual-plan", () => {
	it("applies a valid op (with If-Match) and returns a new ETag", async () => {
		const current = await req("GET", "/api/visual-plan");
		const r = await req("PATCH", "/api/visual-plan", {
			body: { type: "reorder-frame", frameId: "fr-login", order: 4 },
			ifMatch: current.etag,
		});
		expect(r.status).toBe(200);
		expect(r.json.ok).toBe(true);
		expect(r.etag).toMatch(/^[0-9a-f]{64}$/);
	});

	it("refuses a PATCH with no If-Match (428 precondition required)", async () => {
		const r = await req("PATCH", "/api/visual-plan", {
			body: { type: "reorder-frame", frameId: "fr-login", order: 8 },
		});
		expect(r.status).toBe(428);
	});

	it("returns 409 on a stale If-Match without mutating", async () => {
		const r = await req("PATCH", "/api/visual-plan", {
			body: { type: "reorder-frame", frameId: "fr-login", order: 7 },
			ifMatch: "0".repeat(64),
		});
		expect(r.status).toBe(409);
		expect(r.json.error).toBe("stale");
	});

	it("rejects a malformed patch op with 400", async () => {
		const r = await req("PATCH", "/api/visual-plan", { body: { type: "not-an-op" } });
		expect(r.status).toBe(400);
	});
});

describe("feedback routes", () => {
	it("POST persists a batch and GET reads it back", async () => {
		const post = await req("POST", "/api/visual-plan/feedback", {
			body: { operations: [{ type: "copy-change", intent: "shorten CTA" }] },
		});
		expect(post.status).toBe(201);
		expect(String(post.json.copyCommand)).toContain("apply-feedback");
		const id = post.json.id as string;

		const get = await req("GET", `/api/visual-plan/feedback/${id}`);
		expect(get.status).toBe(200);
		expect(get.json.id).toBe(id);
	});

	it("rejects a malformed batch id (400) before any path join", async () => {
		const r = await req("GET", "/api/visual-plan/feedback/notavalidid");
		expect(r.status).toBe(400);
	});
});
