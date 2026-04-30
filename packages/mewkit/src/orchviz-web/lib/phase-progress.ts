import type { PlanPhase } from "@/hooks/use-active-plan";

export interface PhaseProgress {
	done: number;
	total: number;
	percent: number;
}

export function phaseProgress(phase: PlanPhase): PhaseProgress {
	const total = phase.todos.length;
	const done = phase.todos.filter((t) => t.checked).length;
	const percent = total === 0 ? 0 : Math.round((done / total) * 100);
	return { done, total, percent };
}
