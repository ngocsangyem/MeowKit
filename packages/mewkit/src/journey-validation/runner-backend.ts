// The RunnerBackend contract for cross-harness journey execution (J10). Phase 7 ships the
// INTERFACE + a deterministic MockRunnerBackend for tests ONLY; the live model-in-loop backends
// (claude-code CLI, codex CLI) are a named follow-up plan gated on the cost-cap budget sign-off
// (see phase-07 open question). Defining the shape here keeps specs + the cost ledger stable so
// the follow-up wires real transcript capture without churning the tested surface.

import type { ProviderType } from "../migrate/types.js";

/** One live-run request: the same journey prompt, targeted at one provider payload. */
export interface RunRequest {
	/** Journey id (e.g. "j10-two-harness-payloads") — for receipt attribution. */
	journeyId: string;
	/** The provider payload this run targets. */
	provider: ProviderType;
	/** The natural-language journey prompt. */
	prompt: string;
	/** Per-run wall-clock budget; the backend MUST return a timedOut receipt if exceeded. */
	timeoutMs: number;
	/** Cooperative-cancellation signal the ledger raises on timeout / cap halt. */
	signal?: AbortSignal;
}

/**
 * A single run's cost + outcome receipt. Costs are USD; a live backend fills `transcriptPath`
 * and `gitFingerprint` (the durable-write snapshot the side-effect oracle diffs). The mock
 * backend fills cost/duration/exit deterministically and leaves the live-only fields undefined.
 */
export interface RunReceipt {
	journeyId: string;
	provider: ProviderType;
	/** 1-indexed repeat number (live runs repeat ×N for variance). */
	repeat: number;
	costUsd: number;
	durationMs: number;
	/** Process exit code; non-zero on failure or timeout. */
	exitCode: number;
	/** True when the run breached its `timeoutMs`. */
	timedOut: boolean;
	/** Live-only: path to the captured transcript (undefined for the mock backend). */
	transcriptPath?: string;
	/** Live-only: durable-write fingerprint captured post-run (undefined for the mock). */
	gitFingerprint?: string;
}

/** Executes a journey prompt against one provider payload and returns a cost/outcome receipt. */
export interface RunnerBackend {
	/** Stable backend id (e.g. "mock", "claude-code-cli", "codex-cli"). */
	readonly name: string;
	/** True for a real model-in-loop backend; false for the deterministic mock. */
	readonly isLive: boolean;
	run(request: RunRequest): Promise<RunReceipt>;
}

/** Fixed per-run cost/duration for the mock backend, overridable per instance. */
export interface MockBackendOptions {
	costUsd?: number;
	durationMs?: number;
	exitCode?: number;
	/** When set, the mock reports the run as timed out (durationMs is forced to timeoutMs). */
	simulateTimeout?: boolean;
}

/**
 * Deterministic, offline backend for cost-ledger + enforcement tests. It makes NO model calls
 * and NO network calls — it returns a fixed receipt per run so the ledger's cap/timeout/repeat
 * behavior is verifiable without a live provider.
 */
export class MockRunnerBackend implements RunnerBackend {
	readonly name = "mock";
	readonly isLive = false;
	private readonly opts: Required<Omit<MockBackendOptions, "simulateTimeout">> & { simulateTimeout: boolean };

	constructor(options: MockBackendOptions = {}) {
		this.opts = {
			costUsd: options.costUsd ?? 1,
			durationMs: options.durationMs ?? 10,
			exitCode: options.exitCode ?? 0,
			simulateTimeout: options.simulateTimeout ?? false,
		};
	}

	async run(request: RunRequest): Promise<RunReceipt> {
		const timedOut = this.opts.simulateTimeout;
		return {
			journeyId: request.journeyId,
			provider: request.provider,
			repeat: 1,
			costUsd: this.opts.costUsd,
			durationMs: timedOut ? request.timeoutMs : this.opts.durationMs,
			exitCode: timedOut ? 124 : this.opts.exitCode,
			timedOut,
		};
	}
}
