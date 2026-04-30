/**
 * OverlayCollector — read meowkit-specific overlays with 5s cache.
 *
 * Powers /api/overlays. All readers fail gracefully → null fields.
 */

import { readGate1State, readGate2State } from "./gate-readers.js";
import { readModelInfo, readActivePhase, readTodayCost } from "./session-state-readers.js";

const CACHE_MS = 5000;

export interface OverlaySnapshot {
	gate1: { name: string; approved: boolean } | null;
	gate2: { name: string; verdict: string } | null;
	model: string | null;
	phase: string | null;
	cost: { tokens: number; usd: number } | null;
}

export class OverlayCollector {
	private cache: { snapshot: OverlaySnapshot; at: number } | null = null;
	constructor(private readonly projectRoot: string) {}

	snapshot(): OverlaySnapshot {
		const now = Date.now();
		if (this.cache && now - this.cache.at < CACHE_MS) return this.cache.snapshot;

		const g1 = readGate1State(this.projectRoot);
		const g2 = readGate2State(this.projectRoot);
		const model = readModelInfo(this.projectRoot);
		const phase = readActivePhase(this.projectRoot);
		const cost = readTodayCost(this.projectRoot);

		const snapshot: OverlaySnapshot = {
			gate1: g1 ? { name: g1.name, approved: g1.approved } : null,
			gate2: g2 ? { name: g2.name, verdict: g2.verdict } : null,
			model: model ? `${model.tier} · ${model.modelId}` : null,
			phase,
			cost: cost ? { tokens: cost.tokensToday, usd: cost.usdToday } : null,
		};
		this.cache = { snapshot, at: now };
		return snapshot;
	}

	invalidate(): void {
		this.cache = null;
	}
}
