/**
 * useAvailablePlans — poll /api/plans, return three-state output.
 *
 * MUST be mounted inside PlanSwitcher drawer (R2-8/M8), NOT at AgentVisualizer root.
 * This ensures idle sessions do not poll when the drawer is closed.
 *
 * Returns { status, plans, generatedAt, refetch } — same shape as useActivePlan.
 */

import { useCallback, useEffect, useState } from "react";

// Re-export PlanSummary shape locally to avoid cross-package import issues.
// Mirror of orchviz/plan/types.ts PlanSummary.
export type PlanStatus =
	| "draft"
	| "in_progress"
	| "active"
	| "completed"
	| "archived"
	| "blocked"
	| "unknown";

export interface PlanSummary {
	slug: string;
	title: string;
	status: PlanStatus;
	created: string;
	effort: string;
	mtimeMs: number;
	phaseCount: number;
}

export type AvailablePlansStatus = "loading" | "loaded" | "empty";

export interface UseAvailablePlansResult {
	status: AvailablePlansStatus;
	plans: PlanSummary[];
	generatedAt: string;
	refetch: () => void;
}

interface ApiPlansResponse {
	plans: PlanSummary[];
	generatedAt: string;
}

export function useAvailablePlans(intervalMs = 5000): UseAvailablePlansResult {
	const [state, setState] = useState<Omit<UseAvailablePlansResult, "refetch">>({
		status: "loading",
		plans: [],
		generatedAt: "",
	});
	const [refetchKey, setRefetchKey] = useState(0);
	const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

	useEffect(() => {
		let alive = true;
		let warned = false;

		const fetchOnce = async (): Promise<void> => {
			try {
				const res = await fetch("/api/plans", { cache: "no-cache" });
				if (!res.ok) return;
				const json = (await res.json()) as ApiPlansResponse;
				if (!alive) return;
				const nextStatus: AvailablePlansStatus =
					json.plans.length > 0 ? "loaded" : "empty";
				setState({ status: nextStatus, plans: json.plans, generatedAt: json.generatedAt });
			} catch (err) {
				if (!warned) {
					warned = true;
					console.warn("[orchviz] /api/plans unreachable; will keep retrying:", err);
				}
			}
		};

		void fetchOnce();
		const id = window.setInterval(() => void fetchOnce(), intervalMs);
		return () => {
			alive = false;
			window.clearInterval(id);
		};
	}, [intervalMs, refetchKey]);

	return { ...state, refetch };
}
