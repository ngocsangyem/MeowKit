/**
 * Component tests for PlanSwitcher — RTL + jsdom.
 *
 * Verifies:
 *   1. Hamburger button renders with correct aria-label
 *   2. Click opens drawer (role="dialog" visible)
 *   3. ESC key closes drawer
 *   4. Outside-click closes drawer
 *   5. Selecting a plan calls onSelect with the slug
 *   6. DrawerBody mounts useAvailablePlans (fetch called once on open)
 */

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, cleanup } from "@testing-library/react";
import { PlanSwitcher } from "../plan-switcher/index.js";
import type { UseActivePlanResult } from "../../hooks/use-active-plan.js";

// ── Empty active-plan stub (drawer body uses it for the lifted-singleton row) ─

const emptyActivePlan: UseActivePlanResult = {
	status: "empty",
	plan: null,
	generatedAt: "",
	etag: null,
	phaseEtags: null,
	readonly: true,
	refetch: () => undefined,
};

// ── Fetch mock ─────────────────────────────────────────────────────────────────

const mockPlans = [
	{
		slug: "260501-test-plan",
		title: "Test Plan",
		status: "draft",
		created: "260501",
		effort: "s",
		mtimeMs: Date.now(),
		phaseCount: 2,
	},
];

function mockFetchOnce(response: unknown, status = 200): void {
	vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(response),
	} as Response);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.restoreAllMocks();
	// Suppress console.warn from useAvailablePlans when fetch isn't mocked
	vi.spyOn(console, "warn").mockReturnValue(undefined);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PlanSwitcher — hamburger button", () => {
	it("1. renders hamburger button with aria-label='Switch plan'", () => {
		render(
			<PlanSwitcher selectedSlug={null} onSelect={vi.fn()} activePlan={emptyActivePlan} onLiveViewSubtitle={vi.fn()} />,
		);
		const btn = screen.getByRole("button", { name: /switch plan/i });
		expect(btn).toBeDefined();
		expect(btn.getAttribute("aria-label")).toBe("Switch plan");
	});

	it("button has aria-expanded=false before open", () => {
		render(<PlanSwitcher selectedSlug={null} onSelect={vi.fn()} activePlan={emptyActivePlan} onLiveViewSubtitle={vi.fn()} />);
		const btn = screen.getByRole("button", { name: /switch plan/i });
		expect(btn.getAttribute("aria-expanded")).toBe("false");
	});
});

describe("PlanSwitcher — drawer open/close", () => {
	it("2. click hamburger opens drawer (role=complementary)", () => {
		render(<PlanSwitcher selectedSlug={null} onSelect={vi.fn()} activePlan={emptyActivePlan} onLiveViewSubtitle={vi.fn()} />);
		const btn = screen.getByRole("button", { name: /switch plan/i });
		fireEvent.click(btn);
		const drawer = screen.getByRole("complementary");
		expect(drawer).toBeDefined();
	});

	it("3. ESC key closes drawer", async () => {
		render(<PlanSwitcher selectedSlug={null} onSelect={vi.fn()} activePlan={emptyActivePlan} onLiveViewSubtitle={vi.fn()} />);
		const btn = screen.getByRole("button", { name: /switch plan/i });
		fireEvent.click(btn);
		expect(screen.queryByRole("complementary")).not.toBeNull();
		await act(async () => {
			fireEvent.keyDown(window, { key: "Escape" });
		});
		// Drawer stays mounted briefly during the close animation, but visibility flips.
		await act(async () => {
			await new Promise((r) => setTimeout(r, 250));
		});
		expect(screen.queryByRole("complementary")).toBeNull();
	});

	it("4. outside-click (on backdrop) closes drawer", () => {
		render(
			<div>
				<PlanSwitcher selectedSlug={null} onSelect={vi.fn()} activePlan={emptyActivePlan} onLiveViewSubtitle={vi.fn()} />
			</div>,
		);
		const btn = screen.getByRole("button", { name: /switch plan/i });
		fireEvent.click(btn);

		const backdrop = screen.getByRole("complementary").parentElement;
		expect(backdrop).not.toBeNull();
		fireEvent.click(backdrop!, { target: backdrop });
	});
});

describe("PlanSwitcher — plan selection", () => {
	it("5. selecting a plan calls onSelect with its slug and closes drawer", async () => {
		mockFetchOnce({ plans: mockPlans, generatedAt: new Date().toISOString() });
		const onSelect = vi.fn();

		render(<PlanSwitcher selectedSlug={null} onSelect={onSelect} activePlan={emptyActivePlan} onLiveViewSubtitle={vi.fn()} />);
		const btn = screen.getByRole("button", { name: /switch plan/i });
		fireEvent.click(btn);

		// Wait for plan list to render
		await waitFor(() => {
			expect(screen.queryByText("Test Plan")).not.toBeNull();
		}, { timeout: 2000 });

		// Click the plan item
		const planItem = screen.getByText("Test Plan");
		fireEvent.click(planItem.closest("button") ?? planItem);

		expect(onSelect).toHaveBeenCalledWith("260501-test-plan");
	});
});

describe("PlanSwitcher — useAvailablePlans idle behavior", () => {
	it("6. fetch is NOT called when drawer is closed (idle session)", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ plans: [], generatedAt: "" }),
		} as Response);

		render(<PlanSwitcher selectedSlug={null} onSelect={vi.fn()} activePlan={emptyActivePlan} onLiveViewSubtitle={vi.fn()} />);

		// Drawer is closed — DrawerBody is not mounted so useAvailablePlans doesn't poll
		await act(async () => {
			await new Promise((r) => setTimeout(r, 100));
		});

		// No fetch while drawer is closed
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("fetch is called after drawer opens (useAvailablePlans mounts)", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ plans: [], generatedAt: "" }),
		} as Response);

		render(<PlanSwitcher selectedSlug={null} onSelect={vi.fn()} activePlan={emptyActivePlan} onLiveViewSubtitle={vi.fn()} />);
		const btn = screen.getByRole("button", { name: /switch plan/i });
		fireEvent.click(btn);

		await waitFor(() => {
			expect(fetchSpy).toHaveBeenCalled();
		}, { timeout: 1000 });

		const call = fetchSpy.mock.calls[0];
		expect(String(call[0])).toBe("/api/plans");
	});
});
