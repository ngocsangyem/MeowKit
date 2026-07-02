import { describe, expect, it } from "vitest";
import { scanUnresolvedReferences } from "../validation/unresolved-reference-scanner.js";
import type { ReferenceOccurrence } from "../references/reference-types.js";

function occurrence(partial: Partial<ReferenceOccurrence>): ReferenceOccurrence {
	return {
		file: "f.md",
		line: 1,
		span: "fenced",
		kind: "unmapped-runtime",
		decision: "preserve-warn",
		original: "",
		...partial,
	};
}

describe("unresolved reference scanner", () => {
	it("accepts survivors explained by preserve/preserve-warn occurrences", () => {
		const findings = scanUnresolvedReferences([
			{
				file: "codex/config/CLAUDE",
				content: "```bash\nnode .claude/scripts/x.cjs\n```",
				occurrences: [occurrence({ original: ".claude/scripts/x.cjs" })],
			},
		]);
		expect(findings).toEqual([]);
	});

	it("accepts survivors explained by citations", () => {
		const findings = scanUnresolvedReferences([
			{
				file: "codex/agent/planner",
				content: "> Source: org/repo — .claude/agents/planner.md",
				occurrences: [occurrence({ original: ".claude/agents/planner.md", kind: "citation", decision: "preserve" })],
			},
		]);
		expect(findings).toEqual([]);
	});

	it("accepts rewrite targets that legitimately still match the source pattern", () => {
		const findings = scanUnresolvedReferences([
			{
				file: "opencode/skill/demo",
				content: "Read .claude/skills/demo/SKILL.md",
				occurrences: [
					occurrence({
						original: ".claude/skills/demo/SKILL.md",
						kind: "mapped-asset",
						decision: "rewrite",
						rewrittenTo: ".claude/skills/demo/SKILL.md",
					}),
				],
			},
		]);
		expect(findings).toEqual([]);
	});

	it("fails loudly on a survivor with no explaining occurrence", () => {
		const findings = scanUnresolvedReferences([
			{
				file: "codex/config/CLAUDE",
				content: "line one\nsee .claude/rules/missed.md here",
				occurrences: [],
			},
		]);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			severity: "error",
			file: "codex/config/CLAUDE",
			line: 2,
			reference: ".claude/rules/missed.md",
		});
		expect(findings[0].message).toContain("rewriter missed this case");
	});
});
