import fs from "node:fs";
import path from "node:path";
import { resolveSessionStateFile, resolveStateDir } from "../state/resolve-state-dir.js";
import type { CostEntry, LiveBudgetState } from "./budget-types.js";

/**
 * The path the search looks for in each directory it walks. Exported so the message a user
 * sees when the search fails can name the same path the search used — the old message named
 * a location this code has never read, which sent people to a file that was never there.
 */
export function costLogCandidate(dir: string): string {
	return path.join(resolveStateDir(dir, "telemetry"), "cost-log.json");
}

export function findCostLog(): string | null {
	let current = process.cwd();
	while (true) {
		const candidate = costLogCandidate(current);
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

	const lastSessionFile = resolveSessionStateFile(projectRoot, "last-session-id");
	if (!fs.existsSync(lastSessionFile)) {
		return null;
	}

	const sessionId = fs.readFileSync(lastSessionFile, "utf-8").trim();
	return sessionId.length > 0 ? sessionId : null;
}

export function readLiveBudgetState(projectRoot: string): LiveBudgetState | null {
	const budgetStateFile = resolveSessionStateFile(projectRoot, "budget-state.json");
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
