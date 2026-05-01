/**
 * End-to-end integration tests: real OrchvizServer + real fixture dirs + real fs.
 *
 *   E2E-1  GET /api/plans archived filter — 2 entries (a + c-codefence); b-archived skipped
 *   E2E-2  GET→POST→fs diff — only the targeted line changes on disk
 *   E2E-3  Code-fence e2e — fake [ ] inside fence is NOT toggled; first REAL todo flips
 *   E2E-4  Phase zero-pad e2e — POST {phase:1} matches phase-01-setup.md
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import { bootTestServer, type TestServerHandle } from "../../test-server-boot.js";
import { computePhaseFileEtag } from "../etag.js";

const FIXTURES_DIR = path.resolve(
	path.dirname(new URL(import.meta.url).pathname),
	"../../../..", // packages/mewkit
	"tests/fixtures/plans",
);

let handle: TestServerHandle | null = null;

beforeEach(async () => {
	// Read-only is the default — these tests exercise the write endpoint, opt in.
	process.env.MEOWKIT_ORCHVIZ_WRITABLE = "1";
	handle = await bootTestServer({ fixturesDir: FIXTURES_DIR });
});
afterEach(async () => {
	delete process.env.MEOWKIT_ORCHVIZ_WRITABLE;
	if (handle) { await handle.cleanup(); handle = null; }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function get(urlPath: string): Promise<{ status: number; body: string }> {
	const { port } = handle!;
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ hostname: "127.0.0.1", port, path: urlPath, method: "GET",
				headers: { Host: `127.0.0.1:${port}` } },
			(res) => {
				let body = "";
				res.setEncoding("utf-8");
				res.on("data", (c: string) => { body += c; });
				res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
				res.on("error", reject);
			},
		);
		req.on("error", reject);
		req.end();
	});
}

function post(body: unknown, extraHeaders: Record<string, string> = {}): Promise<{ status: number; body: string }> {
	const { port } = handle!;
	const bodyStr = JSON.stringify(body);
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				hostname: "127.0.0.1", port, path: "/api/plan/todo", method: "POST",
				headers: {
					Host: `127.0.0.1:${port}`, "Content-Type": "application/json",
					Origin: `http://127.0.0.1:${port}`,
					"Content-Length": String(Buffer.byteLength(bodyStr)),
					...extraHeaders,
				},
			},
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("E2E-1: GET /api/plans archived filter", () => {
	it("returns 2 entries (a + c-codefence); b-archived skipped; sorted mtime-desc", async () => {
		const { status, body } = await get("/api/plans");
		expect(status).toBe(200);
		const json = JSON.parse(body) as { plans: Array<{ slug: string; mtimeMs: number }> };
		const slugs = json.plans.map((p) => p.slug);
		expect(slugs).toContain("260501-fixture-a");
		expect(slugs).toContain("260501-fixture-c-codefence");
		expect(slugs).not.toContain("260501-fixture-b-archived");
		expect(json.plans).toHaveLength(2);
		if (json.plans.length >= 2) {
			expect(json.plans[0].mtimeMs).toBeGreaterThanOrEqual(json.plans[1].mtimeMs);
		}
	});
});

describe("E2E-2: GET→POST→fs diff", () => {
	it("only the targeted todo line changes on disk after POST", async () => {
		const phaseFile = path.join(handle!.projectRoot, "tasks", "plans", "260501-fixture-a", "phase-01-setup.md");
		const contentBefore = fs.readFileSync(phaseFile, "utf-8");

		const getRes = await get("/api/plan?slug=260501-fixture-a");
		expect(getRes.status).toBe(200);
		const planJson = JSON.parse(getRes.body) as { phaseEtags?: Record<string, string> };
		const phase1Etag = planJson.phaseEtags?.["1"];
		expect(phase1Etag).toBeDefined();

		const postRes = await post({ slug: "260501-fixture-a", phase: 1, todoIdx: 0, checked: true, etag: phase1Etag });
		expect(postRes.status).toBe(200);
		const postJson = JSON.parse(postRes.body) as { ok: boolean; changed: boolean; etag: string };
		expect(postJson.ok).toBe(true);
		expect(postJson.changed).toBe(true);
		expect(postJson.etag).toHaveLength(64);

		const contentAfter = fs.readFileSync(phaseFile, "utf-8");
		const linesBefore = contentBefore.split("\n");
		const linesAfter = contentAfter.split("\n");
		const changedLines = linesBefore.map((l, i) => (l !== linesAfter[i] ? i : -1)).filter((i) => i >= 0);
		expect(changedLines).toHaveLength(1);
		expect(linesAfter[changedLines[0]]).toContain("- [x]");
		expect(linesAfter[changedLines[0]]).toContain("Initialize project");
		expect(postJson.etag).toBe(computePhaseFileEtag(phaseFile));
	});
});

describe("E2E-3: Code-fence e2e", () => {
	it("fake [ ] inside code fence is NOT toggled; first REAL todo flips", async () => {
		const phaseFile = path.join(handle!.projectRoot, "tasks", "plans", "260501-fixture-c-codefence", "phase-01-fenced.md");
		const etag = computePhaseFileEtag(phaseFile);

		const postRes = await post({ slug: "260501-fixture-c-codefence", phase: 1, todoIdx: 0, checked: true, etag });
		expect(postRes.status).toBe(200);
		expect(JSON.parse(postRes.body)).toMatchObject({ ok: true, changed: true });

		const after = fs.readFileSync(phaseFile, "utf-8");
		expect(after).toContain("- [ ] FAKE — should be skipped"); // fence line unchanged
		expect(after).toContain("- [x] Real todo alpha");          // first real todo flipped
		expect(after).toContain("- [ ] Real todo beta");           // second real todo unchanged
	});
});

describe("E2E-4: Phase zero-pad regex", () => {
	it("POST {phase:1} matches phase-01-setup.md and does not touch phase-02-build.md", async () => {
		const plansDir = path.join(handle!.projectRoot, "tasks", "plans", "260501-fixture-a");
		const phaseFile = path.join(plansDir, "phase-01-setup.md");
		const phase2File = path.join(plansDir, "phase-02-build.md");
		const etag = computePhaseFileEtag(phaseFile);

		const postRes = await post({ slug: "260501-fixture-a", phase: 1, todoIdx: 0, checked: true, etag });
		const json = JSON.parse(postRes.body) as Record<string, unknown>;
		expect(json.error).not.toBe("ambiguous-phase");
		expect(postRes.status).toBe(200);
		expect(fs.readFileSync(phaseFile, "utf-8")).toContain("- [x] Initialize project");
		expect(phaseFile.endsWith("phase-01-setup.md")).toBe(true);
		expect(fs.readFileSync(phase2File, "utf-8")).toContain("- [ ] Write source files");
	});
});
