/**
 * useTodoWriter — optimistic todo checkbox toggle with POST /api/plan/todo.
 *
 * React 19 useOptimistic drives instant UI flip; server response confirms.
 * 409 (stale etag) auto-reverts via useOptimistic + fires refetch() + toast.
 * 4xx/5xx errors: rollback (auto via useOptimistic) + toast + refetch.
 * readonly:true short-circuits before fetch or optimistic dispatch.
 *
 * (R2-5) phaseEtags is the FULL Record<number,string> map. The etag for each
 * POST is read at click time: phaseEtags[phase] ?? "".
 */

import { useCallback, useOptimistic } from "react";
import { useToast } from "@/components/toast";
import type { PlanPhase } from "./use-active-plan";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TodoToggleArgs {
	phase: number;
	todoIdx: number;
	checked: boolean;
}

interface OptimisticAction {
	type: "toggle";
	phase: number;
	todoIdx: number;
	checked: boolean;
}

interface ApiTodoResponse {
	ok?: boolean;
	changed?: boolean;
	etag?: string;
	error?: string;
	currentEtag?: string;
}

// ── Reducer ──────────────────────────────────────────────────────────────────

/** Exported for unit testing — pure function, no hooks. */
export function phaseListReducer(phases: PlanPhase[], action: OptimisticAction): PlanPhase[] {
	return phases.map((phase) => {
		if (phase.number !== action.phase) return phase;
		return {
			...phase,
			todos: phase.todos.map((todo, idx) =>
				idx === action.todoIdx ? { ...todo, checked: action.checked } : todo,
			),
		};
	});
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTodoWriter(
	slug: string,
	phases: PlanPhase[],
	phaseEtags: Record<number, string> | null,
	refetch: () => void,
	readonly: boolean,
): {
	optimisticPhases: PlanPhase[];
	toggle: (args: TodoToggleArgs) => Promise<void>;
} {
	const { show: showToast } = useToast();

	const [optimisticPhases, addOptimistic] = useOptimistic(phases, phaseListReducer);

	const toggle = useCallback(async ({ phase, todoIdx, checked }: TodoToggleArgs): Promise<void> => {
		if (readonly) {
			showToast("Server is read-only");
			return;
		}

		// Read etag at click time (R2-5) — slug is also captured per-render
		// so plan-switch propagates correctly via React's re-call of this hook.
		const etag = phaseEtags?.[phase] ?? "";

		// Optimistic flip — useOptimistic auto-reverts if we don't call addOptimistic again
		addOptimistic({ type: "toggle", phase, todoIdx, checked });

		let res: Response;
		try {
			res = await fetch("/api/plan/todo", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug, phase, todoIdx, checked, etag }),
			});
		} catch (err) {
			console.warn("[orchviz:todo-writer] fetch error:", err);
			showToast("Network failure — todo not saved");
			refetch();
			return;
		}

		if (res.status === 200) {
			const json = (await res.json()) as ApiTodoResponse;
			if (json.changed === false) return;
			// changed:true — wait for next 2s poll; don't double-request (validation Q2)
			return;
		}

		if (res.status === 409) {
			refetch();
			showToast("Plan changed externally — reloaded");
			return;
		}

		// 400 / 403 / 405 / 413 / 415 / 500+
		showToast(`Failed to update todo (status ${res.status})`);
		refetch();
	}, [slug, phaseEtags, readonly, addOptimistic, refetch, showToast]);

	return { optimisticPhases, toggle };
}
