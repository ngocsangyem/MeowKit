/**
 * CoveragePanel reflects the computed ledger: the unresolved chip shows the same
 * count the validator would gate on.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CoveragePanel } from "../app/coverage-panel.js";
import { makeValidPlan } from "../../../src/visual-plan/__fixtures__/valid-plan.js";
import type { VisualPlan } from "../domain/artifact-types.js";

const plan = (): VisualPlan => makeValidPlan() as unknown as VisualPlan;

describe("CoveragePanel", () => {
	it("shows zero unresolved for a complete ledger", () => {
		const { container } = render(<CoveragePanel plan={plan()} />);
		const summary = container.querySelector(".vp-coverage-summary");
		expect(summary?.getAttribute("data-unresolved")).toBe("0");
		expect(container.querySelector('[data-mode="unresolved"]')?.textContent).toBe("0 unresolved");
	});

	it("surfaces an unresolved state count", () => {
		const p = plan();
		p.uiCoverage.surfaces[0].states[0].frameIds = [];
		const { container } = render(<CoveragePanel plan={p} />);
		expect(container.querySelector(".vp-coverage-summary")?.getAttribute("data-unresolved")).toBe("1");
	});
});
