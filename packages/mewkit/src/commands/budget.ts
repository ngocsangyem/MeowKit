import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

interface LegacyCostEntry {
	date: string;
	command?: string;
	tier?: string;
	estimated_tokens?: number | string;
	task?: string;
	task_summary?: string;
}

interface SessionCostEntry {
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

type CostEntry = LegacyCostEntry | SessionCostEntry;

interface BudgetRow {
	date: string;
	command: string;
	tier: string;
	tokens: number;
	task: string;
}

interface BudgetArgs {
	monthly?: boolean;
	session?: boolean | string;
	day?: boolean | string;
}

function findCostLog(): string | null {
	let current = process.cwd();
	while (true) {
		const candidate = path.join(current, ".claude", "memory", "cost-log.json");
		if (fs.existsSync(candidate)) {
			return candidate;
		}
		const parent = path.dirname(current);
		if (parent === current) {
			return null;
		}
		current = parent;
	}
}

function readCostLog(logPath: string): CostEntry[] {
	const content = fs.readFileSync(logPath, "utf-8");
	const parsed: unknown = JSON.parse(content);
	if (!Array.isArray(parsed)) {
		throw new Error("cost-log.json must contain an array");
	}
	return parsed as CostEntry[];
}

function findProjectRootFromCostLog(logPath: string): string {
	return path.dirname(path.dirname(path.dirname(logPath)));
}

function normalizeFlagValue(value: boolean | string | undefined): string | null {
	if (value === undefined || value === false) {
		return null;
	}
	if (value === true) {
		return "";
	}
	return value.trim();
}

function resolveCurrentSessionId(projectRoot: string): string | null {
	const envSessionId = process.env.HOOK_SESSION_ID?.trim();
	if (envSessionId) {
		return envSessionId;
	}

	const lastSessionFile = path.join(projectRoot, "session-state", "last-session-id");
	if (!fs.existsSync(lastSessionFile)) {
		return null;
	}

	const sessionId = fs.readFileSync(lastSessionFile, "utf-8").trim();
	return sessionId.length > 0 ? sessionId : null;
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

function padEnd(str: string, len: number): string {
	return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padStart(str: string, len: number): string {
	return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

function printTable(entries: BudgetRow[]): void {
	const header = `  ${padEnd("Date", 18)}${padEnd("Command", 16)}${padEnd("Tier", 10)}${padStart("Tokens", 12)}  ${padEnd("Task", 30)}`;
	console.log(pc.bold(header));
	console.log(pc.dim("  " + "-".repeat(86)));

	for (const entry of entries) {
		const line = `  ${padEnd(entry.date, 18)}${padEnd(entry.command, 16)}${padEnd(entry.tier, 10)}${padStart(entry.tokens.toLocaleString(), 12)}  ${padEnd(entry.task, 30)}`;
		console.log(line);
	}
}

function aggregateByMonth(entries: BudgetRow[]): void {
	const monthly = new Map<string, { tokens: number; count: number }>();

	for (const entry of entries) {
		const month = entry.date.slice(0, 7); // YYYY-MM
		const existing = monthly.get(month) ?? { tokens: 0, count: 0 };
		existing.tokens += entry.tokens;
		existing.count += 1;
		monthly.set(month, existing);
	}

	console.log(pc.bold(`  ${padEnd("Month", 12)}${padStart("Entries", 10)}${padStart("Tokens", 14)}`));
	console.log(pc.dim("  " + "-".repeat(36)));

	for (const [month, data] of monthly) {
		console.log(`  ${padEnd(month, 12)}${padStart(String(data.count), 10)}${padStart(String(data.tokens), 14)}`);
	}
}

export async function budget(args: BudgetArgs): Promise<void> {
	console.log(pc.bold(pc.cyan("Token Budget & Cost Log")));
	console.log();

	const logPath = findCostLog();

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

	const projectRoot = findProjectRootFromCostLog(logPath);
	const sessionFlag = normalizeFlagValue(args.session);
	const sessionId =
		sessionFlag === null ? null : sessionFlag.length > 0 ? sessionFlag : resolveCurrentSessionId(projectRoot);
	if (sessionFlag !== null && !sessionId) {
		console.error(pc.red("Could not determine the current session id."));
		console.log(pc.dim("Expected HOOK_SESSION_ID or session-state/last-session-id."));
		process.exit(1);
	}

	let dayFilter: string | null;
	try {
		dayFilter = resolveDayFilter(args.day);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(pc.red(message));
		process.exit(1);
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
