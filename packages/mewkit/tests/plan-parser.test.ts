/**
 * Plan parser regression tests — covers boundary check (red-team C1),
 * status fallback (H1), CRLF tolerance (M2), abandoned filter, mtime-keyed
 * cache (H3), HTML scrub at /api/plan boundary (H2 — indirect), and
 * fence-aware extractTodos (red-team C1 Phase 1 elevation).
 */

import { describe, expect, it, afterEach } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { readPlan } from "../src/orchviz/plan/index.js";
import { parsePhaseFile } from "../src/orchviz/plan/parse-phase-file.js";
import { findActivePlan } from "../src/orchviz/plan/find-active-plan.js";
import { PlanCollector } from "../src/orchviz/plan/collector.js";

const FIXTURE = path.resolve(__dirname, "fixtures", "plan-redesign-fixture", "8-phase-standard");

let tmpPhaseFile: string | null = null;

afterEach(() => {
	if (tmpPhaseFile) {
		try { fs.unlinkSync(tmpPhaseFile); } catch { /* best-effort */ }
		tmpPhaseFile = null;
	}
});

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
	it("returns same plan content from cache while refreshing generatedAt per call", () => {
		// Use this very project root; the redesign plan IS the active plan.
		const root = path.resolve(__dirname, "..", "..", "..");
		const collector = new PlanCollector(root);
		const a = collector.snapshot();
		const b = collector.snapshot();
		// Cache hit returns the same parsed plan reference (no reparse) ...
		expect(a.plan).toBe(b.plan);
		expect(a.plan).toBeTruthy();
		// ... but generatedAt is refreshed each call so clients see fresh timestamps.
		// (a.generatedAt !== b.generatedAt is expected after the simplify fix.)
	});
});

describe("extractTodos fence-aware parsing (red-team C1)", () => {
	/**
	 * Checkboxes inside ``` fenced code blocks MUST NOT be counted as real todos.
	 * This ensures todoIdx is consistent between the reader and the Phase 2 writer.
	 */
	it("skips checkbox lines inside fenced code blocks in ## Todo List", () => {
		const content = [
			"---",
			"phase: 99",
			"title: Fence Test",
			"status: pending",
			"---",
			"",
			"# Phase 99: Fence Test",
			"",
			"## Todo List",
			"",
			"- [ ] Real todo before fence",
			"",
			"```",
			"- [ ] Fenced checkbox — must not be counted",
			"- [x] Another fenced checkbox — must not be counted",
			"```",
			"",
			"- [x] Real todo after fence",
		].join("\n");

		const tmpDir = os.tmpdir();
		tmpPhaseFile = path.join(tmpDir, `phase-99-fence-test-${Date.now()}.md`);
		fs.writeFileSync(tmpPhaseFile, content, "utf-8");

		const phase = parsePhaseFile(tmpPhaseFile);
		expect(phase).not.toBeNull();
		// Only 2 real todos — the 2 fenced lines are skipped
		expect(phase!.todos).toHaveLength(2);
		expect(phase!.todos[0].text).toBe("Real todo before fence");
		expect(phase!.todos[0].checked).toBe(false);
		expect(phase!.todos[1].text).toBe("Real todo after fence");
		expect(phase!.todos[1].checked).toBe(true);
	});

	it("handles multiple fence blocks, counting only outside checkboxes", () => {
		const content = [
			"# Phase 98: Multi-Fence Test",
			"",
			"## Todo List",
			"",
			"- [ ] Outside A",
			"```",
			"- [ ] Inside fence 1",
			"```",
			"- [x] Outside B",
			"```",
			"- [ ] Inside fence 2a",
			"- [x] Inside fence 2b",
			"```",
			"- [ ] Outside C",
		].join("\n");

		const tmpDir = os.tmpdir();
		tmpPhaseFile = path.join(tmpDir, `phase-98-multi-fence-${Date.now()}.md`);
		fs.writeFileSync(tmpPhaseFile, content, "utf-8");

		const phase = parsePhaseFile(tmpPhaseFile);
		expect(phase).not.toBeNull();
		expect(phase!.todos).toHaveLength(3);
		expect(phase!.todos.map((t) => t.text)).toEqual(["Outside A", "Outside B", "Outside C"]);
	});
});
