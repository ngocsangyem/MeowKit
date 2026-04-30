/**
 * Static file serving with path-traversal guard.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (app/src/static.ts).
 * License Apache-2.0 (see ../../NOTICE).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".ico": "image/x-icon",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".json": "application/json; charset=utf-8",
};

function mimeFor(filePath: string): string {
	return MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function send404(res: ServerResponse): void {
	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end("Not Found");
}

export function serveStatic(
	req: IncomingMessage,
	res: ServerResponse,
	staticDir: string,
): void {
	if (req.method !== "GET" && req.method !== "HEAD") {
		res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain" });
		res.end("Method Not Allowed");
		return;
	}
	const reqUrl = req.url ?? "/";
	// Defense in depth: reject any request containing ".." even after parsing.
	if (reqUrl.includes("..")) {
		send404(res);
		return;
	}
	const url = new URL(reqUrl, "http://127.0.0.1");
	let pathname = url.pathname;
	if (pathname === "/") pathname = "/index.html";

	const baseDir = path.resolve(staticDir);
	const candidate = path.resolve(baseDir, "." + pathname);
	if (candidate !== baseDir && !candidate.startsWith(baseDir + path.sep)) {
		send404(res);
		return;
	}

	let stat: fs.Stats;
	try {
		stat = fs.statSync(candidate);
	} catch {
		send404(res);
		return;
	}
	if (!stat.isFile()) {
		send404(res);
		return;
	}

	const isAsset = pathname.startsWith("/assets/");
	const headers: Record<string, string> = {
		"Content-Type": mimeFor(candidate),
		"Content-Length": String(stat.size),
		"Cache-Control": isAsset
			? "public, max-age=31536000, immutable"
			: "no-cache",
	};
	res.writeHead(200, headers);
	if (req.method === "HEAD") {
		res.end();
		return;
	}
	const stream = fs.createReadStream(candidate);
	stream.on("error", () => res.end());
	stream.pipe(res);
}
