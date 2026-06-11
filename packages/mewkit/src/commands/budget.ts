import path from "node:path";
import pc from "picocolors";
import { computeContextBudget } from "../core/context-budget.js";
import { availableProfiles, hasPackManifest, loadPackManifest } from "../core/index.js";
import {
	findCostLog,
	findProjectRootFromCostLog,
	readCostLog,
	readLiveBudgetState,
	resolveCurrentSessionId,
} from "./budget-cost-log.js";
import { aggregateByMonth, printLiveSessionSummary, printTable } from "./budget-display.js";
import type {
	BudgetArgs,
	BudgetRow,
	CostEntry,
	LegacyCostEntry,
	LiveBudgetState,
	LiveBudgetSummary,
	SessionCostEntry,
} from "./budget-types.js";

function normalizeFlagValue(value: boolean | string | undefined): string | null {
	if (value === undefined || value === false) {
		return null;
	}
	if (value === true) {
		return "";
	}
	return value.trim();
}

function resolveDayFilter(value: boolean | string | undefined): string | null {
	if (value === undefined || value === false) {
		return null;
	}
	if (value === true || value === "") {
		return new Date().toISOString().slice(0, 10);
	}
	const day = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
		throw new Error(`Invalid --day value: ${day} (expected YYYY-MM-DD)`);
	}
	return day;
}

function coerceNumber(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.length === 0) {
			return 0;
		}
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

export function toBudgetRow(entry: CostEntry): BudgetRow {
	const legacy = entry as LegacyCostEntry;
	const session = entry as SessionCostEntry;
	const legacyTokens = coerceNumber(entry.estimated_tokens);
	const computedTokens =
		coerceNumber(session.tokens_in) +
		coerceNumber(session.tokens_out) +
		coerceNumber(session.cache_write_tokens) +
		coerceNumber(session.cache_read_tokens);
	const tokens = legacyTokens > 0 ? legacyTokens : computedTokens;
	const command =
		(typeof legacy.command === "string" && legacy.command.trim().length > 0 && legacy.command.trim()) || "session";
	const tier =
		(typeof legacy.tier === "string" && legacy.tier.trim().length > 0 && legacy.tier.trim()) ||
		(typeof session.model === "string" && session.model.trim().length > 0 && session.model.trim()) ||
		"unknown";
	const task =
		(typeof legacy.task === "string" && legacy.task.trim().length > 0 && legacy.task.trim()) ||
		(typeof legacy.task_summary === "string" &&
			legacy.task_summary.trim().length > 0 &&
			legacy.task_summary.trim()) ||
		(typeof session.session_id === "string" && session.session_id.trim().length > 0 && `session ${session.session_id.trim()}`) ||
		"session snapshot";

	return {
		date: entry.date,
		command,
		tier,
		tokens,
		task,
	};
}

function getEntrySessionId(entry: CostEntry): string {
	const sessionId = (entry as SessionCostEntry).session_id;
	return typeof sessionId === "string" ? sessionId.trim() : "";
}

function getEntryDay(entry: CostEntry): string {
	return entry.date.slice(0, 10);
}

export function filterBudgetEntries(
	entries: CostEntry[],
	filters: { sessionId?: string | null; day?: string | null },
): CostEntry[] {
	return entries.filter((entry) => {
		if (filters.sessionId && getEntrySessionId(entry) !== filters.sessionId) {
			return false;
		}
		if (filters.day && getEntryDay(entry) !== filters.day) {
			return false;
		}
		return true;
	});
}

export function summarizeLiveBudgetState(budgetState: LiveBudgetState): LiveBudgetSummary {
	const inputTokens = coerceNumber(budgetState.estimated_input_tokens);
	const outputTokens = coerceNumber(budgetState.estimated_output_tokens);
	return {
		inputTokens,
		outputTokens,
		totalTokens: inputTokens + outputTokens,
		humanReads: coerceNumber(budgetState.turn_count),
		estimatedCost: coerceNumber(budgetState.estimated_cost_usd),
	};
}

export interface ContextBudgetArgs {
	/** Profile to estimate; omitted = all profiles. */
	profile?: string;
	/** Exit non-zero when any profile exceeds this token estimate. */
	failOver?: number;
	json?: boolean;
}

function padCell(s: string, n: number): string {
	return s.length >= n ? s : s + " ".repeat(n - s.length);
}

/**
 * `mewkit budget context [--profile <p>] [--fail-over <N>] [--json]` — estimate the
 * loadable context size of one or all profiles. The CI guardrail proves core stays
 * small; `--fail-over` makes an oversized profile a non-zero exit.
 */
