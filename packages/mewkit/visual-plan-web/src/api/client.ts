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
