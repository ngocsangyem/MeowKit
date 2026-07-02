import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	buildReferenceRewriteTable,
	getReferenceTarget,
	resolveReferenceTarget,
} from "../references/reference-target-registry.js";
import { providers } from "../provider-registry.js";
import type { ProviderType } from "../types.js";

const ALL_PROVIDERS = Object.keys(providers) as ProviderType[];

describe("reference target registry", () => {
	it("derives one rule per portable type for every provider", () => {
		for (const provider of ALL_PROVIDERS) {
			const table = buildReferenceRewriteTable(provider);
			expect(table.map((r) => r.type).sort()).toEqual(
				["agents", "commands", "config", "hooks", "rules", "skills"].sort(),
			);
		}
	});

	it("resolves mapped directory references with the item suffix appended", () => {
		const table = buildReferenceRewriteTable("codex");
		expect(resolveReferenceTarget(table, ".claude/skills/demo-skill/scripts/run.py")).toBe(
			".agents/skills/demo-skill/scripts/run.py",
		);
	});

	it("resolves non-directory targets to the bare target path", () => {
		// codex agents merge into TOML; codex rules merge into AGENTS.md —
		// neither target is a per-file directory.
		const table = buildReferenceRewriteTable("codex");
		expect(resolveReferenceTarget(table, ".claude/agents/planner.md")).toBe(".codex/agents");
		expect(resolveReferenceTarget(table, ".claude/rules/security-rules.md")).toBe("AGENTS.md");
	});

	it("resolves codex command references through the skill-directory special case", () => {
		const table = buildReferenceRewriteTable("codex");
		expect(resolveReferenceTarget(table, ".claude/commands/mk/fix.md")).toBe(
			".agents/skills/source-command-mk-fix/SKILL.md",
		);
	});

	it("returns null for types the provider does not support", () => {
		expect(getReferenceTarget("goose", "commands")).toBeNull();
		const table = buildReferenceRewriteTable("goose");
		expect(resolveReferenceTarget(table, ".claude/commands/mk/fix.md")).toBeNull();
	});

	it("returns null for unmapped runtime paths", () => {
		const table = buildReferenceRewriteTable("codex");
		expect(resolveReferenceTarget(table, ".claude/scripts/validate-docs.cjs")).toBeNull();
		expect(resolveReferenceTarget(table, ".claude/memory/cost-log.json")).toBeNull();
	});

	it("resolves the config token to the provider config path", () => {
		const table = buildReferenceRewriteTable("codex");
		expect(resolveReferenceTarget(table, "CLAUDE.md")).toBe("AGENTS.md");
	});

	it("prefers the global path when scope is global", () => {
		const projectTarget = getReferenceTarget("codex", "config", "project");
		const globalTarget = getReferenceTarget("codex", "config", "global");
		expect(projectTarget?.path).toBe("AGENTS.md");
		expect(globalTarget?.path).toBe("~/.codex/AGENTS.md");
	});

});

describe("converter source hygiene", () => {
	// Mapping literals must live only in the reference registry. If this fails,
	// a converter re-introduced its own `.claude`/provider-root strings.
	const guardedFiles = ["md-strip.ts", "direct-copy.ts"];

	it("refactored converters contain no source-root or provider-root literals", () => {
		for (const file of guardedFiles) {
			const source = readFileSync(
				fileURLToPath(new URL(`../converters/${file}`, import.meta.url)),
				"utf-8",
			);
			expect(source, `${file} must not embed ".claude" literals`).not.toMatch(/\.claude/);
			expect(source, `${file} must not embed provider root literals`).not.toMatch(
				/"\.(codex|cursor|gemini|opencode|factory|windsurf|agent|roo|kilocode|goose|agents|cline|openhands|github)\//,
			);
		}
	});
});
