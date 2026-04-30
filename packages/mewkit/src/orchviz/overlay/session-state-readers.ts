/**
 * Session-state file readers — model tier, active phase, today's token cost.
 * Per red-team RT2 #15, model + phase + cost are merged into one tiny module.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ModelInfo {
	modelId: string;
	tier: string;
	density?: string;
}

export function readModelInfo(projectRoot: string): ModelInfo | null {
	const p = path.join(projectRoot, "session-state", "detected-model.json");
	let raw: string;
	try {
		raw = fs.readFileSync(p, "utf-8");
	} catch {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (typeof parsed.modelId === "string" && typeof parsed.tier === "string") {
			return {
				modelId: parsed.modelId,
				tier: parsed.tier,
				density: typeof parsed.density === "string" ? parsed.density : undefined,
			};
		}
	} catch {
		// malformed
	}
	return null;
}

export function readActivePhase(projectRoot: string): string | null {
	const p = path.join(projectRoot, "session-state", "active-phase");
	try {
		const raw = fs.readFileSync(p, "utf-8").trim();
		return raw.length > 0 ? raw.slice(0, 60) : null;
	} catch {
		return null;
	}
}

export interface CostSnapshot {
	tokensToday: number;
	usdToday: number;
	entries: number;
}

interface CostEntry {
	date?: string;
	tokens_in?: number;
	tokens_out?: number;
	estimated_tokens?: number;
	estimated_cost_usd?: number;
}

export function readTodayCost(projectRoot: string): CostSnapshot | null {
	const p = path.join(projectRoot, ".claude", "memory", "cost-log.json");
	let raw: string;
	try {
		raw = fs.readFileSync(p, "utf-8");
	} catch {
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed)) return null;
	const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
	let tokens = 0;
	let usd = 0;
	let count = 0;
	for (const e of parsed as CostEntry[]) {
		if (!e || typeof e !== "object" || typeof e.date !== "string") continue;
		if (!e.date.startsWith(today)) continue;
		const tin = typeof e.tokens_in === "number" ? e.tokens_in : 0;
		const tout = typeof e.tokens_out === "number" ? e.tokens_out : 0;
		const est = typeof e.estimated_tokens === "number" ? e.estimated_tokens : 0;
		tokens += tin + tout + (tin + tout === 0 ? est : 0);
		if (typeof e.estimated_cost_usd === "number") usd += e.estimated_cost_usd;
		count++;
	}
	return { tokensToday: tokens, usdToday: usd, entries: count };
}
