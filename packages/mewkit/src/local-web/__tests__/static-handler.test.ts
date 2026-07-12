/**
 * Characterization: static handler rejection paths (traversal guard, method
 * gate, missing/non-file). The 200 file-serving path is exercised end-to-end in
 * local-server.test.ts against a real socket.
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { serveStatic } from "../static-handler.js";

let tmp: string | null = null;
afterEach(() => {
	if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
	tmp = null;
});

interface MockRes {
	status: number;
	ended: boolean;
	writeHead: (code: number, headers?: Record<string, string>) => MockRes;
	end: (chunk?: unknown) => void;
}
function mockRes(): MockRes {
	const res: MockRes = {
		status: 0,
		ended: false,
		writeHead(code) {
			res.status = code;
			return res;
		},
		end() {
			res.ended = true;
		},
	};
	return res;
}
const req = (method: string, url: string): IncomingMessage => ({ method, url }) as unknown as IncomingMessage;

describe("serveStatic — rejection paths", () => {
	it("405 for non-GET/HEAD", () => {
		const res = mockRes();
		serveStatic(req("POST", "/"), res as unknown as ServerResponse, os.tmpdir());
		expect(res.status).toBe(405);
	});

	it("404 for any URL containing '..' (traversal defense in depth)", () => {
		const res = mockRes();
		serveStatic(req("GET", "/../../etc/passwd"), res as unknown as ServerResponse, os.tmpdir());
		expect(res.status).toBe(404);
	});

	it("404 for a missing file", () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lw-static-"));
		const res = mockRes();
		serveStatic(req("GET", "/nope.js"), res as unknown as ServerResponse, tmp);
		expect(res.status).toBe(404);
	});

	it("404 when the resolved path is a directory, not a file", () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lw-static-"));
		fs.mkdirSync(path.join(tmp, "sub"));
		const res = mockRes();
		serveStatic(req("GET", "/sub"), res as unknown as ServerResponse, tmp);
		expect(res.status).toBe(404);
	});
});
