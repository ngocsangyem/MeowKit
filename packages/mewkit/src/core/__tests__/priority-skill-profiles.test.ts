import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const skill = (name: string) => readFileSync(join(process.cwd(), ".claude", "skills", name, "SKILL.md"), "utf8");
const reference = (skillName: string, fileName: string) =>
	readFileSync(join(process.cwd(), ".claude", "skills", skillName, "references", fileName), "utf8");
const asset = (skillName: string, fileName: string) =>
	readFileSync(join(process.cwd(), ".claude", "skills", skillName, "assets", fileName), "utf8");

describe("priority skill profile contracts", () => {
	it("keeps brainstorming quick output inline and side-effect free", () => {
		const body = skill("brainstorming");
		expect(body).toContain("Do not create a report, plan, wiki candidate, or memory entry.");
		expect(body).toContain("give 2-4 technically distinct options and one recommendation");
		expect(body).toContain(
			"Do not load techniques, scout, scoring, challenge, reports, plans, wiki candidates, memory, or handoff.",
		);
		expect(body).not.toContain("## HTML Output");
		expect(body).not.toContain("npx mewkit wiki handoff propose");
	});

	it("keeps deep brainstorming bounded and resolves product-routing ambiguity", () => {
		const brainstorming = skill("brainstorming");
		const officeHours = skill("office-hours");
		expect(brainstorming).toContain("deep generates 3-8 and never more than 8");
		expect(brainstorming).toContain("one anti-bias pivot, then the challenge pass");
		expect(brainstorming).toContain("split only 3+ independently shippable concerns");
		expect(brainstorming).toContain("A bare “brainstorm” request is ambiguous");
		expect(brainstorming).toContain("mewkit wiki handoff suggest");
		expect(brainstorming).toContain("terminal-handoff-advisory");
		expect(officeHours).toContain("new product, feature, or side-project concept");
		expect(officeHours).toContain(
			"For multiple technical approaches to a validated requirement, use `mk:brainstorming`.",
		);
	});

	it("keeps the unscored deep asset aligned with the deep workflow", () => {
		const ideasAsset = asset("brainstorming", "output-ideas.md");
		expect(ideasAsset).toContain("**Depth:** deep-unscored");
		expect(ideasAsset).toContain("use `assets/output-scored.md` in the same deep run");
		expect(ideasAsset).not.toContain("Solution Decompression");
	});

	it("keeps fix quick evidence-based while avoiding persistent artifacts", () => {
		const body = skill("fix");
		expect(body).toContain("quick: confirm the known cause directly");
		expect(body).toContain("Do not delegate to `mk:investigate`");
		expect(body).toContain("it never bypasses Scout, Diagnose, root-cause evidence, Verify + Prevent");
		expect(body).toContain("No default plan, report, wiki, memory, commit prompt, or subagent fan-out.");
	});

	it("accepts bounded probabilistic evidence for intermittent root causes", () => {
		const body = skill("fix");
		expect(body).toContain("Intermittent failures may use bounded probabilistic evidence");
		expect(body).toContain("Never invent a cause for timing.");
		expect(body).toContain("never as a substitute for the root cause");
		expect(reference("fix", "diagnosis-protocol.md")).toContain("Reproduction evidence");
		expect(reference("fix", "diagnosis-protocol.md")).toContain("Never invent a timing cause.");
	});

	it("keeps quick workflow free of investigation, reviewer, and commit ceremony", () => {
		const quickWorkflow = reference("fix", "workflow-quick.md");
		expect(quickWorkflow).toContain("Confirm the supplied cause");
		expect(quickWorkflow).toContain(
			"Do not create a plan, report, wiki candidate, memory entry, reviewer task, or commit prompt.",
		);
		expect(quickWorkflow).not.toContain("Activate `mk:investigate`");
	});

	it("keeps standard and deep profiles on the full investigation chain", () => {
		for (const workflow of ["workflow-standard.md", "workflow-deep.md"]) {
			const body = reference("fix", workflow);
			expect(body).toContain("mk:scout");
			expect(body).toContain("mk:investigate");
			expect(body).toContain("mk:sequential-thinking");
		}
	});

	it("keeps session handoff thresholds host-neutral", () => {
		const handoff = reference("session-continuation", "handoff-flow.md");
		const resume = reference("session-continuation", "resume-and-state.md");
		expect(handoff).toContain("host reports that its context budget is approaching the warning threshold");
		expect(resume).toContain("host-reported context-warning milestones");
		for (const fixedThreshold of ["75%", "100K", "150K", "175K"]) {
			expect(handoff).not.toContain(fixedThreshold);
			expect(resume).not.toContain(fixedThreshold);
		}
	});

	it("keeps cook shipping explicit and routes lifecycle authority to workflow.yaml", () => {
		const body = skill("cook");
		expect(body).toContain("workflow.yaml` is the only lifecycle phase-sequence authority");
		expect(body).toContain("explicit `mk:ship` request");
	});

	it("keeps Plan Creator's full hard/deep workflow bundle available before Gate 1", () => {
		const body = skill("plan-creator");
		expect(body).toContain(
			"Hard/deep plan creation still runs its built-in red-team and validation interview before Gate 1.",
		);
		expect(body).toContain("mk:validate-plan");
		expect(body).toContain("Step 8: Hydrate Tasks");
		expect(body).toContain("Step 9: Post-Plan Handoff");
		expect(body).toContain("standalone red-team workflow");
		expect(body).toContain("standalone validation workflow");
	});
});
