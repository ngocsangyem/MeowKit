import fs from "node:fs";
import path from "node:path";
import type { CostEntry, LiveBudgetState } from "./budget-types.js";

export function findCostLog(): string | null {
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

export function readCostLog(logPath: string): CostEntry[] {
	const content = fs.readFileSync(logPath, "utf-8");
	const parsed: unknown = JSON.parse(content);
	if (!Array.isArray(parsed)) {
		throw new Error("cost-log.json must contain an array");
	}
	return parsed as CostEntry[];
}

export function findProjectRootFromCostLog(logPath: string): string {
	return path.dirname(path.dirname(path.dirname(logPath)));
}

export function resolveCurrentSessionId(projectRoot: string): string | null {
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

export function readLiveBudgetState(projectRoot: string): LiveBudgetState | null {
	const budgetStateFile = path.join(projectRoot, "session-state", "budget-state.json");
	if (!fs.existsSync(budgetStateFile)) {
		return null;
	}

	try {
		const parsed = JSON.parse(fs.readFileSync(budgetStateFile, "utf-8")) as LiveBudgetState;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}
