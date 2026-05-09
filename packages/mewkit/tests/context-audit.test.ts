import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURE = path.join(__dirname, "fixtures", "context-audit");

const INVENTORY = path.join(REPO_ROOT, ".claude/skills/context-audit/scripts/inventory-context.sh");
const ESTIMATE  = path.join(REPO_ROOT, ".claude/skills/context-audit/scripts/estimate-tokens.sh");
const FORMAT    = path.join(REPO_ROOT, ".claude/skills/context-audit/scripts/format-audit-report.sh");

const SPAWN_OPTS = {
	encoding: "utf8" as const,
	timeout: 10_000,
	env: { ...process.env, LC_ALL: "C", PATH: process.env.PATH },
};

function runInventory(scanRoot: string): string {
	const r = spawnSync("bash", [INVENTORY, scanRoot], SPAWN_OPTS);
	if (r.status !== 0) {
		throw new Error(`inventory exit=${r.status}: ${r.stderr}`);
	}
	return r.stdout;
}

function runEstimate(stdin: string): string {
	const r = spawnSync("bash", [ESTIMATE], { ...SPAWN_OPTS, input: stdin });
	if (r.status !== 0) {
		throw new Error(`estimate exit=${r.status}: ${r.stderr}`);
	}
	return r.stdout;
}

function runFormat(stdin: string): string {
	const r = spawnSync("bash", [FORMAT], { ...SPAWN_OPTS, input: stdin });
	if (r.status !== 0) {
		throw new Error(`format exit=${r.status}: ${r.stderr}`);
	}
	return r.stdout;
}

describe("mk:context-audit pipeline", () => {
	it("estimate-tokens totals math: subtotals sum equals grand total", () => {
		const inventoryJson = runInventory(FIXTURE);
		const enrichedJson  = runEstimate(inventoryJson);
		const enriched      = JSON.parse(enrichedJson);
		const t             = enriched.totals;
		const subtotalsSum  =
			t.claude_md_tokens +
			t.agents_tokens +
			t.skills_tokens +
			t.rules_tokens +
			t.commands_tokens +
			t.mcp_tokens;
		expect(subtotalsSum).toBe(t.structural_overhead_tokens);
		expect(t.window_size_tokens).toBe(200000);
	});

	it("format-audit-report excludes essential rules from recommendations", () => {
		const md = runFormat(runEstimate(runInventory(FIXTURE)));
		const recsSection = md.split("## Recommendations")[1] ?? "";
		// The fixture contains injection-rules.md (essential) — must NOT appear in recommendations.
		expect(recsSection).not.toMatch(/injection-rules\.md/);
		// Sanity check: legacy-foo-rules.md (non-essential, > noise floor) MAY appear.
	});

	it("end-to-end pipeline produces a non-empty 5-section report", () => {
		const md = runFormat(runEstimate(runInventory(FIXTURE)));
		expect(md).toContain("# Context Audit");
		expect(md).toContain("## Summary");
		expect(md).toContain("## Top Consumers");
		expect(md).toContain("## Recommendations");
		expect(md).toContain("## How to Act");
		// Footer must cross-link the boundary skills.
		expect(md).toContain("/mk:budget");
		expect(md).toContain("conversation-summary-cache.sh");
		expect(md).toContain("mk:lazy-agent-loader");
	});
});
