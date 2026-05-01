/**
 * PlanCollector — read the active plan (or a slug-targeted plan) with mtime-keyed cache.
 *
 * Per red-team H3 (orchviz redesign): cache key is `(planDirMtime, max(phaseFileMtime))`.
 * Cache invalidates the moment any plan file is touched on disk — no stale window.
 * A 60s time-based fallback exists for paranoia (e.g., filesystems with broken mtime).
 *
 * Per R2-3: cache is plain Map<string, CacheEntry> keyed by slug-or-"__active".
 * Soft-reset if map.size > 50. NO LRU, NO 16-entry cap, NO evict-oldest.
 *
 * Per R2-8: PlanSnapshot shape includes phaseEtags (not etag) and error tag.
 * Read-only is the default behavior. Set MEOWKIT_ORCHVIZ_WRITABLE=1 to opt
 * into write mode. Legacy MEOWKIT_ORCHVIZ_READONLY=0 continues to enable
 * writes for backwards compatibility with existing user setups.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { findActivePlan } from "./find-active-plan.js";
import { planMtimeKey, readPlan } from "./index.js";
import { computeAllPhaseEtags } from "./etag.js";
import { SLUG_RE } from "./plan-constants.js";
import type { PlanState } from "./types.js";
import { createLogger } from "../logger.js";

const log = createLogger("PlanCollector");

const FALLBACK_TIMEOUT_MS = 60_000;
const CACHE_SOFT_RESET_THRESHOLD = 50;
const ACTIVE_KEY = "__active";

/**
 * Read-only is the default. Precedence (highest first):
 *   1. MEOWKIT_ORCHVIZ_READONLY=1   forces readonly (defensive lock)
 *   2. MEOWKIT_ORCHVIZ_WRITABLE=1   opts into writes (preferred opt-in)
 *   3. MEOWKIT_ORCHVIZ_READONLY=0   opts into writes (legacy compat)
 *   4. otherwise                   readonly
 */
export function isOrchvizReadonly(): boolean {
	if (process.env.MEOWKIT_ORCHVIZ_READONLY === "1") return true;
	if (process.env.MEOWKIT_ORCHVIZ_WRITABLE === "1") return false;
	if (process.env.MEOWKIT_ORCHVIZ_READONLY === "0") return false;
	return true;
}

/** Error tags for PlanSnapshot failure cases (R2-8). */
export type PlanSnapshotError = "invalid-slug" | "forbidden-path" | "not-found";

export interface PlanSnapshot {
	plan: PlanState | null;
	/** Per-phase etags keyed by phase number. null on error. */
	phaseEtags: Record<number, string> | null;
	/** Whether the server is in read-only mode (default true; see isOrchvizReadonly). */
	readonly: boolean;
	generatedAt: string;
	error?: PlanSnapshotError;
}

interface CacheEntry {
	snapshot: PlanSnapshot;
	mtimeKey: string | null;
	at: number;
}

export class PlanCollector {
	private readonly cache = new Map<string, CacheEntry>();
	/** Cached `realpathSync(plansDir)` — constant per-projectRoot, avoids syscall per slug poll. */
	private resolvedPlansDir: string | null = null;

	constructor(private readonly projectRoot: string) {}

	snapshot(slug?: string): PlanSnapshot {
		const isReadonly = isOrchvizReadonly();
		const generatedAt = new Date().toISOString();

		if (slug !== undefined) {
			return this.snapshotBySlug(slug, isReadonly, generatedAt);
		}
		return this.snapshotActive(isReadonly, generatedAt);
	}

	private snapshotActive(isReadonly: boolean, generatedAt: string): PlanSnapshot {
		const planDir = findActivePlan(this.projectRoot);
		const mtimeKey = planDir ? planMtimeKey(planDir) : null;
		const now = Date.now();

		const cached = this.cache.get(ACTIVE_KEY);
		if (
			cached &&
			cached.mtimeKey === mtimeKey &&
			now - cached.at < FALLBACK_TIMEOUT_MS
		) {
			return { ...cached.snapshot, readonly: isReadonly, generatedAt };
		}

		const plan = planDir ? readPlan(planDir) : null;
		const phaseEtags = planDir ? computeAllPhaseEtags(planDir) : null;
		const snapshot: PlanSnapshot = {
			plan,
			phaseEtags,
			readonly: isReadonly,
			generatedAt,
		};
		this.writeCache(ACTIVE_KEY, snapshot, mtimeKey, now);
		return snapshot;
	}

	private snapshotBySlug(
		slug: string,
		isReadonly: boolean,
		generatedAt: string,
	): PlanSnapshot {
		// Validate slug regex BEFORE any path resolution (defense vs traversal)
		if (!SLUG_RE.test(slug)) {
			return {
				plan: null,
				phaseEtags: null,
				readonly: isReadonly,
				generatedAt,
				error: "invalid-slug",
			};
		}

		const plansDir = path.join(this.projectRoot, "tasks", "plans");
		const planDir = path.join(plansDir, slug);

		// Boundary check via realpath — cached per-process (constant per projectRoot).
		// macOS /var→/private/var symlink resolves once.
		if (this.resolvedPlansDir === null) {
			try {
				this.resolvedPlansDir = fs.realpathSync(plansDir);
			} catch {
				return {
					plan: null,
					phaseEtags: null,
					readonly: isReadonly,
					generatedAt,
					error: "not-found",
				};
			}
		}
		const boundary = this.resolvedPlansDir + path.sep;
		let resolved: string;
		try {
			resolved = fs.realpathSync(planDir);
		} catch {
			return {
				plan: null,
				phaseEtags: null,
				readonly: isReadonly,
				generatedAt,
				error: "not-found",
			};
		}
		if (!(resolved + path.sep).startsWith(boundary)) {
			log.warn(`slug boundary violation: ${slug} -> ${resolved}`);
			return {
				plan: null,
				phaseEtags: null,
				readonly: isReadonly,
				generatedAt,
				error: "forbidden-path",
			};
		}

		const mtimeKey = planMtimeKey(planDir);
		const now = Date.now();

		const cached = this.cache.get(slug);
		if (
			cached &&
			cached.mtimeKey === mtimeKey &&
			now - cached.at < FALLBACK_TIMEOUT_MS
		) {
			return { ...cached.snapshot, readonly: isReadonly, generatedAt };
		}

		const plan = readPlan(planDir);
		if (!plan) {
			return {
				plan: null,
				phaseEtags: null,
				readonly: isReadonly,
				generatedAt,
				error: "not-found",
			};
		}
		const phaseEtags = computeAllPhaseEtags(planDir);
		const snapshot: PlanSnapshot = {
			plan,
			phaseEtags,
			readonly: isReadonly,
			generatedAt,
		};
		this.writeCache(slug, snapshot, mtimeKey, now);
		return snapshot;
	}

	/** Soft-reset the cache if it grows too large, then insert the new entry (R2-3). */
	private writeCache(
		key: string,
		snapshot: PlanSnapshot,
		mtimeKey: string | null,
		now: number,
	): void {
		if (this.cache.size >= CACHE_SOFT_RESET_THRESHOLD) {
			this.cache.clear();
		}
		this.cache.set(key, { snapshot, mtimeKey, at: now });
	}

	invalidate(): void {
		this.cache.clear();
		// resolvedPlansDir is per-projectRoot and never changes; do NOT clear.
	}
}
