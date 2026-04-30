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
