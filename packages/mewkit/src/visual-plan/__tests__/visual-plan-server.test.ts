/**
 * Visual Plan studio server (real socket): the GET route + ETag, the verbatim CSP
 * header (red-team M4), the static bundle path, the 404 empty-state, method gate,
 * and the inherited loopback Host guard (from local-web).
 */

import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import * as http from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { VisualPlanServer } from "../server/visual-plan-server.js";
import { STUDIO_CSP } from "../server/csp.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, writePlanArtifact, cleanup } from "./plan-dir-helper.js";

const dirs: string[] = [];
let bundleDir: string;

function makeBundle(): string {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), "vp-bundle-"));
	dirs.push(d);
	fs.writeFileSync(path.join(d, "index.html"), "<!doctype html><title>studio</title>");
	return d;
}

interface Resp {
	status: number;
	body: string;
	headers: http.IncomingHttpHeaders;
}
function request(port: number, opts: { method?: string; path?: string; host?: string } = {}): Promise<Resp> {
	return new Promise((resolve, reject) => {
		const headers: Record<string, string> = {};
		if (opts.host) headers.Host = opts.host;
		const req = http.request(
			{ hostname: "127.0.0.1", port, method: opts.method ?? "GET", path: opts.path ?? "/", headers },
			(res) => {
				let body = "";
				res.on("data", (c) => (body += c));
				res.on("end", () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
			},
		);
		req.on("error", reject);
		req.end();
	});
}

let server: VisualPlanServer;
let planDir: string;

beforeAll(async () => {
	bundleDir = makeBundle();
	planDir = createPlanDir(dirs);
	writePlanArtifact(planDir, makeValidPlan());
	server = new VisualPlanServer({ planDir, bundleDir });
	await server.start();
});
afterAll(async () => {
	await server.stop();
	cleanup(dirs);
});

describe("VisualPlanServer", () => {
	it("GET /api/visual-plan returns the artifact JSON with an ETag", async () => {
		const r = await request(server.port, { path: "/api/visual-plan" });
		expect(r.status).toBe(200);
		expect((JSON.parse(r.body) as { id: string }).id).toBe("sample-plan");
		expect(r.headers.etag).toMatch(/^[0-9a-f]{64}$/);
	});

	it("emits the exact studio CSP header on every response", async () => {
		const api = await request(server.port, { path: "/api/visual-plan" });
		const stat = await request(server.port, { path: "/" });
		expect(api.headers["content-security-policy"]).toBe(STUDIO_CSP);
		expect(stat.headers["content-security-policy"]).toBe(STUDIO_CSP);
	});

	it("serves the static bundle index for /", async () => {
		const r = await request(server.port, { path: "/" });
		expect(r.status).toBe(200);
		expect(r.body).toContain("studio");
	});

	it("405 for a non-GET on the api route", async () => {
		const r = await request(server.port, { method: "POST", path: "/api/visual-plan" });
		expect(r.status).toBe(405);
	});

	it("403 for a foreign Host header (inherited local-web guard)", async () => {
		const r = await request(server.port, { path: "/", host: "evil.test" });
		expect(r.status).toBe(403);
	});
});

describe("VisualPlanServer — empty state", () => {
	let empty: VisualPlanServer;
	afterEach(async () => {
		if (empty) await empty.stop();
	});
	it("404 when the plan has no artifact", async () => {
		const noArt = createPlanDir(dirs); // creates plan.md + visual-plan/ but no plan.json
		empty = new VisualPlanServer({ planDir: noArt, bundleDir });
		await empty.start();
		const r = await request(empty.port, { path: "/api/visual-plan" });
		expect(r.status).toBe(404);
	});
});
