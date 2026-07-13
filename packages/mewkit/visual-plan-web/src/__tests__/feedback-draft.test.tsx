/**
 * FeedbackDraftPanel: accumulate a semantic op, `Prepare Feedback` (barrier)
 * POSTs and reveals the Copy Command; adding a new op invalidates it; Prepare is
 * disabled while the save queue is not clean.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, screen, waitFor, cleanup } from "@testing-library/react";
import { FeedbackDraftPanel } from "../app/feedback-draft.js";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function stubFetch201(): void {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			status: 201,
			json: async () => ({ id: "feedback-20260712010101-abcd", copyCommand: "/mk:visual-plan apply-feedback . --batch feedback-20260712010101-abcd" }),
		})),
	);
}

describe("FeedbackDraftPanel", () => {
	it("adds an op, prepares, and reveals the Copy Command", async () => {
		stubFetch201();
		render(<FeedbackDraftPanel canPrepare={true} />);
		fireEvent.change(screen.getByLabelText("Intent"), { target: { value: "shorten the CTA" } });
		fireEvent.click(screen.getByText("Add"));
		expect(screen.getByText(/shorten the CTA/)).toBeTruthy();

		fireEvent.click(screen.getByText("Prepare Feedback"));
		await waitFor(() => expect(screen.getByText("Copy Command")).toBeTruthy());
		expect(screen.getByText(/apply-feedback/)).toBeTruthy();
	});

	it("disables Prepare while the save queue is not clean", () => {
		render(<FeedbackDraftPanel canPrepare={false} />);
		fireEvent.change(screen.getByLabelText("Intent"), { target: { value: "x" } });
		fireEvent.click(screen.getByText("Add"));
		expect((screen.getByText("Prepare Feedback") as HTMLButtonElement).disabled).toBe(true);
	});
});
