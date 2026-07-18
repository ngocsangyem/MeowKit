// Phase 7 (MK-P1-01): the benchmark cost ledger enforces the Rule 6 cap against a deterministic
// MockRunnerBackend, so the deferred live backends inherit proven enforcement. No model/network.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	CostLedger,
	DEFAULT_HARD_CAP_USD,
	WARN_USD,
	evaluateSpend,
	resolveCapUsd,
	runWithLedger,
} from "../cost-ledger.js";
import { MockRunnerBackend, type RunRequest } from "../runner-backend.js";

let dir: string | null = null;
afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
	dir = null;
});

const tasks = (n: number) =>
	Array.from({ length: n }, (_, i) => ({ journeyId: `j${i}`, provider: "codex" as RunRequest["provider"], prompt: `p${i}` }));

describe("cost ledger cap resolution (Rule 6)", () => {
	it("precedence: override > MEOWKIT_BUDGET_CAP > tier cap > $100 default", () => {
		expect(resolveCapUsd({ env: {} })).toBe(DEFAULT_HARD_CAP_USD);
		expect(resolveCapUsd({ tierCapUsd: 5, env: {} })).toBe(5);
		expect(resolveCapUsd({ tierCapUsd: 5, env: { MEOWKIT_BUDGET_CAP: "42" } })).toBe(42);
		expect(resolveCapUsd({ override: 7, tierCapUsd: 5, env: { MEOWKIT_BUDGET_CAP: "42" } })).toBe(7);
	});

	it("ignores a non-positive / non-numeric override or env cap", () => {
		expect(resolveCapUsd({ override: 0, tierCapUsd: 5, env: {} })).toBe(5);
		expect(resolveCapUsd({ tierCapUsd: 5, env: { MEOWKIT_BUDGET_CAP: "nope" } })).toBe(5);
	});
});

describe("evaluateSpend thresholds", () => {
	it("warns in [WARN_USD, cap) and halts at the cap", () => {
		expect(evaluateSpend(10, 100).level).toBe("ok");
		expect(evaluateSpend(WARN_USD, 100).level).toBe("warn");
		expect(evaluateSpend(100, 100).level).toBe("halt");
	});

	it("has no warn band when the cap is at or below WARN_USD", () => {
		expect(evaluateSpend(WARN_USD - 1, WARN_USD).level).toBe("ok");
		expect(evaluateSpend(WARN_USD, WARN_USD).level).toBe("halt");
	});
});

describe("runWithLedger enforcement", () => {
	it("halts the instant cumulative cost reaches the cap — remaining tasks do not run", async () => {
		const backend = new MockRunnerBackend({ costUsd: 2 });
		const ledger = new CostLedger(5);
		const result = await runWithLedger(backend, tasks(10), ledger, { timeoutMs: 1000 });
		expect(result.status).toBe("halted");
		// 2 + 2 + 2 = 6 ≥ 5 → halts on the 3rd run; tasks 4..10 never execute.
		expect(result.receipts).toHaveLength(3);
		expect(result.totalUsd).toBe(6);
		expect(result.haltedAt?.level).toBe("halt");
	});

	it("completes under the cap and records every repeat", async () => {
		const backend = new MockRunnerBackend({ costUsd: 1 });
		const ledger = new CostLedger(100);
		const result = await runWithLedger(backend, tasks(2), ledger, { timeoutMs: 1000, repeats: 3 });
		expect(result.status).toBe("complete");
		expect(result.receipts).toHaveLength(6); // 2 tasks × 3 repeats
		expect(result.receipts.map((r) => r.repeat)).toEqual([1, 2, 3, 1, 2, 3]);
	});

	it("records a timed-out run as a zero-cost timeout receipt", async () => {
		// A backend that never resolves within the timeout → the ledger synthesizes the timeout.
		const hangingBackend = {
			name: "hang",
			isLive: false,
			run: (): Promise<never> => new Promise(() => {}),
		};
		const ledger = new CostLedger(100);
		const result = await runWithLedger(hangingBackend, tasks(1), ledger, { timeoutMs: 20 });
		expect(result.status).toBe("complete");
		expect(result.receipts[0].timedOut).toBe(true);
		expect(result.receipts[0].exitCode).toBe(124);
		expect(result.totalUsd).toBe(0);
	});

	it("persists one JSONL receipt per run when a ledger path is given", async () => {
		dir = mkdtempSync(join(tmpdir(), "ledger-"));
		const ledgerPath = join(dir, "run.ledger.jsonl");
		const ledger = new CostLedger(100, ledgerPath);
		await runWithLedger(new MockRunnerBackend({ costUsd: 1 }), tasks(3), ledger, { timeoutMs: 1000 });
		const lines = readFileSync(ledgerPath, "utf-8").trim().split("\n");
		expect(lines).toHaveLength(3);
		expect(JSON.parse(lines[0]).costUsd).toBe(1);
	});
});