export function contextBudget(args: ContextBudgetArgs): void {
	const claudeDir = path.join(process.cwd(), ".claude");
	if (!hasPackManifest(claudeDir)) {
		console.error(pc.red("Context budget requires .claude/pack-manifest.json — run `mewkit upgrade` first."));
		process.exit(1);
	}
	const manifest = loadPackManifest(claudeDir);
	const all = availableProfiles(manifest);
	if (args.profile && !all.includes(args.profile)) {
		console.error(pc.red(`Unknown profile "${args.profile}". Available: ${all.join(", ")}`));
		process.exit(1);
	}
	const profiles = args.profile ? [args.profile] : all;
	const reports = profiles.map((p) => computeContextBudget(claudeDir, p));

	if (args.json) {
		console.log(JSON.stringify(reports, null, 2));
	} else {
		console.log(pc.bold(pc.cyan("Context budget")));
		console.log(
			pc.dim(
				"Tiers: always-on (CLAUDE.md + rules) · conditional (rules-conditional) · on-demand (agents + commands + SKILL.md).",
			),
		);
		console.log();
		for (const r of reports) {
			console.log(pc.bold(`  ${r.profile}`));
			console.log(`    ${padCell("TIER", 12)} ${padCell("FILES", 7)} ${padCell("LINES", 9)} ~TOKENS`);
			const tierOrder = ["always-on", "conditional", "on-demand"] as const;
			for (const tier of tierOrder) {
				const t = r.tiers[tier];
				console.log(
					`    ${padCell(tier, 12)} ${padCell(String(t.files), 7)} ${padCell(String(t.lines), 9)} ${t.tokens.toLocaleString()}`,
				);
			}
			console.log(
				`    ${padCell("total", 12)} ${padCell(String(r.files), 7)} ${padCell(String(r.lines), 9)} ${r.tokens.toLocaleString()}`,
			);
			console.log();
		}
	}

	if (args.failOver !== undefined) {
		const over = reports.filter((r) => r.tokens > args.failOver!);
		if (over.length > 0) {
			console.log();
			console.log(pc.red(`Over --fail-over ${args.failOver}: ${over.map((r) => `${r.profile}=${r.tokens}`).join(", ")}`));
			process.exit(1);
		}
	}
}

export async function budget(args: BudgetArgs): Promise<void> {
	console.log(pc.bold(pc.cyan("Token Budget & Cost Log")));
	console.log();

	const logPath = findCostLog();
	const projectRoot = logPath ? findProjectRootFromCostLog(logPath) : process.cwd();
	const currentSessionId = resolveCurrentSessionId(projectRoot);
	const sessionFlag = normalizeFlagValue(args.session);
	const sessionId = sessionFlag === null ? null : sessionFlag.length > 0 ? sessionFlag : currentSessionId;
	let dayFilter: string | null;
	try {
		dayFilter = resolveDayFilter(args.day);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(pc.red(message));
		process.exit(1);
	}

	const isCurrentSession = Boolean(sessionId && currentSessionId && sessionId === currentSessionId);
	const liveBudgetState = isCurrentSession ? readLiveBudgetState(projectRoot) : null;
	const today = new Date().toISOString().slice(0, 10);
	const liveStateMatchesDay = !dayFilter || dayFilter === today;

	if (sessionFlag !== null && !sessionId) {
		console.error(pc.red("Could not determine the current session id."));
		console.log(pc.dim("Expected HOOK_SESSION_ID or session-state/last-session-id."));
		process.exit(1);
	}

	if (liveBudgetState && liveStateMatchesDay) {
		if (logPath) {
			console.log(`${pc.dim("Source:")} ${logPath}`);
			console.log(`${pc.dim("Live state:")} ${path.join(projectRoot, "session-state", "budget-state.json")}`);
		} else {
			console.log(`${pc.dim("Live state:")} ${path.join(projectRoot, "session-state", "budget-state.json")}`);
		}
		console.log();
		if (dayFilter) {
			console.log(`${pc.dim("Day:")} ${dayFilter}`);
			console.log();
		}
		printLiveSessionSummary(sessionId!, summarizeLiveBudgetState(liveBudgetState));
		return;
	}

	if (!logPath) {
		console.error(pc.red("Could not find .claude/memory/cost-log.json"));
		console.log(pc.dim("Run a meowkit agent command first to generate cost data."));
		process.exit(1);
	}

	console.log(`${pc.dim("Source:")} ${logPath}`);
	console.log();

	let entries: CostEntry[];
	try {
		entries = readCostLog(logPath);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(pc.red(`Failed to read cost log: ${message}`));
		process.exit(1);
	}

	if (entries.length === 0) {
		console.log(pc.dim("No cost entries recorded yet."));
		return;
	}

	const filteredEntries = filterBudgetEntries(entries, { sessionId, day: dayFilter });

	if (sessionId) {
		console.log(`${pc.dim("Session:")} ${sessionId}`);
	}
	if (dayFilter) {
		console.log(`${pc.dim("Day:")} ${dayFilter}`);
	}
	if (sessionId || dayFilter) {
		console.log();
	}

	if (filteredEntries.length === 0) {
		console.log(pc.dim("No cost entries matched the selected filters."));
		return;
	}

	const budgetRows = filteredEntries.map(toBudgetRow);

	if (args.monthly) {
		aggregateByMonth(budgetRows);
	} else {
		const recent = budgetRows.slice(-10);
		if (budgetRows.length > 10) {
			console.log(pc.dim(`Showing last 10 of ${budgetRows.length} entries`));
			console.log();
		}
		printTable(recent);
	}

	console.log();
	const totalTokens = budgetRows.reduce((sum, e) => sum + e.tokens, 0);
	console.log(`${pc.bold("Total estimated tokens:")} ${pc.cyan(totalTokens.toLocaleString())}`);
}
