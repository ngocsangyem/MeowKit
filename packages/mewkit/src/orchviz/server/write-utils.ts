/**
 * write-utils — shared helpers for the POST /api/plan/todo pipeline.
 *
 * Extracted from write-handlers.ts to keep each file ≤200 LOC.
 * Exports: isOriginAllowed, bufferBody, BodyError, handleTodoPreflight.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { writeJson } from "./api-handlers.js";

// ── Origin allowlist (H5) ──────────────────────────────────────────────────
/**
 * Case-insensitive exact equality against the two allowed origins.
 * NO prefix-match, NO contains, NO regex.
 *
 * NOTE: distinct from `isHostAllowed` in server/index.ts — that guards the
 * `Host` header (which proxies may send mixed-case) using a Set; this guards
 * the `Origin` header (always lowercase per browser spec). Do NOT unify.
 */
export function isOriginAllowed(origin: string, port: number): boolean {
	const lower = origin.toLowerCase();
	const a = `http://127.0.0.1:${port}`;
	const b = `http://localhost:${port}`;
	return lower === a || lower === b;
}

// ── Body error ─────────────────────────────────────────────────────────────
export class BodyError extends Error {
	constructor(
		public readonly status: number,
		public readonly tag: string,
	) {
		super(tag);
	}
}

// ── Body buffer with socket timeout (M11) ─────────────────────────────────
/**
 * Collect the full request body up to capBytes.
 * Destroys the socket if body exceeds cap OR if timeoutMs elapses first.
 * Throws BodyError(413) on overflow, BodyError(408) on timeout.
 */
export function bufferBody(
	req: IncomingMessage,
	capBytes: number,
	timeoutMs: number,
): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		let settled = false;

		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			req.socket?.destroy();
			reject(new BodyError(408, "request-timeout"));
		}, timeoutMs);

		req.on("data", (chunk: Buffer) => {
			total += chunk.length;
			if (total > capBytes) {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				req.socket?.destroy();
				reject(new BodyError(413, "body-too-large"));
				return;
			}
			chunks.push(chunk);
		});

		req.on("end", () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(Buffer.concat(chunks));
		});

		req.on("error", (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(err);
		});
	});
}

// ── OPTIONS preflight (H4) ─────────────────────────────────────────────────
/**
 * Handle OPTIONS /api/plan/todo preflight.
 * H4: allowlist check FIRST — only emit ACAO after passing.
 * Disallowed origin → 403 with NO ACAO header.
 */
export function handleTodoPreflight(
	req: IncomingMessage,
	res: ServerResponse,
	port: number,
): void {
	const origin = req.headers["origin"] ?? "";
	if (!isOriginAllowed(origin, port)) {
		res.writeHead(403, { "Content-Type": "text/plain" });
		res.end("Forbidden");
		return;
	}
	res.writeHead(204, {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "POST",
		"Access-Control-Allow-Headers": "content-type",
	});
	res.end();
}

// ── realpath helper — fail-closed (R2-6) ──────────────────────────────────
/**
 * Wraps realpathSync in try/catch. ANY exception → returns null.
 * Caller must treat null as 403 (fail-closed per R2-6).
 */
export function safeRealpath(p: string): string | null {
	try {
		return fs.realpathSync(p);
	} catch {
		return null;
	}
}

export { writeJson };

// ── Boundary check helpers ─────────────────────────────────────────────────

/**
 * Module-level cache: plansDir paths are constant per project, so realpath
 * resolves only once per process per project root. Cleared by tests via
 * resetPlansDirCache() if needed.
 */
const plansDirRealpathCache = new Map<string, string>();

export function resetPlansDirCache(): void {
	plansDirRealpathCache.clear();
}

/**
 * Resolve planDir realpath and verify it sits inside plansDir.
 * Returns { resolvedPlanDir, resolvedPlansDir } on success,
 * or null when any realpath fails or boundary is violated (R2-6, R2-15).
 *
 * `plansDir` realpath is cached per process — that path is constant per
 * project root and resolving it on every POST is wasted syscalls.
 */
export function resolvePlanDirBoundary(
	plansDir: string,
	planDir: string,
): { resolvedPlanDir: string; resolvedPlansDir: string } | null {
	let resolvedPlansDir = plansDirRealpathCache.get(plansDir) ?? null;
	if (!resolvedPlansDir) {
		resolvedPlansDir = safeRealpath(plansDir);
		if (!resolvedPlansDir) return null;
		plansDirRealpathCache.set(plansDir, resolvedPlansDir);
	}
	const resolvedPlanDir = safeRealpath(planDir);
	if (!resolvedPlanDir) return null;
	if (!(resolvedPlanDir + path.sep).startsWith(resolvedPlansDir + path.sep)) return null;
	return { resolvedPlanDir, resolvedPlansDir };
}

/**
 * Verify a globbed phase file sits inside resolvedPlanDir (M15, R2-15).
 * Returns the resolved absolute path, or null on failure.
 */
export function resolvePhaseFileBoundary(
	phaseFilePath: string,
	resolvedPlanDir: string,
): string | null {
	const resolved = safeRealpath(phaseFilePath);
	if (!resolved) return null;
	if (!resolved.startsWith(resolvedPlanDir + path.sep)) return null;
	return resolved;
}
