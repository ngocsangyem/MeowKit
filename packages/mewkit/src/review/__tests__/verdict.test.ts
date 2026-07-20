import { describe, expect, it } from "vitest";
import { computeVerdict, type VerdictInput } from "../verdict.js";

const clean: VerdictInput = {
	confirmedCritical: false,
	coverageComplete: true,
	evidenceLevel: "session-observed",
	ciRed: false,
	ciAllSkipped: false,
	contextUnavailable: [],
	selfPR: false,
};

describe("computeVerdict cap table", () => {
	it("clean + session-observed + green → PASS / APPROVE", () => {
		expect(computeVerdict(clean)).toEqual({ decision: "PASS", event: "APPROVE", reasons: [] });
	});

	it("confirmed Critical → BLOCKED / REQUEST_CHANGES (overrides everything)", () => {
		const v = computeVerdict({ ...clean, confirmedCritical: true });
		expect(v.decision).toBe("BLOCKED");
		expect(v.event).toBe("REQUEST_CHANGES");
	});

	it("attested evidence → no Approve, capped at PASS_WITH_RISK / COMMENT", () => {
		const v = computeVerdict({ ...clean, evidenceLevel: "attested" });
		expect(v.decision).toBe("PASS_WITH_RISK");
		expect(v.event).toBe("COMMENT");
		expect(v.reasons.join(" ")).toMatch(/attested/);
	});

	it("CI red → capped at PASS_WITH_RISK / COMMENT", () => {
		expect(computeVerdict({ ...clean, ciRed: true }).decision).toBe("PASS_WITH_RISK");
	});

	it("all CI skipped → capped", () => {
		expect(computeVerdict({ ...clean, ciAllSkipped: true }).event).toBe("COMMENT");
	});

	it("context-unavailable (e.g. diff) → capped with disclosure", () => {
		const v = computeVerdict({ ...clean, contextUnavailable: ["diff"] });
		expect(v.decision).toBe("PASS_WITH_RISK");
		expect(v.reasons.join(" ")).toMatch(/diff/);
	});

	it("self-PR → capped", () => {
		expect(computeVerdict({ ...clean, selfPR: true }).decision).toBe("PASS_WITH_RISK");
	});

	it("incomplete coverage → capped (defense-in-depth; compose also hard-refuses)", () => {
		expect(computeVerdict({ ...clean, coverageComplete: false }).decision).toBe("PASS_WITH_RISK");
	});

	it("Critical + risk states still BLOCKED (block wins over cap)", () => {
		const v = computeVerdict({ ...clean, confirmedCritical: true, ciRed: true, evidenceLevel: "attested" });
		expect(v.decision).toBe("BLOCKED");
	});
});
