/**
 * useActivePlan — poll /api/plan (optionally slug-targeted), return three-state output.
 *
 * `loading` until first fetch resolves.
 * `loaded`  once a plan is found.
 * `empty`   when /api/plan returns null OR when a slug-targeted fetch returns 404.
 *
 * Subsequent polls never revert from `loaded` to `loading` — the table stays
 * rendered while polls happen in the background.
 *
 * Signature: useActivePlan(slug?, intervalMs?)
 *   - slug absent → fetch /api/plan (most-recent); default poll 5s
 *   - slug present → fetch /api/plan?slug=<slug>; default poll 2s (R2-9)
 *
 * Exposes:
 *   etag        — per-plan ETag string for optimistic write guards (Phase 4)
 *   phaseEtags  — map of { [phaseNumber]: hexEtag } (Phase 4 fine-grained guard)
 *   readonly    — server-side readonly flag (default true; opt out via MEOWKIT_ORCHVIZ_WRITABLE=1)
 *   refetch()   — imperative bust: increment an internal key to force re-mount the effect
 */

import { useCallback, useEffect, useState } from "react";

export interface PlanTodo {
	checked: boolean;
	text: string;
}

export interface PlanPhase {
	number: number;
	title: string;
	status: "pending" | "active" | "in_progress" | "completed" | "failed" | "abandoned" | "unknown";
	effort: string;
	todos: PlanTodo[];
	filePath: string;
	abandoned: boolean;
}

export interface PlanData {
	slug: string;
	title: string;
	status: string;
	effort: string;
	created: string;
	phases: PlanPhase[];
	path: string;
}

export type PlanStatus = "loading" | "loaded" | "empty";

export interface UseActivePlanResult {
	status: PlanStatus;
	plan: PlanData | null;
	generatedAt: string;
	/** Per-plan ETag (sha256 hex) — null until first load */
	etag: string | null;
	/** Per-phase ETag map — null until first load */
	phaseEtags: Record<number, string> | null;
	/** Server readonly flag — false until first load */
	readonly: boolean;
	/** Force an immediate refetch by busting the polling effect key */
	refetch: () => void;
}

interface ApiPlanResponse {
	plan: PlanData | null;
	generatedAt: string;
	etag?: string;
	phaseEtags?: Record<number, string>;
	readonly?: boolean;
}

export function useActivePlan(slug?: string, intervalMs?: number): UseActivePlanResult {
	// Default poll rate: 2s when slug-targeted, 5s for most-recent (R2-9)
	const effectiveInterval = intervalMs ?? (slug ? 2000 : 5000);

	const [state, setState] = useState<UseActivePlanResult>({
		status: "loading",
		plan: null,
		generatedAt: "",
		etag: null,
		phaseEtags: null,
		readonly: false,
		refetch: () => {
			/* placeholder replaced below */
		},
	});

	// Refetch key — incrementing busts the polling effect
	const [refetchKey, setRefetchKey] = useState(0);
	const refetch = useCallback(() => {
		setRefetchKey((k) => k + 1);
	}, []);

	useEffect(() => {
		let alive = true;
		let warned = false;

		const url = slug
			? `/api/plan?slug=${encodeURIComponent(slug)}`
			: "/api/plan";

		const fetchOnce = async (): Promise<void> => {
			try {
				const res = await fetch(url, { cache: "no-cache" });

				if (!alive) return;

				// 404 with a slug → "empty" (stale slug handling, R2-4)
				if (res.status === 404 && slug) {
					setState((prev) => ({
						...prev,
						status: "empty",
						plan: null,
						refetch,
					}));
					return;
				}

				if (!res.ok) return;

				const json = (await res.json()) as ApiPlanResponse;
				if (!alive) return;

				setState((prev) => {
					// Skip setState when server returned identical content (mtime-keyed cache hit).
					// generatedAt is the cheapest signal — server refreshes it on every call,
					// but plan content + etag stay byte-identical when nothing on disk changed.
					const sameContent =
						prev.etag === (json.etag ?? null) &&
						prev.plan?.path === json.plan?.path &&
						prev.readonly === (json.readonly ?? false);
					if (sameContent && prev.plan && json.plan) return prev;

					const nextStatus: PlanStatus = json.plan
						? "loaded"
						: prev.status === "loaded"
							? "loaded"
							: "empty";
					return {
						status: nextStatus,
						plan: json.plan,
						generatedAt: json.generatedAt,
						etag: json.etag ?? null,
						phaseEtags: json.phaseEtags ?? null,
						readonly: json.readonly ?? false,
						refetch,
					};
				});
			} catch (err) {
				if (!warned) {
					warned = true;
					console.warn("[orchviz] /api/plan unreachable; will keep retrying:", err);
				}
			}
		};

		void fetchOnce();
		const id = window.setInterval(() => void fetchOnce(), effectiveInterval);
		return () => {
			alive = false;
			window.clearInterval(id);
		};
	}, [slug, effectiveInterval, refetchKey]);

	return { ...state, refetch };
}
