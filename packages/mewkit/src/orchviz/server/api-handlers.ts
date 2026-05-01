/**
 * /api/overlays + /api/plan + /api/plans — JSON endpoints backed by collectors.
 */

import type { ServerResponse } from "node:http";
import { OverlayCollector } from "../overlay/collector.js";
import { PlanCollector, type PlanSnapshot, type PlanSnapshotError } from "../plan/collector.js";
import { listPlans } from "../plan/list-plans.js";

const PLAN_ERROR_HTTP: Record<PlanSnapshotError, number> = {
	"invalid-slug": 400,
	"forbidden-path": 403,
	"not-found": 404,
};

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

/**
 * PlanProvider now accepts an optional slug string.
 * PlanCollector.snapshot(slug?) maps to this signature.
 */
export type PlanProvider = (slug?: string) => PlanSnapshot;

/**
 * Handle GET /api/plan — optionally targeted by ?slug=<slug> query param.
 *
 * Error mapping (R2-8):
 *   snapshot.error === "invalid-slug"   → 400
 *   snapshot.error === "forbidden-path" → 403
 *   snapshot.error === "not-found"      → 404
 *   no error                            → 200
 */
export function handlePlan(
	res: ServerResponse,
	provider: PlanProvider,
	query: URLSearchParams,
): void {
	try {
		const slug = query.get("slug") ?? undefined;
		const snapshot = provider(slug);
		if (snapshot.error) {
			writeJson(res, PLAN_ERROR_HTTP[snapshot.error], { error: snapshot.error });
			return;
		}
		const safe = stripHtmlDeep(snapshot);
		writeJson(res, 200, safe);
	} catch {
		writeJson(res, 500, { error: "plan-read-failed" });
	}
}

export const PLACEHOLDER_PLAN: PlanProvider = () => ({
	plan: null,
	phaseEtags: null,
	readonly: false,
	generatedAt: new Date().toISOString(),
});

export function makePlanProvider(projectRoot: string): PlanProvider {
	const collector = new PlanCollector(projectRoot);
	return (slug?: string) => collector.snapshot(slug);
}

/**
 * Create a standalone PlanCollector instance for injection into the write handler.
 * The write handler calls collector.invalidate() after every successful write,
 * invalidating the cache so the next GET returns fresh data (R2-4).
 */
export function makePlanCollector(projectRoot: string): PlanCollector {
	return new PlanCollector(projectRoot);
}

/**
 * Handle GET /api/plans — returns all non-archived plan summaries sorted mtime desc.
 * HTML-tag scrub applied to all string fields (red-team H2).
 */
export function handlePlans(res: ServerResponse, projectRoot: string): void {
	try {
		const plans = listPlans(projectRoot);
		const safe = stripHtmlDeep(plans);
		writeJson(res, 200, { plans: safe, generatedAt: new Date().toISOString() });
	} catch {
		writeJson(res, 500, { error: "plans-read-failed" });
	}
}
