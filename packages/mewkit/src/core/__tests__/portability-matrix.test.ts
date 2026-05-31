import { describe, expect, it } from "vitest";
import { buildPortabilityMatrix, coverage, explainProvider } from "../portability-matrix.js";

describe("portability matrix", () => {
	it("builds rows from provider diagnostics", () => {
		const rows = buildPortabilityMatrix();
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((r) => r.provider && r.surface && r.displayStatus)).toBe(true);
	});

	it("explains one provider and summarizes coverage", () => {
		expect(explainProvider("codex").length).toBeGreaterThan(0);
		const summary = coverage();
		expect(summary.surfaces).toBeGreaterThan(0);
		expect(summary.documented + summary.disabledUnsupported + summary.fail).toBeGreaterThan(0);
	});
});
