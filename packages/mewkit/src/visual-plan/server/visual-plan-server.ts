/**
 * Visual Plan studio server — a domain-specific loopback server built ENTIRELY
 * from the domain-neutral `local-web` primitives (Phase 2). It owns only its
 * routes + CSP; the loopback bind, Host guard, port fallback, static traversal
 * guard, and graceful stop all come from `local-web`.
 *
 * Routes (Phase 4a, read-only):
 *   GET /api/visual-plan   → artifact JSON + ETag
 *   *                      → static bundle (dist/visual-plan-web)
 * The PATCH/feedback/export routes land in Phases 4b/5.
 */

import * as http from "node:http";
import { LocalServer } from "../../local-web/local-server.js";
import { serveStatic } from "../../local-web/static-handler.js";
import { LOOPBACK_HOST } from "../../local-web/constants.js";
import { SECURITY_HEADERS } from "./csp.js";
import { handleGetPlan, writeJson } from "./routes/get-plan.js";

export interface VisualPlanServerOptions {
	planDir: string;
	bundleDir: string;
	port?: number;
	verbose?: boolean;
}

export class VisualPlanServer {
	private readonly server: LocalServer;
	private readonly opts: VisualPlanServerOptions;

	constructor(opts: VisualPlanServerOptions) {
		this.opts = opts;
		this.server = new LocalServer({
			port: opts.port,
			verbose: opts.verbose,
			handler: (req, res) => this.route(req, res),
		});
	}

	get port(): number {
		return this.server.port;
	}
	get url(): string {
		return this.server.url;
	}

	start(): Promise<string> {
		return this.server.start();
	}
	stop(): Promise<void> {
		return this.server.stop();
	}

	private route(req: http.IncomingMessage, res: http.ServerResponse): void {
		// CSP + baseline security headers on EVERY response (setHeader persists
		// through the static handler's own writeHead, which never sets these).
		for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

		const pathname = new URL(req.url ?? "/", `http://${LOOPBACK_HOST}:${this.server.port}`).pathname;

		if (pathname === "/api/visual-plan") {
			if (req.method !== "GET" && req.method !== "HEAD") {
				writeJson(res, 405, { error: "method-not-allowed" });
				return;
			}
			handleGetPlan(res, this.opts.planDir);
			return;
		}
		serveStatic(req, res, this.opts.bundleDir);
	}
}
