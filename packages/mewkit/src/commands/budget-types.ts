export interface LegacyCostEntry {
	date: string;
	command?: string;
	tier?: string;
	estimated_tokens?: number | string;
	task?: string;
	task_summary?: string;
}

export interface SessionCostEntry {
	date: string;
	session_id?: string;
	model?: string;
	cost_usd?: number | string;
	tokens_in?: number | string;
	tokens_out?: number | string;
	cache_write_tokens?: number | string;
	cache_read_tokens?: number | string;
	estimated_tokens?: number | string;
}

export type CostEntry = LegacyCostEntry | SessionCostEntry;

export interface BudgetRow {
	date: string;
	command: string;
	tier: string;
	tokens: number;
	task: string;
}

export interface BudgetArgs {
	monthly?: boolean;
	session?: boolean | string;
	day?: boolean | string;
}

export interface LiveBudgetState {
	estimated_input_tokens?: number | string;
	estimated_output_tokens?: number | string;
	estimated_cost_usd?: number | string;
	turn_count?: number | string;
}

export interface LiveBudgetSummary {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	humanReads: number;
	estimatedCost: number;
}
