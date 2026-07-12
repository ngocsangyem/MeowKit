// Phase 7 slice 1: the consolidation/deprecation ledger. The load-bearing invariant is that this
// phase removes NOTHING — every candidate is deletionThisPhase:false with documented outstanding
// gates and recorded runtime evidence, so "no candidate is deleted solely due to absent static
// references" holds by construction.
import { describe, expect, it } from "vitest";
import { getConsolidationLedger, CONSOLIDATION_LEDGER } from "../consolidation-ledger.js";

describe("consolidation ledger", () => {
	it("covers every Phase-7 plan candidate", () => {
		const ids = new Set(getConsolidationLedger().map((c) => c.id));
		for (const expected of [
			"generated-tables",
			"contributor-indexes",
			"legacy-manifest-writes",
			"json-canonical-memory",
			"substrate",
			"orchviz",
			"trace-index",
			"command-aliases",
			"state-stores",
		]) {
			expect(ids.has(expected), expected).toBe(true);
		}
	});

	it("removes NOTHING this phase — every entry is deletionThisPhase:false with an outstanding gate", () => {
		for (const c of CONSOLIDATION_LEDGER) {
			expect(c.deletionThisPhase, c.id).toBe(false);
			expect(c.remainingGates.length, c.id).toBeGreaterThan(0);
			// Honest evidence: runtime evidence is recorded (even if "none yet"), never omitted.
			expect(c.runtimeEvidence.length, c.id).toBeGreaterThan(0);
		}
	});

	it("records the full deprecation schema for every candidate (no blank fields)", () => {
		for (const c of CONSOLIDATION_LEDGER) {
			for (const field of ["purpose", "staticEvidence", "transitionBehavior", "rollback", "verification"] as const) {
				expect(c[field].length, `${c.id}.${field}`).toBeGreaterThan(0);
			}
		}
	});

	it("applies the plan's explicit classifications (substrate authoring-only; orchviz/trace-index experimental)", () => {
		const byId = new Map(CONSOLIDATION_LEDGER.map((c) => [c.id, c]));
		expect(byId.get("substrate")?.status).toBe("authoring-only");
		expect(byId.get("orchviz")?.status).toBe("experimental");
		expect(byId.get("trace-index")?.status).toBe("experimental");
		expect(byId.get("json-canonical-memory")?.status).toBe("canonical");
	});

	it("ids are unique", () => {
		const ids = CONSOLIDATION_LEDGER.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
