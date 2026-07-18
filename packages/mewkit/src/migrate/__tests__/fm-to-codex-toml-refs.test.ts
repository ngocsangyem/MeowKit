// Reference-integrity wiring for the agent → Codex TOML converter.
// Regression coverage for the bug where convertFmToCodexToml dropped the
// migratedRefs index, so every fenced .claude/ reference in an agent body was
// blanket preserve+warned even when the referenced asset WAS migrating.

import { describe, expect, it } from "vitest";
import { convertFmToCodexToml } from "../converters/fm-to-codex-toml.js";
import { createReferenceIntegrityIndex } from "../references/fence-aware-reference-rewriter.js";
import type { PortableItem } from "../types.js";

function makeAgent(body: string): PortableItem {
	return {
		name: "planner",
		description: "Planning agent",
		type: "agent",
		sourcePath: ".claude/agents/planner.md",
		frontmatter: { name: "planner", description: "Planning agent" },
		body,
	};
}

describe("convertFmToCodexToml reference integrity", () => {
	it("rewrites a fenced ref to a migrated skill script to its provider target", () => {
		const body = ["# Planner", "", "```bash", "python3 .claude/skills/demo-skill/scripts/run.py", "```"].join("\n");
		const migratedRefs = createReferenceIntegrityIndex([".claude/skills/demo-skill/"]);

		const result = convertFmToCodexToml(makeAgent(body), { migratedRefs });

		expect(result.content).toContain("python3 .agents/skills/demo-skill/scripts/run.py");
		expect(result.content).not.toContain(".claude/skills/demo-skill/scripts/run.py");

		const rewritten = result.occurrences?.find((o) => o.decision === "rewrite" && o.kind === "mapped-asset");
		expect(rewritten?.rewrittenTo).toBe(".agents/skills/demo-skill/scripts/run.py");
		// The rewrite path must not surface a preserve-warn for the migrated asset.
		expect(result.warnings.some((w) => w.includes(".claude/skills/demo-skill/scripts/run.py"))).toBe(false);
	});

	it("preserves and warns a fenced ref to an asset outside the migration set", () => {
		const body = ["# Planner", "", "```bash", "python3 .claude/skills/other-skill/scripts/run.py", "```"].join("\n");
		// demo-skill migrates, other-skill does NOT — the ref must fail closed.
		const migratedRefs = createReferenceIntegrityIndex([".claude/skills/demo-skill/"]);

		const result = convertFmToCodexToml(makeAgent(body), { migratedRefs });

		expect(result.content).toContain(".claude/skills/other-skill/scripts/run.py");
		const preserved = result.occurrences?.find(
			(o) => o.decision === "preserve-warn" && o.original.includes("other-skill"),
		);
		expect(preserved).toBeDefined();
		expect(result.warnings.some((w) => w.includes("other-skill"))).toBe(true);
	});

	it("without an index, a fenced ref to a mapped asset stays preserve+warned (unchanged legacy behavior)", () => {
		const body = ["# Planner", "", "```bash", "python3 .claude/skills/demo-skill/scripts/run.py", "```"].join("\n");

		const result = convertFmToCodexToml(makeAgent(body));

		expect(result.content).toContain(".claude/skills/demo-skill/scripts/run.py");
		const preserved = result.occurrences?.find((o) => o.decision === "preserve-warn");
		expect(preserved).toBeDefined();
	});
});
