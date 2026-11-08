// Cost ledger + cap enforcement for the benchmark / live-journey path (MK-P1-01). A run appends
// one JSONL receipt per model call and HALTS as soon as cumulative cost reaches the effective
// cap. Thresholds follow `skills/cook/references/harness-rules.md` Rule 6 — warn at $30, hard block at $100, and a user
// cap (`budget.cap` in the project config, or an explicit override) that can move the block point
// lower OR higher.
// We reuse that one scheme rather than inventing a second. This module is the canonical
// enforcement logic the (deferred) live RunnerBackends inherit; it is proven here against the
// MockRunnerBackend so the live path cannot silently overspend.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RunReceipt, RunRequest, RunnerBackend } from "./runner-backend.js";

/** Rule 6 fixed thresholds (USD). */
export const WARN_USD = 30;
export const DEFAULT_HARD_CAP_USD = 100;

export type SpendLevel = "ok" | "warn" | "halt";

export interface SpendEvaluation {
	level: SpendLevel;
	totalUsd: number;
	capUsd: number;
	message?: string;
}

/**
 * Resolve the effective hard cap. Precedence: explicit override → the project config's
 * `budget.cap` → tier cap (the canary tier's own budget) → the Rule 6 default of $100. A user cap
 * can be lower or higher than the tier cap — Rule 6 lets the operator move the block point either
 * way.
 *
 * `configCapUsd` is passed in rather than read here: the config is resolved once, by the caller
 * that knows the project root, so this function stays a pure precedence rule and the committed
 * file has exactly one reader per process. A cap of 0 is the config's way of saying "no user cap".
 */
export function resolveCapUsd(opts: { override?: number; configCapUsd?: number; tierCapUsd?: number } = {}): number {
	if (typeof opts.override === "number" && Number.isFinite(opts.override) && opts.override > 0) return opts.override;
	if (typeof opts.configCapUsd === "number" && Number.isFinite(opts.configCapUsd) && opts.configCapUsd > 0) {
		return opts.configCapUsd;
	}
	if (typeof opts.tierCapUsd === "number" && opts.tierCapUsd > 0) return opts.tierCapUsd;
	return DEFAULT_HARD_CAP_USD;
}

/**
 * Classify a cumulative spend against a cap. HALT at/above the cap; WARN in the [WARN_USD, cap)
 * band; OK below. When the cap is at or under WARN_USD there is no warn band — spend goes
 * straight from OK to HALT at the cap.
 */
export function evaluateSpend(totalUsd: number, capUsd: number): SpendEvaluation {
	if (totalUsd >= capUsd) {
		return {
			level: "halt",
			totalUsd,
			capUsd,
			message: `cost cap reached: $${totalUsd.toFixed(2)} ≥ $${capUsd.toFixed(2)} — halting run`,
		};
	}
	if (capUsd > WARN_USD && totalUsd >= WARN_USD) {
		return {
			level: "warn",
			totalUsd,
			capUsd,
			message: `cost warning: $${totalUsd.toFixed(2)} ≥ $${WARN_USD} (cap $${capUsd.toFixed(2)})`,
		};
	}
	return { level: "ok", totalUsd, capUsd };
}

/** Accumulates receipts and enforces the cap. Optionally persists each receipt as a JSONL line. */
export class CostLedger {
	private totalUsd = 0;
	private readonly receipts: RunReceipt[] = [];

	constructor(
		private readonly capUsd: number,
		private readonly persistPath?: string,
		private readonly onEvent?: (evaluation: SpendEvaluation, receipt: RunReceipt) => void,
	) {
		if (persistPath) mkdirSync(dirname(persistPath), { recursive: true });
	}

	total(): number {
		return this.totalUsd;
	}

	all(): readonly RunReceipt[] {
		return this.receipts;
	}

	/** Record a receipt, persist it, and return the post-record spend evaluation. */
	record(receipt: RunReceipt): SpendEvaluation {
		this.totalUsd += receipt.costUsd;
		this.receipts.push(receipt);
		if (this.persistPath) appendFileSync(this.persistPath, `${JSON.stringify(receipt)}\n`, "utf-8");
		const evaluation = evaluateSpend(this.totalUsd, this.capUsd);
		this.onEvent?.(evaluation, receipt);
		return evaluation;
	}
}

export interface LedgerRunTask {
	journeyId: string;
	provider: RunRequest["provider"];
	prompt: string;
}

export interface LedgerRunOptions {
	/** How many times to repeat each task (live runs sample variance; default 1). */
	repeats?: number;
	/** Per-run wall-clock budget; a run exceeding it is recorded as a timed-out receipt. */
	timeoutMs: number;
}

export interface LedgerRunResult {
	status: "complete" | "halted";
	totalUsd: number;
	receipts: RunReceipt[];
	/** Set when the run halted on the cap; names the halting evaluation. */
	haltedAt?: SpendEvaluation;
}

/** Race a backend run against its timeout, synthesizing a timed-out receipt if the deadline trips. */
async function runWithTimeout(backend: RunnerBackend, request: RunRequest, repeat: number): Promise<RunReceipt> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<RunReceipt>((resolve) => {
		timer = setTimeout(() => {
			controller.abort();
			resolve({
				journeyId: request.journeyId,
				provider: request.provider,
				repeat,
				costUsd: 0,
				durationMs: request.timeoutMs,
				exitCode: 124,
				timedOut: true,
			});
		}, request.timeoutMs);
	});
	try {
		const receipt = await Promise.race([backend.run({ ...request, signal: controller.signal }), timeout]);
		return { ...receipt, repeat };
	} finally {
		if (timer) clearTimeout(timer);
	}
}

/**
 * Execute tasks through a backend under a ledger, enforcing repeats, per-run timeout, and the
 * cost cap. Stops the instant the cap is reached — remaining tasks/repeats do not run.
 */
export async function runWithLedger(
	backend: RunnerBackend,
	tasks: readonly LedgerRunTask[],
	ledger: CostLedger,
	options: LedgerRunOptions,
): Promise<LedgerRunResult> {
	const repeats = Math.max(1, options.repeats ?? 1);
	const receipts: RunReceipt[] = [];
	for (const task of tasks) {
		for (let repeat = 1; repeat <= repeats; repeat++) {
			const receipt = await runWithTimeout(
				backend,
				{ journeyId: task.journeyId, provider: task.provider, prompt: task.prompt, timeoutMs: options.timeoutMs },
				repeat,
			);
			receipts.push(receipt);
			const evaluation = ledger.record(receipt);
			if (evaluation.level === "halt") {
				return { status: "halted", totalUsd: ledger.total(), receipts, haltedAt: evaluation };
			}
		}
	}
	return { status: "complete", totalUsd: ledger.total(), receipts };
}
