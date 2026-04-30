/**
 * useActivePlan — poll /api/plan, return three-state output (red-team H8).
 *
 * `loading` until first fetch resolves.
 * `loaded` once a plan is found.
 * `empty` when /api/plan returns null.
 *
 * Subsequent polls never revert from `loaded` to `loading` — the table stays
 * rendered while polls happen in the background.
 */

import { useEffect, useState } from "react";

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
}

export function useActivePlan(intervalMs = 5000): UseActivePlanResult {
	const [state, setState] = useState<UseActivePlanResult>({
		status: "loading",
		plan: null,
		generatedAt: "",
	});

	useEffect(() => {
		let alive = true;
		let warned = false;

		const fetchOnce = async (): Promise<void> => {
			try {
				const res = await fetch("/api/plan", { cache: "no-cache" });
				if (!res.ok) return;
				const json = (await res.json()) as { plan: PlanData | null; generatedAt: string };
				if (!alive) return;
				setState((prev) => {
					const nextStatus: PlanStatus = json.plan ? "loaded" : prev.status === "loaded" ? "loaded" : "empty";
					return { status: nextStatus, plan: json.plan, generatedAt: json.generatedAt };
				});
			} catch (err) {
				if (!warned) {
					warned = true;
					console.warn("[orchviz] /api/plan unreachable; will keep retrying:", err);
				}
			}
		};

		void fetchOnce();
		const id = window.setInterval(() => void fetchOnce(), intervalMs);
		return () => {
			alive = false;
			window.clearInterval(id);
		};
	}, [intervalMs]);

	return state;
}
