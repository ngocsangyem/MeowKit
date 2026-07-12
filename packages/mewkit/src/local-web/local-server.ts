/**
 * Loopback HTTP server lifecycle — 127.0.0.1 bind + Host guard + port fallback.
 *
 * Server lifecycle ported from patoles/agent-flow @ 59ccf4e (app/src/server.ts).
 * License Apache-2.0 — see the repository NOTICE file.
 *
 * Domain-neutral: it owns ONLY binding, the DNS-rebinding Host guard, port
 * fallback, and graceful shutdown. All routing is delegated to the injected
 * `handler` — this layer has no knowledge of any product's routes or payloads.
 * A request whose `Host` header fails the guard gets 403 before the handler
 * ever sees it.
 */

import * as http from "node:http";
import { LOOPBACK_HOST, CLOSE_GRACE_MS } from "./constants.js";
import { isHostAllowed } from "./host-guard.js";

export type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

export interface LocalServerOptions {
	/** Fixed port, or 0/undefined for a random free port. A busy fixed port falls back to random. */
	port?: number;
	/** Routes every Host-allowed request. */
	handler: RequestHandler;
	/** Emit a one-line note to stderr on port fallback. */
	verbose?: boolean;
}

export class LocalServer {
	private server: http.Server | null = null;
	private actualPort = 0;
	private readonly opts: LocalServerOptions;

	constructor(opts: LocalServerOptions) {
		this.opts = opts;
	}

	get port(): number {
		return this.actualPort;
	}

	get url(): string {
		return `http://${LOOPBACK_HOST}:${this.actualPort}`;
	}

	/** Bind the server and return its URL. Falls back to a random port if the fixed one is busy. */
	async start(): Promise<string> {
		const desiredPort = this.opts.port ?? 0;
		try {
			await this.listen(desiredPort);
		} catch (err) {
			const e = err as NodeJS.ErrnoException;
			if (desiredPort !== 0 && (e.code === "EADDRINUSE" || e.code === "EACCES")) {
				if (this.opts.verbose) process.stderr.write(`[local-web] port ${desiredPort} unavailable (${e.code}); falling back to random\n`);
				await this.listen(0);
			} else {
				throw err;
			}
		}
		return this.url;
	}

	/** Gracefully close, allowing in-flight connections a bounded grace period. */
	async stop(): Promise<void> {
		if (!this.server) return;
		const srv = this.server;
		this.server = null;
		await new Promise<void>((resolve) => {
			const timer = setTimeout(() => resolve(), CLOSE_GRACE_MS);
			if (typeof timer.unref === "function") timer.unref();
			srv.close(() => {
				clearTimeout(timer);
				resolve();
			});
		});
	}

	private listen(port: number): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const server = http.createServer((req, res) => this.route(req, res));
			server.on("error", reject); // caller distinguishes EADDRINUSE/EACCES for fallback
			server.listen(port, LOOPBACK_HOST, () => {
				this.server = server;
				const addr = server.address();
				this.actualPort = typeof addr === "object" && addr ? addr.port : port;
				resolve();
			});
		});
	}

	private route(req: http.IncomingMessage, res: http.ServerResponse): void {
		if (!isHostAllowed(req.headers.host, this.actualPort)) {
			res.writeHead(403, { "Content-Type": "text/plain" });
			res.end("Forbidden");
			return;
		}
		this.opts.handler(req, res);
	}
}
