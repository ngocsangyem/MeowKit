/**
 * Server smoke test — launches OrchvizServer on port 0 and verifies routing.
 */

import { describe, expect, it, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";
import { URL } from "node:url";
import { OrchvizServer } from "../src/orchviz/server/index.js";

let active: OrchvizServer | null = null;
let tmpDir: string | null = null;

afterEach(async () => {
	if (active) {
		await active.stop();
		active = null;
	}
	if (tmpDir) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		tmpDir = null;
	}
});

async function fetchStatus(url: string, opts: RequestInit = {}): Promise<{ status: number; body: string; headers: Record<string, string> }> {
	const res = await fetch(url, opts);
	const headers: Record<string, string> = {};
	res.headers.forEach((v, k) => {
		headers[k] = v;
	});
	return { status: res.status, body: await res.text(), headers };
}

describe("OrchvizServer", () => {
	it("serves /api/overlays as JSON", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchviz-static-"));
		fs.writeFileSync(path.join(tmpDir, "index.html"), "<html></html>");
		const ev = new EventEmitter();
		active = new OrchvizServer({
			staticDir: tmpDir,
			eventSource: ev,
		});
		const url = await active.start();
		const r = await fetchStatus(`${url}/api/overlays`);
		expect(r.status).toBe(200);
		const parsed = JSON.parse(r.body);
		expect(parsed).toHaveProperty("gate1");
		expect(parsed).toHaveProperty("model");
	});

	it("rejects path traversal with 404", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchviz-static-"));
		fs.writeFileSync(path.join(tmpDir, "index.html"), "<html></html>");
		const ev = new EventEmitter();
		active = new OrchvizServer({ staticDir: tmpDir, eventSource: ev });
		const url = await active.start();
		const r = await fetchStatus(`${url}/../../etc/passwd`);
		expect(r.status).toBe(404);
	});

	it("rejects non-GET methods with 405", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchviz-static-"));
		fs.writeFileSync(path.join(tmpDir, "index.html"), "<html></html>");
		const ev = new EventEmitter();
		active = new OrchvizServer({ staticDir: tmpDir, eventSource: ev });
		const url = await active.start();
		const r = await fetchStatus(`${url}/events`, { method: "POST" });
		expect(r.status).toBe(405);
	});

	it("replays agent_spawn registry to fresh clients (regression)", async () => {
		// Bug: when a browser connects mid-session, the SSE ring buffer (200 events)
		// has already evicted the early agent_spawn events. Without registry replay,
		// tool_call_* events arrive but state.agents.get(name) returns undefined →
		// no nodes ever render in the canvas.
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchviz-static-"));
		fs.writeFileSync(path.join(tmpDir, "index.html"), "<html></html>");
		const ev = new EventEmitter();
		active = new OrchvizServer({ staticDir: tmpDir, eventSource: ev });
		const url = await active.start();
		// Emit an agent_spawn BEFORE any client connects, then flood the ring buffer
		// with 250 unrelated events (capacity is 200) to evict it.
		ev.emit("event", {
			time: 0,
			type: "agent_spawn",
			payload: { name: "orchestrator", isMain: true },
			sessionId: "test-sess",
		});
		for (let i = 0; i < 250; i++) {
			ev.emit("event", {
				time: i,
				type: "tool_call_start",
				payload: { agent: "orchestrator", tool: "Bash", args: `cmd-${i}` },
				sessionId: "test-sess",
			});
		}
		const u = new URL(url);
		const seen: string[] = [];
		await new Promise<void>((resolve, reject) => {
			const req = http.request(
				{ host: u.hostname, port: u.port, path: "/events", method: "GET" },
				(res) => {
					res.setEncoding("utf-8");
					res.on("data", (chunk: string) => {
						for (const line of chunk.split("\n")) {
							if (line.startsWith("data: ")) {
								try {
									const obj = JSON.parse(line.slice(6)) as { type: string };
									seen.push(obj.type);
								} catch {
									/* ignore */
								}
							}
						}
						if (seen.length >= 5) {
							req.destroy();
							resolve();
						}
					});
					res.on("error", reject);
				},
			);
			req.on("error", (err) => {
				// req.destroy() above triggers ECONNRESET — expected, not a failure.
				if ((err as NodeJS.ErrnoException).code === "ECONNRESET") resolve();
				else reject(err);
			});
			req.end();
		});
		// Without the registry replay this would be all tool_call_start; the fix
		// guarantees agent_spawn appears in the first frames sent to a new client.
		expect(seen).toContain("agent_spawn");
		expect(seen.indexOf("agent_spawn")).toBeLessThan(3);
	});

	it("rejects bad Host header with 403 (DNS-rebind defense)", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchviz-static-"));
		fs.writeFileSync(path.join(tmpDir, "index.html"), "<html></html>");
		const ev = new EventEmitter();
		active = new OrchvizServer({ staticDir: tmpDir, eventSource: ev });
		const url = await active.start();
		const u = new URL(url);
		// Use raw http.request — Node fetch strips override Host headers (undici).
		const status = await new Promise<number>((resolve, reject) => {
			const req = http.request(
				{
					host: u.hostname,
					port: u.port,
					path: "/api/overlays",
					method: "GET",
					headers: { Host: "evil.example.com" },
				},
				(res) => {
					resolve(res.statusCode ?? 0);
					res.resume();
				},
			);
			req.on("error", reject);
			req.end();
		});
		expect(status).toBe(403);
	});
});
