/**
 * PlanCollector — read the active plan with mtime-keyed cache.
 *
 * Per red-team H3 (orchviz redesign): cache key is `(planDirMtime, max(phaseFileMtime))`.
 * Cache invalidates the moment any plan file is touched on disk — no stale window.
 * A 60s time-based fallback exists for paranoia (e.g., filesystems with broken mtime).
 */

import { findActivePlan } from "./find-active-plan.js";
import { planMtimeKey, readPlan } from "./index.js";
import type { PlanState } from "./types.js";

const FALLBACK_TIMEOUT_MS = 60_000;

export interface PlanSnapshot {
	plan: PlanState | null;
	generatedAt: string;
}

interface CacheEntry {
	snapshot: PlanSnapshot;
	mtimeKey: string | null;
	at: number;
}

export class PlanCollector {
	private cache: CacheEntry | null = null;

	constructor(private readonly projectRoot: string) {}

	snapshot(): PlanSnapshot {
		const planDir = findActivePlan(this.projectRoot);
		const mtimeKey = planDir ? planMtimeKey(planDir) : null;
		const now = Date.now();

		if (
			this.cache &&
			this.cache.mtimeKey === mtimeKey &&
			now - this.cache.at < FALLBACK_TIMEOUT_MS
		) {
			return this.cache.snapshot;
		}

		const plan = planDir ? readPlan(planDir) : null;
		const snapshot: PlanSnapshot = {
			plan,
			generatedAt: new Date().toISOString(),
		};
		this.cache = { snapshot, mtimeKey, at: now };
		return snapshot;
	}

	invalidate(): void {
		this.cache = null;
	}
}
