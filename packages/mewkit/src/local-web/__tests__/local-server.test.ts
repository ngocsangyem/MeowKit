/**
 * Characterization: the loopback server end-to-end over a real socket — binds
 * 127.0.0.1, enforces the Host guard (403 before the handler), serves static
 * files (200 path), and enforces the body cap (413) via bufferBody in a handler.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as http from "node:http";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LocalServer } from "../local-server.js";
import { serveStatic } from "../static-handler.js";
import { bufferBody, BodyError } from "../request-body.js";

let server: LocalServer;
let port: number;
let staticDir: string;

beforeAll(async () => {
	staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "lw-srv-"));
	fs.writeFileSync(path.join(staticDir, "index.html"), "<h1>home</h1>");
	server = new LocalServer({
		handler: (req, res) => {
			if (req.method === "POST" && req.url === "/echo") {
				bufferBody(req, 8, 1000)
					.then((buf) => {
						res.writeHead(200);
						res.end(buf);
					})
					.catch((err: unknown) => {
						res.writeHead(err instanceof BodyError ? err.status : 400);
						res.end(err instanceof BodyError ? err.tag : "error");
					});
				return;
			}
			serveStatic(req, res, staticDir);
		},
	});
	await server.start();
	port = server.port;
});

afterAll(async () => {
	await server.stop();
	fs.rmSync(staticDir, { recursive: true, force: true });
});

interface Resp {
	status: number;
	body: string;
}
function request(opts: { method?: string; path?: string; host?: string; body?: string }): Promise<Resp> {
	return new Promise((resolve, reject) => {
		const headers: Record<string, string> = {};
		if (opts.host) headers.Host = opts.host;
		const req = http.request(
			{ hostname: "127.0.0.1", port, method: opts.method ?? "GET", path: opts.path ?? "/", headers },
			(res) => {
				let body = "";
				res.on("data", (c) => (body += c));
				res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
			},
		);
		req.on("error", reject);
		if (opts.body) req.write(opts.body);
		req.end();
	});
}

describe("LocalServer", () => {
	it("binds a loopback URL with a real port", () => {
		expect(server.url).toBe(`http://127.0.0.1:${port}`);
		expect(port).toBeGreaterThan(0);
	});

	it("serves a static file for an allowed Host (200)", async () => {
		const r = await request({ path: "/" });
		expect(r.status).toBe(200);
		expect(r.body).toBe("<h1>home</h1>");
	});

	it("returns 403 for a foreign Host header (DNS-rebinding guard)", async () => {
		const r = await request({ path: "/", host: "evil.test" });
		expect(r.status).toBe(403);
	});

	it("accepts a body within the cap (200)", async () => {
		const r = await request({ method: "POST", path: "/echo", body: "hi" });
		expect(r.status).toBe(200);
		expect(r.body).toBe("hi");
	});

	it("drops the connection on an over-cap body (bufferBody destroys the socket)", async () => {
		// Source behavior preserved verbatim: overflow destroys the socket, so the
		// client sees a connection abort rather than a delivered 413. The 413
		// BodyError itself is asserted at the unit level in request-body.test.ts.
		await expect(request({ method: "POST", path: "/echo", body: "0123456789" })).rejects.toThrow();
	});
});
