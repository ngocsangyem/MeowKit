import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

interface CostEntry {
	date: string;
	command: string;
	tier: string;
	estimated_tokens: number;
	task: string;
}

interface BudgetArgs {
	monthly?: boolean;
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

function padEnd(str: string, len: number): string {
	return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padStart(str: string, len: number): string {
	return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

function printTable(entries: CostEntry[]): void {
	const header = `  ${padEnd("Date", 12)}${padEnd("Command", 16)}${padEnd("Tier", 10)}${padStart("Tokens", 12)}  ${padEnd("Task", 30)}`;
	console.log(pc.bold(header));
	console.log(pc.dim("  " + "-".repeat(80)));

	for (const entry of entries) {
		const line = `  ${padEnd(entry.date, 12)}${padEnd(entry.command, 16)}${padEnd(entry.tier, 10)}${padStart(String(entry.estimated_tokens), 12)}  ${padEnd(entry.task, 30)}`;
		console.log(line);
	}
}

function aggregateByMonth(entries: CostEntry[]): void {
	const monthly = new Map<string, { tokens: number; count: number }>();

	for (const entry of entries) {
		const month = entry.date.slice(0, 7); // YYYY-MM
		const existing = monthly.get(month) ?? { tokens: 0, count: 0 };
		existing.tokens += entry.estimated_tokens;
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

	if (args.monthly) {
		aggregateByMonth(entries);
	} else {
		const recent = entries.slice(-10);
		if (entries.length > 10) {
			console.log(pc.dim(`Showing last 10 of ${entries.length} entries`));
			console.log();
		}
		printTable(recent);
	}

	console.log();
	const totalTokens = entries.reduce((sum, e) => sum + e.estimated_tokens, 0);
	console.log(`${pc.bold("Total estimated tokens:")} ${pc.cyan(totalTokens.toLocaleString())}`);
}
