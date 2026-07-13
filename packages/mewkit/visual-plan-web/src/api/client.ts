/**
 * Studio API client — fetches the artifact from the loopback server.
 * Read-only in Phase 4a; the ETag is captured now so the Phase-5 PATCH path can
 * send it as `If-Match` without changing the fetch shape.
 */

import type { VisualPlan } from "../domain/artifact-types.js";

export interface LoadedPlan {
	plan: VisualPlan;
	etag: string | null;
}

/** GET /api/visual-plan → parsed artifact + ETag. Throws on non-200. */
export async function fetchPlan(): Promise<LoadedPlan> {
	const res = await fetch("/api/visual-plan", { headers: { Accept: "application/json" } });
	if (!res.ok) throw new Error(`visual-plan fetch failed: ${res.status}`);
	const plan = (await res.json()) as VisualPlan;
	return { plan, etag: res.headers.get("ETag") };
}

export interface PatchResponse {
	ok: boolean;
	etag?: string;
	stale?: boolean;
	currentEtag?: string;
	revision?: number;
}

/** PATCH one typed op under optimistic concurrency (If-Match ETag). 409 ⇒ stale. */
export async function patchPlan(op: unknown, etag: string): Promise<PatchResponse> {
	const res = await fetch("/api/visual-plan", {
		method: "PATCH",
		headers: { "Content-Type": "application/json", "If-Match": etag },
		body: JSON.stringify(op),
	});
	if (res.status === 409) {
		const body = (await res.json()) as { currentEtag?: string };
		return { ok: false, stale: true, currentEtag: body.currentEtag };
	}
	if (!res.ok) return { ok: false };
	const body = (await res.json()) as { etag?: string; revision?: number };
	return { ok: true, etag: body.etag ?? res.headers.get("ETag") ?? undefined, revision: body.revision };
}

export interface FeedbackResponse {
	ok: boolean;
	id?: string;
	copyCommand?: string;
	error?: string;
}

/** POST accumulated semantic operations → immutable batch id + Copy Command. */
export async function postFeedback(operations: unknown[]): Promise<FeedbackResponse> {
	const res = await fetch("/api/visual-plan/feedback", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ operations }),
	});
	const body = (await res.json()) as { id?: string; copyCommand?: string; message?: string };
	if (res.status !== 201) return { ok: false, error: body.message ?? `feedback failed: ${res.status}` };
	return { ok: true, id: body.id, copyCommand: body.copyCommand };
}
