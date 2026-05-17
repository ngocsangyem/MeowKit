import pc from "picocolors";
import type { BudgetRow, LiveBudgetSummary } from "./budget-types.js";

function padEnd(str: string, len: number): string {
	return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padStart(str: string, len: number): string {
	return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

export function printTable(entries: BudgetRow[]): void {
	const header = `  ${padEnd("Date", 18)}${padEnd("Command", 16)}${padEnd("Tier", 10)}${padStart("Tokens", 12)}  ${padEnd("Task", 30)}`;
	console.log(pc.bold(header));
	console.log(pc.dim("  " + "-".repeat(86)));

	for (const entry of entries) {
		const line = `  ${padEnd(entry.date, 18)}${padEnd(entry.command, 16)}${padEnd(entry.tier, 10)}${padStart(entry.tokens.toLocaleString(), 12)}  ${padEnd(entry.task, 30)}`;
		console.log(line);
	}
}

export function printLiveSessionSummary(sessionId: string, summary: LiveBudgetSummary): void {
	console.log(`${pc.dim("Session:")} ${sessionId}`);
	console.log(`${pc.dim("Mode:")} live session accumulator`);
	console.log();
	console.log(`${pc.bold("Input tokens:")} ${pc.cyan(summary.inputTokens.toLocaleString())}`);
	console.log(`${pc.bold("Output tokens:")} ${pc.cyan(summary.outputTokens.toLocaleString())}`);
	console.log(`${pc.bold("Total tokens used:")} ${pc.cyan(summary.totalTokens.toLocaleString())}`);
	console.log(`${pc.bold("Human reads:")} ${pc.cyan(summary.humanReads.toLocaleString())}`);
	console.log(`${pc.bold("Estimated cost:")} ${pc.cyan(`$${summary.estimatedCost.toFixed(2)}`)}`);
}

export function aggregateByMonth(entries: BudgetRow[]): void {
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
