// Characterization tests for the codex-full-surface fixture corpus.
// Originally these pinned the pre-rewriter broken behaviors (fenced references
// preserved as dead paths, direct-copy fabricating provider paths). The
// fence-aware reference rewriter flipped them intentionally — assertions below
// describe the corrected contract.

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { convertDirectCopy } from "../converters/direct-copy.js";
import { createReferenceIntegrityIndex } from "../references/fence-aware-reference-rewriter.js";
import { buildMergedAgentsMd } from "../converters/fm-strip.js";
import { stripClaudeRefs } from "../converters/md-strip.js";
import { convertItem } from "../converters/index.js";
import { discoverAgents, discoverConfig, discoverRules } from "../discovery/index.js";
import { providers } from "../provider-registry.js";
import type { PortableItem, ProviderType } from "../types.js";

const fixtureRoot = fileURLToPath(new URL("./fixtures/codex-full-surface/.claude", import.meta.url));

const SNAPSHOT_PROVIDERS: ProviderType[] = ["codex", "cursor", "claude-code"];

let agent: PortableItem;
let config: PortableItem;
let rulesByName: Map<string, PortableItem>;

beforeAll(async () => {
	const agents = await discoverAgents(join(fixtureRoot, "agents"));
	const planner = agents.find((a) => a.name === "planner");
	if (!planner) throw new Error("fixture agent 'planner' not discovered");
	agent = planner;

	const discoveredConfig = await discoverConfig(join(fixtureRoot, "CLAUDE.md"));
	if (!discoveredConfig) throw new Error("fixture CLAUDE.md not discovered");
	config = discoveredConfig;

	const rules = await discoverRules(join(fixtureRoot, "rules"));
	rulesByName = new Map(rules.map((r) => [r.name, r]));
});

function fixtureFileItem(relativePath: string, type: PortableItem["type"]): PortableItem {
	return {
		name: relativePath.split("/").pop() ?? relativePath,
		description: "",
		type,
		sourcePath: join(fixtureRoot, relativePath),
		frontmatter: {},
		body: "",
	};
}

describe("codex full-surface characterization: markdown stripping", () => {
	it("rewrites inline mapped-asset paths for codex config", () => {
		const result = convertItem(config, "md-strip", "codex");
		// Rules merge into AGENTS.md, so inline rules references point there.
		expect(result.content).toContain("Follow the development rules in AGENTS.md");
		expect(result.content).not.toContain("Follow the development rules in .claude/rules/");
	});

	it("preserves fenced unmapped runtime references and surfaces them as warned occurrences", () => {
		const result = convertItem(config, "md-strip", "codex");
		// No provider equivalent exists for this generic script path — preserved
		// verbatim, never fabricated.
		expect(result.content).toContain("node .claude/scripts/validate-docs.cjs");
		const warned = (result.occurrences ?? []).filter((o) => o.decision === "preserve-warn");
		expect(warned.length).toBeGreaterThanOrEqual(1);
		expect(result.warnings.some((w) => w.includes(".claude/scripts/validate-docs.cjs"))).toBe(true);
	});

	it("drops fenced hook references as noise — Codex has no hooks surface (nulled)", () => {
		// Codex hooks conversion is nulled: `.claude/hooks/...` reference lines are
		// dropped as noise (matching the existing "provider has no hooks surface"
		// behavior every provider without a hooks surface has always had — e.g.
		// cursor), never preserved+warned nor fabricated into a target path — even
		// with migration-set proof, since there is no target surface at all.
		const migratedRefs = createReferenceIntegrityIndex([".claude/hooks/validate-docs.cjs"]);
		const result = convertItem(config, "md-strip", "codex", { migratedRefs });
		expect(result.content).not.toContain(".claude/hooks/validate-docs.cjs");
		expect(result.content).not.toContain(".codex/hooks");
		expect(result.content).toContain("node .claude/scripts/validate-docs.cjs");
	});

	it("rewrites the CLAUDE.md token in prose to the provider config path", () => {
		const result = convertItem(config, "md-strip", "codex");
		expect(result.content).toContain("This AGENTS.md file is the entry point");
	});

	it("pins per-provider stripClaudeRefs output for the agent body", () => {
		for (const provider of SNAPSHOT_PROVIDERS) {
			const stripped = stripClaudeRefs(agent.body, {
				provider,
				targetName: providers[provider].displayName,
			});
			expect(stripped.content).toMatchSnapshot(`strip-claude-refs-${provider}`);
		}
	});
});

