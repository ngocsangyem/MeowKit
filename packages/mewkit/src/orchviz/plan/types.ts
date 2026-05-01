/**
 * Plan parser types — describes the shape of an active plan + its phases for
 * the /api/plan endpoint. Pure data; no logic.
 */

export type PhaseStatus =
	| "pending"
	| "active"
	| "in_progress"
	| "completed"
	| "failed"
	| "abandoned"
	| "unknown";

/**
 * Plan-level status vocabulary (red-team H3).
 * Used by listPlans and PlanSummary. "unknown" is the fallback for unrecognized strings.
 */
export type PlanStatus =
	| "draft"
	| "in_progress"
	| "active"
	| "completed"
	| "archived"
	| "blocked"
	| "unknown";

/**
 * Lightweight summary of a plan — returned by GET /api/plans.
 * Full plan state (with phases + todos) is returned by GET /api/plan?slug=<slug>.
 */
export interface PlanSummary {
	slug: string;
	title: string;
	status: PlanStatus;
	created: string;
	effort: string;
	mtimeMs: number;
	phaseCount: number;
}

export interface TodoItem {
	checked: boolean;
	text: string;
}

export interface PhaseState {
	number: number;
	title: string;
	status: PhaseStatus;
	effort: string;
	todos: TodoItem[];
	filePath: string;
	abandoned: boolean;
}

export interface PlanState {
	slug: string;
	title: string;
	status: string;
	effort: string;
	created: string;
	phases: PhaseState[];
	path: string;
}
