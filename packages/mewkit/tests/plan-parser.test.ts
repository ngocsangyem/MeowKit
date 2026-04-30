/**
 * Plan parser regression tests — covers boundary check (red-team C1),
 * status fallback (H1), CRLF tolerance (M2), abandoned filter, mtime-keyed
 * cache (H3), and HTML scrub at /api/plan boundary (H2 — indirect).
 */

import { describe, expect, it } from "vitest";
import * as path from "node:path";
import { readPlan } from "../src/orchviz/plan/index.js";
import { parsePhaseFile } from "../src/orchviz/plan/parse-phase-file.js";
import { findActivePlan } from "../src/orchviz/plan/find-active-plan.js";
import { PlanCollector } from "../src/orchviz/plan/collector.js";

const FIXTURE = path.resolve(__dirname, "fixtures", "plan-redesign-fixture", "8-phase-standard");

describe("readPlan(8-phase-standard)", () => {
	it("returns plan with frontmatter fields parsed", () => {
		const plan = readPlan(FIXTURE);
		expect(plan).not.toBeNull();
		expect(plan!.slug).toBe("8-phase-standard");
		expect(plan!.title).toContain("Synthetic plan");
		expect(plan!.status).toBe("draft");
		expect(plan!.effort).toBe("m");
	});

	it("filters phase files matching *-ABANDONED.md from rendering set when querying status", () => {
		const plan = readPlan(FIXTURE);
		const abandoned = plan!.phases.filter((p) => p.abandoned);
		expect(abandoned.length).toBe(1);
		expect(abandoned[0].number).toBe(4);
	});

	it("sorts phases by number", () => {
		const plan = readPlan(FIXTURE);
		const numbers = plan!.phases.map((p) => p.number);
		expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
	});

	it("parses todos with checked state", () => {
		const plan = readPlan(FIXTURE);
		const phase1 = plan!.phases.find((p) => p.number === 1);
		expect(phase1?.todos.length).toBe(3);
		expect(phase1?.todos.find((t) => t.text === "Done item")?.checked).toBe(true);
		expect(phase1?.todos.find((t) => t.text === "Define types")?.checked).toBe(false);
	});
});

describe("parsePhaseFile status extraction (red-team H1)", () => {
	it("uses frontmatter status when present", () => {
		const phase = parsePhaseFile(path.join(FIXTURE, "phase-02-implementation.md"));
		expect(phase?.status).toBe("in_progress");
	});

	it("falls back to **Status:** regex when no frontmatter", () => {
		const phase = parsePhaseFile(path.join(FIXTURE, "phase-01-foundation.md"));
		expect(phase?.status).toBe("pending");
	});

	it("marks abandoned phases via filename suffix", () => {
		const phase = parsePhaseFile(path.join(FIXTURE, "phase-04-old-ABANDONED.md"));
		expect(phase?.abandoned).toBe(true);
		expect(phase?.status).toBe("abandoned");
	});
});

describe("findActivePlan boundary check (red-team C1)", () => {
	it("returns null when projectRoot has no tasks/plans/", () => {
		const result = findActivePlan("/nonexistent/path");
		expect(result).toBeNull();
	});
});

describe("PlanCollector mtime-keyed cache (red-team H3)", () => {
	it("returns identical generatedAt on consecutive snapshots within window", () => {
		// Use this very project root; the redesign plan IS the active plan.
		const root = path.resolve(__dirname, "..", "..", "..");
		const collector = new PlanCollector(root);
		const a = collector.snapshot();
		const b = collector.snapshot();
		expect(a.generatedAt).toBe(b.generatedAt);
		expect(a.plan).toBeTruthy();
	});
});
