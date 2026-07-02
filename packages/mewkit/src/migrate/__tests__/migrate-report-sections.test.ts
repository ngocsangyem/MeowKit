// Report-section tests: the conversion report over the fixture corpus must
// surface every preserved reference with file:line, keep unsupported concepts
// visible, project the instruction-file budget, and stay free of internal
// validation errors. Section headers (not exact prose) are asserted on the
// printed preflight so wording can evolve without breaking the contract.

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { discoverAgents, discoverCommands, discoverConfig, discoverRules, discoverSkills } from "../discovery/index.js";
import { createReferenceIntegrityIndex } from "../references/fence-aware-reference-rewriter.js";
import { buildConversionReport } from "../validation/migrate-conversion-report.js";
import { printPreflight } from "../migrate-ui-summary.js";
import type { ReconcileAction } from "../reconcile/reconcile-types.js";
import type { PortableItem, PortableType, SkillInfo } from "../types.js";

const fixtureRoot = fileURLToPath(new URL("./fixtures/codex-full-surface/.claude", import.meta.url));

let itemsByType: Record<PortableType, PortableItem[]>;
let skills: SkillInfo[];
let actions: ReconcileAction[];

function actionFor(item: PortableItem): ReconcileAction {
	return {
		action: "install",
		item: item.name,
		type: item.type,
		provider: "codex",
		global: false,
		targetPath: "unused",
		reason: "new-item",
	} as ReconcileAction;
}

beforeAll(async () => {
	const agents = await discoverAgents(join(fixtureRoot, "agents"));
	const commands = await discoverCommands(join(fixtureRoot, "commands"));
	const rules = await discoverRules(join(fixtureRoot, "rules"));
	const config = await discoverConfig(join(fixtureRoot, "CLAUDE.md"));
	skills = await discoverSkills(join(fixtureRoot, "skills"));
	itemsByType = {
		agent: agents,
		command: commands,
		skill: [],
		config: config ? [config] : [],
		rules,
		hooks: [],
	};
	actions = [...agents, ...commands, ...rules, ...(config ? [config] : [])].map(actionFor);
});

describe("conversion report over the fixture corpus", () => {
	it("lists every preserved reference with file:line and reason, with zero validation errors", () => {
		const report = buildConversionReport({
			actions,
			itemsByType,
			skillsByProvider: new Map([["codex", skills]]),
			migratedRefs: createReferenceIntegrityIndex([
				".claude/skills/demo-skill/",
				".claude/rules/security-rules.md",
				"CLAUDE.md",
			]),
		});

		expect(report.validationErrors).toEqual([]);
		expect(report.warnedReferences.length).toBeGreaterThan(0);
		expect(report.warnedReferences.every((line) => /:\d+ — /.test(line))).toBe(true);
		expect(report.warnedReferences.some((line) => line.includes(".claude/scripts/validate-docs.cjs"))).toBe(true);

		// Unsupported concepts (dynamic command syntax) are reported, not dropped.
		expect(report.conversionWarnings.some((w) => w.includes("manual adaptation needed"))).toBe(true);

		// The merged instruction file budget is projected for codex.
		expect(report.budgetLines.some((line) => line.includes("32768"))).toBe(true);
	});

	it("prints the report sections in the preflight output", () => {
		const report = buildConversionReport({
			actions,
			itemsByType,
			skillsByProvider: new Map(),
			migratedRefs: createReferenceIntegrityIndex([]),
		});

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		let output: string;
		try {
			printPreflight(
				{
					actions: [],
					summary: { install: 0, update: 0, skip: 0, conflict: 0, delete: 0 },
					hasConflicts: false,
					banners: [],
				},
				{
					source: { root: fixtureRoot, origin: "explicit" },
					skippedShellHooks: 0,
					bannerExtras: [],
					conversionReport: report,
				},
			);
			output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
		} finally {
			logSpy.mockRestore();
		}

		expect(output).toContain("Preserved references (need attention)");
		expect(output).toContain("Conversion notes");
		expect(output).toContain("Instruction-file budget");
	});
});