describe("codex full-surface characterization: direct-copy", () => {
	it("never fabricates provider paths: fenced refs without migration proof are preserved + warned", () => {
		const skillMd = fixtureFileItem("skills/demo-skill/SKILL.md", "skill");
		const result = convertDirectCopy(skillMd, "codex");
		expect(result.content).toContain("node .claude/scripts/validate-docs.cjs");
		expect(result.content).toContain("python3 .claude/skills/demo-skill/scripts/run.py");
		expect(result.content).not.toContain(".codex/scripts/");
		expect(result.content).not.toContain(".codex/skills/");
		expect(result.warnings.length).toBeGreaterThan(0);
		expect(result.content).toMatchSnapshot("direct-copy-skill-md-codex");
	});

	it("rewrites fenced mapped refs to the real provider path when the asset migrates too", () => {
		const skillMd = fixtureFileItem("skills/demo-skill/SKILL.md", "skill");
		const migratedRefs = createReferenceIntegrityIndex([".claude/skills/demo-skill/"]);
		const result = convertDirectCopy(skillMd, "codex", { migratedRefs });
		expect(result.content).toContain("python3 .agents/skills/demo-skill/scripts/run.py");
		// Unmapped runtime path stays preserved + warned regardless of the index.
		expect(result.content).toContain("node .claude/scripts/validate-docs.cjs");
	});

	it("treats non-markdown sources as runnable content: refs preserved unless a real file target exists", () => {
		const hook = fixtureFileItem("hooks/validate-docs.cjs", "hooks");
		const preserved = convertDirectCopy(hook, "codex");
		expect(preserved.content).toContain(".claude/rules/security-rules.md");
		expect(preserved.warnings.length).toBeGreaterThan(0);

		// Even with migration proof, codex rules merge into AGENTS.md — there is
		// no per-rule file to point runnable code at, so the path stays preserved.
		const migratedRefs = createReferenceIntegrityIndex([".claude/rules/security-rules.md"]);
		const rewritten = convertDirectCopy(hook, "codex", { migratedRefs });
		expect(rewritten.content).toContain(".claude/rules/security-rules.md");
		expect(rewritten.content).not.toContain(".codex/rules/");
		expect(rewritten.content).toMatchSnapshot("direct-copy-hook-cjs-codex");
	});

	it("pins per-provider direct-copy output for skill markdown", () => {
		const skillMd = fixtureFileItem("skills/demo-skill/SKILL.md", "skill");
		for (const provider of SNAPSHOT_PROVIDERS) {
			const result = convertDirectCopy(skillMd, provider);
			expect(result.content).toMatchSnapshot(`direct-copy-skill-md-${provider}`);
		}
	});
});

describe("codex full-surface characterization: codex-only surfaces", () => {
	it("nulls agents/commands/hooks conversion — toolkit ships those via the native authored bundle", () => {
		// A project's own custom .claude/agents|commands|hooks are no longer
		// auto-ported to Codex; toolkit agents/commands/hooks ship via the authored
		// bundle + reconciler instead (see migrate-orchestrator's advisory banner).
		expect(providers.codex.agents).toBeNull();
		expect(providers.codex.commands).toBeNull();
		expect(providers.codex.hooks).toBeNull();
	});

	it("keeps skills as direct-copy — the surviving codex-only per-file surface", () => {
		expect(providers.codex.skills?.format).toBe("direct-copy");
		expect(providers.codex.skills?.projectPath).toBe(".agents/skills");
	});

	it("converts markdown rules through md-strip so they merge into AGENTS.md", () => {
		const securityRules = rulesByName.get("security-rules");
		if (!securityRules) throw new Error("fixture rule 'security-rules' not discovered");
		expect(providers.codex.rules?.format).toBe("md-strip");
		expect(providers.codex.rules?.projectPath).toBe("AGENTS.md");
		const result = convertItem(securityRules, "md-strip", "codex");
		expect(result.error).toBeUndefined();
		expect(result.content).toContain("Never commit secrets");
	});

	it("converts config through md-strip so it merges into AGENTS.md too", () => {
		expect(providers.codex.config?.format).toBe("md-strip");
		expect(providers.codex.config?.projectPath).toBe("AGENTS.md");
		const result = convertItem(config, "md-strip", "codex");
		expect(result.error).toBeUndefined();
	});

	it("merged AGENTS.md carries no provenance branding", () => {
		const merged = buildMergedAgentsMd(["## Agent: planner\n\nbody\n"], "Codex");
		expect(merged).not.toContain("Ported from");
		expect(merged).not.toMatch(/MeowKit|mewkit|meowkit/);
	});
});
