import { describe, expect, it } from "vitest";
import {
	createReferenceIntegrityIndex,
	rewriteSourceReferences,
} from "../references/fence-aware-reference-rewriter.js";
import { buildMarkdownSpanMap, isCitationLine } from "../references/reference-classifier.js";

const INDEX = createReferenceIntegrityIndex([
	".claude/skills/demo-skill/",
	".claude/rules/security-rules.md",
	"CLAUDE.md",
]);

describe("markdown span tokenizer", () => {
	it("classifies frontmatter, fenced, inline-code and prose spans", () => {
		const content = "---\ntitle: x\n---\nprose `code` here\n```bash\nrun\n```\ntail";
		const map = buildMarkdownSpanMap(content);
		expect(map.spanAt(content.indexOf("title"))).toBe("frontmatter");
		expect(map.spanAt(content.indexOf("prose"))).toBe("prose");
		expect(map.spanAt(content.indexOf("code"))).toBe("inline-code");
		expect(map.spanAt(content.indexOf("run"))).toBe("fenced");
		expect(map.spanAt(content.indexOf("tail"))).toBe("prose");
	});

	it("supports tilde fences and treats unclosed fences as fenced to the end", () => {
		const content = "~~~\ntilde block\n~~~\nprose\n```\nunclosed";
		const map = buildMarkdownSpanMap(content);
		expect(map.spanAt(content.indexOf("tilde"))).toBe("fenced");
		expect(map.spanAt(content.indexOf("prose"))).toBe("prose");
		expect(map.spanAt(content.indexOf("unclosed"))).toBe("fenced");
	});

	it("does not close a backtick fence with a shorter or different marker", () => {
		const content = "````\n```\nstill fenced\n````\nout";
		const map = buildMarkdownSpanMap(content);
		expect(map.spanAt(content.indexOf("still fenced"))).toBe("fenced");
		expect(map.spanAt(content.indexOf("out"))).toBe("prose");
	});

	it("detects citation lines", () => {
		expect(isCitationLine("> Source: anthropics/claude-code — .claude/agents/planner.md")).toBe(true);
		expect(isCitationLine("Ported from external-org/agent-kit — SKILL.md")).toBe(true);
		expect(isCitationLine("> see https://example.com/docs for details")).toBe(true);
		expect(isCitationLine("Read the rules in .claude/rules/security-rules.md")).toBe(false);
		expect(isCitationLine("> Run .claude/scripts/x.cjs before committing")).toBe(false);
	});
});

describe("fence-aware reference rewriter", () => {
	it("rewrites inline mapped references and records the occurrence", () => {
		const result = rewriteSourceReferences("Read .claude/skills/demo-skill/references/usage.md first.", {
			provider: "codex",
			file: "doc.md",
		});
		expect(result.content).toBe("Read .agents/skills/demo-skill/references/usage.md first.");
		expect(result.occurrences).toEqual([
			expect.objectContaining({
				kind: "mapped-asset",
				decision: "rewrite",
				span: "prose",
				line: 1,
				rewrittenTo: ".agents/skills/demo-skill/references/usage.md",
			}),
		]);
	});

	it("rewrites inline rules references to the merged instruction file", () => {
		const result = rewriteSourceReferences("Read .claude/rules/security-rules.md first.", { provider: "codex" });
		expect(result.content).toBe("Read AGENTS.md first.");
	});

	it("neutralizes inline unmapped runtime paths instead of leaving dead paths", () => {
		const result = rewriteSourceReferences("State lives in .claude/memory/cost.json.", { provider: "codex" });
		expect(result.content).toBe("State lives in project runtime data/memory/cost.json.");
		expect(result.occurrences[0]).toMatchObject({ kind: "unmapped-runtime", decision: "rewrite" });
	});

	it("preserves + warns fenced unmapped runtime commands", () => {
		const result = rewriteSourceReferences("```bash\nnode .claude/scripts/x.cjs\n```", { provider: "codex" });
		expect(result.content).toContain("node .claude/scripts/x.cjs");
		expect(result.content).not.toContain(".codex/scripts");
		expect(result.occurrences[0]).toMatchObject({
			kind: "unmapped-runtime",
			decision: "preserve-warn",
			span: "fenced",
		});
		expect(result.warnings).toHaveLength(1);
	});

	it("rewrites fenced mapped refs only when the asset is in the migration set", () => {
		const fenced = "```bash\npython3 .claude/skills/demo-skill/scripts/run.py\n```";
		const without = rewriteSourceReferences(fenced, { provider: "codex" });
		expect(without.content).toContain(".claude/skills/demo-skill/scripts/run.py");
		expect(without.occurrences[0].decision).toBe("preserve-warn");

		const withProof = rewriteSourceReferences(fenced, { provider: "codex", migratedRefs: INDEX });
		expect(withProof.content).toContain("python3 .agents/skills/demo-skill/scripts/run.py");
		expect(withProof.occurrences[0]).toMatchObject({ decision: "rewrite", kind: "mapped-asset" });
	});

	it("preserves citations silently in any span", () => {
		const content = [
			"> Source: anthropics/claude-code — .claude/agents/planner.md",
			"```text",
			"> Ported from external-org/kit — .claude/skills/demo-skill/SKILL.md",
			"```",
		].join("\n");
		const result = rewriteSourceReferences(content, { provider: "codex", migratedRefs: INDEX });
		expect(result.content).toBe(content);
		expect(result.occurrences.every((o) => o.kind === "citation" && o.decision === "preserve")).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	it("rewrites the config token in prose but preserves it in fenced examples", () => {
		const result = rewriteSourceReferences("Keep CLAUDE.md fresh.\n```bash\ncat CLAUDE.md\n```", {
			provider: "codex",
		});
		expect(result.content).toContain("Keep AGENTS.md fresh.");
		expect(result.content).toContain("cat CLAUDE.md");
	});

	it("treats code content as runnable everywhere", () => {
		const js = 'const p = ".claude/skills/demo-skill/scripts/run.py";\nconst q = ".claude/memory/x.json";';
		const result = rewriteSourceReferences(js, { provider: "codex", migratedRefs: INDEX, contentKind: "code" });
		expect(result.content).toContain('".agents/skills/demo-skill/scripts/run.py"');
		expect(result.content).toContain('".claude/memory/x.json"');
		expect(result.occurrences[1]).toMatchObject({ decision: "preserve-warn" });
	});

	it("never rewrites runnable refs onto merged/non-directory targets", () => {
		// codex agents merge into TOML — a fenced path rewrite would lose the filename
		const fenced = "```bash\ncat .claude/agents/planner.md\n```";
		const result = rewriteSourceReferences(fenced, {
			provider: "codex",
			migratedRefs: createReferenceIntegrityIndex([".claude/agents/planner.md"]),
		});
		expect(result.content).toContain("cat .claude/agents/planner.md");
		expect(result.occurrences[0].decision).toBe("preserve-warn");
	});

	it("falls back to neutral phrases when no provider is given", () => {
		const result = rewriteSourceReferences("See .claude/rules/x.md and CLAUDE.md.", {});
		expect(result.content).toBe("See project rules directory/x.md and project configuration file.");
	});
});
