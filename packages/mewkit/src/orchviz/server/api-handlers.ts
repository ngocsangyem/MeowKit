/**
 * /api/overlays + /api/plan — JSON endpoints backed by collectors.
 */

import type { ServerResponse } from "node:http";
import { OverlayCollector } from "../overlay/collector.js";
import { PlanCollector, type PlanSnapshot } from "../plan/collector.js";

const HTML_TAG_RE = /<[^>]*>/g;

/** Recursively strip HTML tags from string fields. Defense-in-depth (red-team H2). */
function stripHtmlDeep<T>(value: T): T {
	if (typeof value === "string") return value.replace(HTML_TAG_RE, "") as unknown as T;
	if (Array.isArray(value)) return value.map(stripHtmlDeep) as unknown as T;
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = stripHtmlDeep(v);
		}
		return out as unknown as T;
	}
	return value;
}

export interface OverlayState {
	gate1?: { name: string; approved: boolean } | null;
	gate2?: { name: string; verdict: string } | null;
	model?: string | null;
	cost?: { tokens: number; usd: number } | null;
	phase?: string | null;
}

export type OverlayProvider = () => OverlayState;

export function writeJson(res: ServerResponse, status: number, body: unknown): void {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": String(Buffer.byteLength(payload)),
		"Cache-Control": "no-cache",
	});
	res.end(payload);
}

export function handleOverlays(res: ServerResponse, provider: OverlayProvider): void {
	try {
		writeJson(res, 200, provider());
	} catch {
		writeJson(res, 500, { error: "overlay-read-failed" });
	}
}

export const PLACEHOLDER_OVERLAYS: OverlayProvider = () => ({
	gate1: null,
	gate2: null,
	model: null,
	cost: null,
	phase: null,
});

export function makeOverlayProvider(projectRoot: string): OverlayProvider {
	const collector = new OverlayCollector(projectRoot);
	return () => collector.snapshot();
}

export type PlanProvider = () => PlanSnapshot;

export function handlePlan(res: ServerResponse, provider: PlanProvider): void {
	try {
		const snapshot = provider();
		// Strip HTML tags at boundary (red-team H2). React auto-escapes downstream
		// but defense-in-depth is consistent with sanitizeEvent at SSE boundary.
		const safe = stripHtmlDeep(snapshot);
		writeJson(res, 200, safe);
	} catch {
		writeJson(res, 500, { error: "plan-read-failed" });
	}
}

export const PLACEHOLDER_PLAN: PlanProvider = () => ({
	plan: null,
	generatedAt: new Date().toISOString(),
});

export function makePlanProvider(projectRoot: string): PlanProvider {
	const collector = new PlanCollector(projectRoot);
	return () => collector.snapshot();
}
