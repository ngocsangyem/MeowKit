import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkWorkflowDrift, loadWorkflowSpec, WorkflowSpecError } from "../check-workflow-drift.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const SPEC = `version: 1
phases:
  - id: 0
    name: Orient
    lead: mk:agent-detector
  - id: 1
    name: Plan
    gate: gate_1
    required_outputs: ["tasks/plans/*/plan.md"]
  - id: 2
    name: Test
  - id: 3
    name: Build
    substeps:
      - id: "3.5"
        name: Simplify
      - id: "3.6"
        name: Verify
  - id: 4
    name: Review
    gate: gate_2
    required_outputs: ["tasks/reviews/*-verdict.md"]
  - id: 5
    name: Ship
  - id: 6
    name: Reflect
    leads: [analyst, documenter, "mk:memory"]
gates:
  - id: gate_1
    required_output: "tasks/plans/*/plan.md"
  - id: gate_2
    required_output: "tasks/reviews/*-verdict.md"
sources:
  - lifecycle.md
`;

// A clean prose file that mentions every canonical phase name (so coverage
// passes) and contains no contradictions.
const CLEAN_PROSE = `# Lifecycle

Phase 0 Orient → Phase 1 Plan → Phase 2 Test → Phase 3 Build →
Phase 3.5 Simplify → Phase 3.6 Verify → Phase 4 Review → Phase 5 Ship →
Phase 6 Reflect.

Gate 1 requires tasks/plans/*/plan.md. Gate 2 requires tasks/reviews/*-verdict.md.
applies_to: [Phase 0, 1, 2, 3, 4, 5, 6]
Phase 6 Reflect leads: analyst + documenter + mk:memory.
`;

async function makeHarness(spec: string, prose: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-wfdrift-"));
	tempDirs.push(root);
	await mkdir(join(root, ".claude"), { recursive: true });
	await writeFile(join(root, ".claude", "workflow.yaml"), spec);
	await writeFile(join(root, "lifecycle.md"), prose);
	return root;
}

const hasFail = (results: ReturnType<typeof checkWorkflowDrift>) => results.some((r) => r.status === "fail");
const failDetail = (results: ReturnType<typeof checkWorkflowDrift>) =>
	results.filter((r) => r.status === "fail").map((r) => r.detail).join("\n");

describe("checkWorkflowDrift", () => {
	it("PASSES on a consistent harness", async () => {
		const root = await makeHarness(SPEC, CLEAN_PROSE);
		const results = checkWorkflowDrift(root);
		expect(hasFail(results)).toBe(false);
	});

	it("FAILS when a phase name is bound to the wrong id (Phase 4 Build)", async () => {
		const prose = CLEAN_PROSE.replace("Phase 4 Review", "Phase 4 Build");
		const root = await makeHarness(SPEC, prose);
		const results = checkWorkflowDrift(root);
		expect(hasFail(results)).toBe(true);
		expect(failDetail(results)).toContain("Phase 4 Build");
	});

	it("FAILS on a required-output path typo (tasks/review/ for tasks/reviews/)", async () => {
		const prose = `${CLEAN_PROSE}\nSee tasks/review/foo-verdict.md for the verdict.\n`;
		const root = await makeHarness(SPEC, prose);
		const results = checkWorkflowDrift(root);
		expect(hasFail(results)).toBe(true);
		expect(failDetail(results)).toContain("tasks/reviews/");
	});

	it("FAILS when applies_to omits Phase 0", async () => {
		const prose = CLEAN_PROSE.replace("applies_to: [Phase 0, 1, 2, 3, 4, 5, 6]", "applies_to: [Phase 1, 2, 3, 4, 5, 6]");
		const root = await makeHarness(SPEC, prose);
		const results = checkWorkflowDrift(root);
		expect(hasFail(results)).toBe(true);
		expect(failDetail(results)).toContain("applies_to omits Phase 0");
	});

	it("FAILS when the Reflect lead list drops a canonical lead", async () => {
		const prose = CLEAN_PROSE.replace("analyst + documenter + mk:memory", "documenter + mk:memory");
		const root = await makeHarness(SPEC, prose);
		const results = checkWorkflowDrift(root);
		expect(hasFail(results)).toBe(true);
		expect(failDetail(results)).toContain("Reflect leads missing analyst");
	});

	it("FAILS when an output glob is bound to the wrong gate", async () => {
		const prose = `${CLEAN_PROSE}\nGate 1 produces tasks/reviews/x-verdict.md.\n`;
		const root = await makeHarness(SPEC, prose);
		const results = checkWorkflowDrift(root);
		expect(hasFail(results)).toBe(true);
	});

	it("FAILS (does not skip) when workflow.yaml is missing", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-wfdrift-"));
		tempDirs.push(root);
		await mkdir(join(root, ".claude"), { recursive: true });
		const results = checkWorkflowDrift(root);
		expect(hasFail(results)).toBe(true);
		expect(failDetail(results)).toContain("missing");
	});

	it("FAILS (does not skip) when workflow.yaml is unparseable", async () => {
		const root = await makeHarness("version: 1\nphases: [unbalanced", CLEAN_PROSE);
		const results = checkWorkflowDrift(root);
		expect(hasFail(results)).toBe(true);
	});

	it("FAILS when a canonical phase name appears in no source file", async () => {
		const prose = CLEAN_PROSE.replace(/Phase 5 Ship/g, "Phase 5").replace("Phase 6 Reflect →\n", "").replace(/Ship/g, "");
		const root = await makeHarness(SPEC, prose);
		const results = checkWorkflowDrift(root);
		expect(hasFail(results)).toBe(true);
		expect(failDetail(results)).toContain("absent from all sources");
	});

	it("loadWorkflowSpec throws WorkflowSpecError on a missing spec", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-wfdrift-"));
		tempDirs.push(root);
		expect(() => loadWorkflowSpec(root)).toThrow(WorkflowSpecError);
	});

	it("downgrades a MISSING spec to WARN when missingSpecSeverity=warn (un-synced install)", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-wfdrift-"));
		tempDirs.push(root);
		await mkdir(join(root, ".claude"), { recursive: true });
		const results = checkWorkflowDrift(root, { missingSpecSeverity: "warn" });
		expect(results.some((r) => r.status === "fail")).toBe(false);
		expect(results.some((r) => r.status === "warn")).toBe(true);
	});

	it("keeps an UNPARSEABLE spec a FAIL even with missingSpecSeverity=warn (present-but-broken)", async () => {
		const root = await makeHarness("version: 1\nphases: [unbalanced", CLEAN_PROSE);
		const results = checkWorkflowDrift(root, { missingSpecSeverity: "warn" });
		expect(results.some((r) => r.status === "fail")).toBe(true);
	});
});
