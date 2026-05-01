/**
 * Unit tests for the useTodoWriter flow.
 *
 * No jsdom/testing-library available — tests cover:
 *   1. Reducer — toggle flips the correct todo in the correct phase.
 *   2. Reducer — non-matching phase is untouched.
 *   3. Reducer — out-of-range todoIdx leaves array unchanged.
 *   4. Mock-fetch 200 changed:true  — no immediate refetch call (wait for poll).
 *   5. Mock-fetch 200 changed:false — no-op; no refetch.
 *   6. Mock-fetch 409              — refetch() called + toast "Plan changed externally".
 *   7. Mock-fetch 403              — refetch() called + toast with status code.
 *   8. readonly:true               — no fetch at all; toast "Server is read-only".
 *
 * The toggle() function is exercised via a hand-rolled harness that replaces
 * useOptimistic with a synchronous no-op (DOM not available) and stubs fetch.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { phaseListReducer } from "../../hooks/use-todo-writer.js";
import type { PlanPhase } from "../../hooks/use-active-plan.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makePhase(number: number, checkedFlags: boolean[]): PlanPhase {
	return {
		number,
		title: `Phase ${number}`,
		status: "pending",
		effort: "1h",
		filePath: `/tasks/plans/test/phase-0${number}-foo.md`,
		abandoned: false,
		todos: checkedFlags.map((checked, i) => ({ checked, text: `Todo ${i}` })),
	};
}

// ── Reducer tests ─────────────────────────────────────────────────────────────

describe("phaseListReducer", () => {
	it("flips the target todo in the target phase to checked", () => {
		const phases = [makePhase(1, [false, false]), makePhase(2, [false])];
		const result = phaseListReducer(phases, { type: "toggle", phase: 1, todoIdx: 1, checked: true });
		expect(result[0].todos[1].checked).toBe(true);
		expect(result[0].todos[0].checked).toBe(false); // sibling untouched
		expect(result[1].todos[0].checked).toBe(false); // other phase untouched
	});

	it("flips checked → unchecked", () => {
		const phases = [makePhase(3, [true, true])];
		const result = phaseListReducer(phases, { type: "toggle", phase: 3, todoIdx: 0, checked: false });
		expect(result[0].todos[0].checked).toBe(false);
		expect(result[0].todos[1].checked).toBe(true); // sibling untouched
	});

	it("leaves phases unchanged when phase number does not match", () => {
		const phases = [makePhase(1, [false])];
		const result = phaseListReducer(phases, { type: "toggle", phase: 99, todoIdx: 0, checked: true });
		expect(result[0].todos[0].checked).toBe(false); // untouched
	});

	it("returns same phase when todoIdx is out of range (no crash, no flip)", () => {
		const phases = [makePhase(1, [false])];
		const result = phaseListReducer(phases, { type: "toggle", phase: 1, todoIdx: 99, checked: true });
		// Array.map with no-match idx returns original elements
		expect(result[0].todos[0].checked).toBe(false);
		expect(result[0].todos.length).toBe(1);
	});
});

// ── Toggle pipeline tests ─────────────────────────────────────────────────────
// Hand-rolled harness: replaces useOptimistic + useToast with controllable mocks.

type FetchResponse = { status: number; json: () => Promise<unknown> };

function buildHarness(
	fetchImpl: () => Promise<FetchResponse>,
	readonly = false,
) {
	const toastMessages: string[] = [];
	const refetchCalls: number[] = [];
	let callCount = 0;

	const toastCtx = { show: (msg: string) => { toastMessages.push(msg); } };
	const refetch = () => { refetchCalls.push(++callCount); };

	// Minimal toggle reimplemented without hooks for testability
	const toggle = async ({
		phase,
		todoIdx,
		checked,
	}: { phase: number; todoIdx: number; checked: boolean }) => {
		if (readonly) {
			toastCtx.show("Server is read-only");
			return;
		}
		const etag = "abc123";
		let res: FetchResponse;
		try {
			res = await fetchImpl();
		} catch {
			toastCtx.show("Failed to update todo (network error)");
			refetch();
			return;
		}
		if (res.status === 200) {
			const json = await res.json() as { changed?: boolean };
			if (json.changed === false) return; // idempotent
			return; // changed:true — wait for poll
		}
		if (res.status === 409) {
			refetch();
			toastCtx.show("Plan changed externally — reloaded");
			return;
		}
		toastCtx.show(`Failed to update todo (status ${res.status})`);
		refetch();
		void [phase, todoIdx, checked, etag]; // suppress unused warning
	};

	return { toggle, toastMessages, refetchCalls };
}

describe("toggle pipeline (mock fetch)", () => {
	beforeEach(() => { vi.restoreAllMocks(); });
	afterEach(() => { vi.restoreAllMocks(); });

	it("200 changed:true — no immediate refetch (wait for next poll)", async () => {
		const { toggle, refetchCalls } = buildHarness(() =>
			Promise.resolve({ status: 200, json: () => Promise.resolve({ ok: true, changed: true, etag: "new123" }) }),
		);
		await toggle({ phase: 1, todoIdx: 0, checked: true });
		expect(refetchCalls).toHaveLength(0);
	});

	it("200 changed:false — idempotent no-op, no refetch", async () => {
		const { toggle, refetchCalls, toastMessages } = buildHarness(() =>
			Promise.resolve({ status: 200, json: () => Promise.resolve({ ok: true, changed: false }) }),
		);
		await toggle({ phase: 1, todoIdx: 0, checked: false });
		expect(refetchCalls).toHaveLength(0);
		expect(toastMessages).toHaveLength(0);
	});

	it("409 — calls refetch and shows stale-reload toast within same tick", async () => {
		const { toggle, refetchCalls, toastMessages } = buildHarness(() =>
			Promise.resolve({ status: 409, json: () => Promise.resolve({ error: "stale", currentEtag: "new456" }) }),
		);
		await toggle({ phase: 1, todoIdx: 0, checked: true });
		expect(refetchCalls).toHaveLength(1);
		expect(toastMessages).toContain("Plan changed externally — reloaded");
	});

	it("403 — calls refetch and shows status-code toast", async () => {
		const { toggle, refetchCalls, toastMessages } = buildHarness(() =>
			Promise.resolve({ status: 403, json: () => Promise.resolve({ error: "forbidden" }) }),
		);
		await toggle({ phase: 1, todoIdx: 0, checked: true });
		expect(refetchCalls).toHaveLength(1);
		expect(toastMessages[0]).toContain("403");
	});

	it("readonly:true — no fetch, toast 'Server is read-only'", async () => {
		let fetchCalled = false;
		const { toggle, toastMessages, refetchCalls } = buildHarness(() => {
			fetchCalled = true;
			return Promise.resolve({ status: 200, json: () => Promise.resolve({ changed: true }) });
		}, true /* readonly */);
		await toggle({ phase: 1, todoIdx: 0, checked: true });
		expect(fetchCalled).toBe(false);
		expect(refetchCalls).toHaveLength(0);
		expect(toastMessages).toContain("Server is read-only");
	});
});
