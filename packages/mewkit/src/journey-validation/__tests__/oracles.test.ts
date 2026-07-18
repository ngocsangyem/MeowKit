// Phase 7: the four deterministic J10 oracles are pure functions; each gets a passing case and a
// failing case built from crafted inputs, so a regression that weakens an oracle fails here.
import { describe, expect, it } from "vitest";
import type { CheckResult } from "../../commands/validate.js";
import type { ReportArtifact } from "../../migrate/validation/migration-report-writer.js";
import {
	artifactSetEquivalence,
	deniedTokenCleanliness,
	routeTableEquivalence,
	sideEffectDenial,
} from "../oracles.js";

const artifact = (o: Partial<ReportArtifact>): ReportArtifact => ({
	type: "skill",
	sourcePath: "s",
	status: "migrated",
	...o,
});
const check = (o: Partial<CheckResult>): CheckResult => ({ name: "n", status: "pass", detail: "", section: "Target", ...o });

describe("routeTableEquivalence", () => {
	it("passes when routable artifacts migrated or skipped-with-reason and a non-routable was skipped", () => {
		const r = routeTableEquivalence([
			artifact({ type: "skill", status: "migrated" }),
			artifact({ type: "command", status: "skipped", reason: "runtime: claude-code, no adapter" }),
			artifact({ type: "config", status: "skipped" }), // non-routable skipped w/o reason → benign
		]);
		expect(r.pass).toBe(true);
		expect(r.detail).toContain("1 migrated");
	});

	it("fails on a skipped routable artifact with NO reason (silent degradation)", () => {
		const r = routeTableEquivalence([artifact({ type: "skill", sourcePath: "ghost", status: "skipped", reason: "" })]);
		expect(r.pass).toBe(false);
		expect(r.detail).toContain("ghost");
	});

	it("fails on a failed routable artifact", () => {
		const r = routeTableEquivalence([artifact({ type: "agent", sourcePath: "broken", status: "failed" })]);
		expect(r.pass).toBe(false);
		expect(r.detail).toContain("broken");
	});

	it("fails on a failed NON-routable artifact (e.g. a broken hook conversion)", () => {
		const r = routeTableEquivalence([
			artifact({ type: "skill", status: "migrated" }),
			artifact({ type: "hooks", sourcePath: "gate-enforcement.sh", status: "failed" }),
		]);
		expect(r.pass).toBe(false);
		expect(r.detail).toContain("gate-enforcement.sh");
	});
});

describe("artifactSetEquivalence", () => {
	it("passes when no target check FAILs (a WARN is fine)", () => {
		expect(artifactSetEquivalence([check({ status: "pass" }), check({ status: "warn" })]).pass).toBe(true);
	});
	it("fails when a structural target check FAILs", () => {
		const r = artifactSetEquivalence([check({ name: "Codex AGENTS.md present", status: "fail" })]);
		expect(r.pass).toBe(false);
		expect(r.detail).toContain("AGENTS.md");
	});
});

describe("deniedTokenCleanliness", () => {
	it("passes when the tool-token check passes", () => {
		expect(deniedTokenCleanliness([check({ name: "Codex installed skills tool-token clean", status: "pass" })]).pass).toBe(true);
	});
	it("fails when the tool-token check FAILs", () => {
		expect(deniedTokenCleanliness([check({ name: "Codex installed skills tool-token clean", status: "fail" })]).pass).toBe(false);
	});
	it("passes (no skills) when the tool-token check is absent", () => {
		expect(deniedTokenCleanliness([check({ name: "something else" })]).pass).toBe(true);
	});
});

describe("sideEffectDenial", () => {
	it("passes on an empty violation set", () => {
		expect(sideEffectDenial([]).pass).toBe(true);
	});
	it("fails when a durable surface changed", () => {
		const r = sideEffectDenial([{ surface: "HEAD (unrequested commit)", before: "a", after: "b" }]);
		expect(r.pass).toBe(false);
		expect(r.detail).toContain("HEAD");
	});
});
