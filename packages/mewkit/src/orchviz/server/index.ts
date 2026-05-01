/**
 * OrchvizServer — node:http server bound 127.0.0.1 with SSE relay + static UI.
 *
 * Architecture ported from patoles/agent-flow @ 59ccf4e (app/src/server.ts +
 * scripts/relay.ts SSE block). License Apache-2.0 (see ../../NOTICE).
 */

import * as http from "node:http";
import { EventEmitter } from "node:events";
import type { AgentEvent } from "../protocol.js";
import { BIND_HOST, SSE_DRAIN_GRACE_MS } from "../constants.js";
import { sanitizeEvent } from "../sanitize.js";
import { SseRelay } from "./sse-handler.js";
import { serveStatic } from "./static-handler.js";
import {
	handleOverlays,
	handlePlan,
	handlePlans,
	writeJson,
	PLACEHOLDER_OVERLAYS,
	PLACEHOLDER_PLAN,
	type OverlayProvider,
	type PlanProvider,
} from "./api-handlers.js";
import {
	handleTodoWrite,
	handleTodoPreflight,
	type WriteHandlerContext,
} from "./write-handlers.js";
import type { PlanCollector } from "../plan/collector.js";

export interface OrchvizServerOptions {
	port?: number;
	staticDir: string;
	eventSource: EventEmitter;
	overlayProvider?: OverlayProvider;
	planProvider?: PlanProvider;
	/** Required for /api/plans endpoint. Falls back to no-op if absent. */
	projectRoot?: string;
	/** Required for POST /api/plan/todo cache invalidation (red-team M4 / R2-4). */
	planCollector?: PlanCollector;
	verbose?: boolean;
}

export class OrchvizServer {
	private server: http.Server | null = null;
	private readonly relay = new SseRelay();
	private actualPort = 0;
	private readonly opts: OrchvizServerOptions;
	private readonly forwardEvent: (e: AgentEvent) => void;

	constructor(opts: OrchvizServerOptions) {
		this.opts = opts;
		this.forwardEvent = (e: AgentEvent): void => {
			this.relay.publish(sanitizeEvent(e));
		};
	}

	get port(): number {
		return this.actualPort;
	}

	get url(): string {
		return `http://${BIND_HOST}:${this.actualPort}`;
	}

	async start(onListening?: (url: string) => void): Promise<string> {
		this.relay.start();
		this.opts.eventSource.on("event", this.forwardEvent);
		const desiredPort = this.opts.port ?? 0;

		const tryListen = (port: number): Promise<void> =>
			new Promise<void>((resolve, reject) => {
				const server = http.createServer((req, res) => this.routeRequest(req, res));
				// All errors reject — caller distinguishes EADDRINUSE / EACCES for fallback.
				server.on("error", reject);
				server.listen(port, BIND_HOST, () => {
					this.server = server;
					const addr = server.address();
					this.actualPort = typeof addr === "object" && addr ? addr.port : port;
					resolve();
				});
			});

		try {
			await tryListen(desiredPort);
		} catch (err) {
			const e = err as NodeJS.ErrnoException;
			if (desiredPort !== 0 && (e.code === "EADDRINUSE" || e.code === "EACCES")) {
				if (this.opts.verbose) {
					process.stderr.write(`[orchviz] port ${desiredPort} unavailable (${e.code}); falling back to random\n`);
				}
				await tryListen(0);
			} else {
				throw err;
			}
		}
		const url = this.url;
		if (onListening) onListening(url);
		return url;
	}

	async stop(): Promise<void> {
		this.opts.eventSource.off("event", this.forwardEvent);
		this.relay.stop();
		if (!this.server) return;
		const srv = this.server;
		this.server = null;
		await new Promise<void>((resolve) => {
			const timer = setTimeout(() => resolve(), SSE_DRAIN_GRACE_MS);
			if (typeof timer.unref === "function") timer.unref();
			srv.close(() => {
				clearTimeout(timer);
				resolve();
			});
		});
	}

	private routeRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
		// Host header guard — defense vs DNS rebinding (red-team RT2 #1).
		if (!this.isHostAllowed(req)) {
			res.writeHead(403, { "Content-Type": "text/plain" });
			res.end("Forbidden");
			return;
		}
		const url = new URL(req.url ?? "/", `http://${BIND_HOST}:${this.actualPort}`);
		const pathname = url.pathname;

		// Route /api/plan/todo BEFORE the GET/HEAD method gate (spec step 14).
		if (pathname === "/api/plan/todo") {
			const writeCtx: WriteHandlerContext = {
				projectRoot: this.opts.projectRoot ?? "",
				port: this.actualPort,
				planCollector: this.opts.planCollector,
			};
			if (req.method === "OPTIONS") {
				handleTodoPreflight(req, res, this.actualPort);
				return;
			}
			void handleTodoWrite(req, res, writeCtx);
			return;
		}

		if (req.method !== "GET" && req.method !== "HEAD") {
			res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain" });
			res.end("Method Not Allowed");
			return;
		}
		if (pathname === "/events") {
			this.relay.handle(req, res);
			return;
		}
		if (pathname === "/api/overlays") {
			handleOverlays(res, this.opts.overlayProvider ?? PLACEHOLDER_OVERLAYS);
			return;
		}
		if (pathname === "/api/plans") {
			if (this.opts.projectRoot) {
				handlePlans(res, this.opts.projectRoot);
			} else {
				writeJson(res, 200, { plans: [], generatedAt: new Date().toISOString() });
			}
			return;
		}
		if (pathname === "/api/plan") {
			handlePlan(res, this.opts.planProvider ?? PLACEHOLDER_PLAN, url.searchParams);
			return;
		}
		serveStatic(req, res, this.opts.staticDir);
	}

	private isHostAllowed(req: http.IncomingMessage): boolean {
		const host = req.headers.host;
		if (!host) return false;
		const expected = new Set([
			`${BIND_HOST}:${this.actualPort}`,
			`localhost:${this.actualPort}`,
		]);
		// Allow stable port match too in case actualPort still 0 during fallback.
		return expected.has(host) || host === BIND_HOST || host === "localhost";
	}
}
