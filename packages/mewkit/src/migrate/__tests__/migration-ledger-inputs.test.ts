// Unit tests for the run-ledger aggregation: identity invariant, skipped-vs-failed
// distinction, internal-error records, skippedShellHooks surfacing, and the item-D
// .env reference reclassification through the shell-env scaffold classifier.

import { describe, expect, it } from "vitest";
import type { DiscoveredItems } from "../migrate-discover.js";
import type { SourcePaths } from "../discovery/index.js";
import type { PortableItem, SkillInfo } from "../types.js";
import type { ReferenceOccurrence } from "../references/reference-types.js";
import {
	buildRunRecords,
	enumerateDiscoveredArtifacts,
	reportReasonForOccurrence,
	type RunOutcome,
} from "../validation/migration-ledger-inputs.js";

function item(name: string): PortableItem {
	return { name, description: "", type: "agent", sourcePath: `/src/${name}`, frontmatter: {}, body: "" };
}
function skill(name: string, dirName = name): SkillInfo {
	return { name, dirName, sourcePath: `/src/skills/${dirName}` } as SkillInfo;
}

function discovered(over: Partial<DiscoveredItems>): DiscoveredItems {
	return {
		agents: [],
		commands: [],
		skills: [],
		config: null,
		rules: [],
		hooks: [],
		skippedShellHooks: [],
		source: { root: "/src" } as SourcePaths,
		...over,
	};
}

describe("migration-ledger-inputs", () => {
	it("emits exactly one primary record per discovered artifact (identity invariant)", () => {
		const d = discovered({
			agents: [item("planner")],
			rules: [{ ...item("security-rules"), type: "rules" }],
			skills: [skill("demo")],
			skippedShellHooks: ["gate-enforcement.sh", "privacy-block.sh"],
		});
		expect(enumerateDiscoveredArtifacts(d)).toHaveLength(5);

		const outcomes = new Map<string, RunOutcome>([
			["agent:planner", { outcome: "migrated" }],
			["rules:security-rules", { outcome: "migrated" }],
			["skill:demo", { outcome: "migrated" }],
		]);
		const records = buildRunRecords({ discovered: d, provider: "codex", outcomes, phaseRecords: [], preservedOccurrences: [] });
		expect(records).toHaveLength(5);
		const migrated = records.filter((r) => r.outcome === "migrated").length;
		const skipped = records.filter((r) => r.outcome === "skipped").length;
		const failed = records.filter((r) => r.outcome === "failed").length;
		// Identity: migrated + skipped + failed == discovered artifacts (no silent class).
		expect(migrated + skipped + failed).toBe(enumerateDiscoveredArtifacts(d).length);
	});

	it("marks shell hooks with no outcome as skipped (not failed)", () => {
		const d = discovered({ skippedShellHooks: ["gate-enforcement.sh"] });
		const records = buildRunRecords({ discovered: d, provider: "codex", outcomes: new Map(), phaseRecords: [], preservedOccurrences: [] });
		expect(records).toHaveLength(1);
		expect(records[0].outcome).toBe("skipped");
	});

	it("records an internal installer exception as failed with an internal-error reason", () => {
		const d = discovered({ agents: [item("planner")] });
		const outcomes = new Map<string, RunOutcome>([
			["agent:planner", { outcome: "failed", error: "ENOSPC", internalError: true }],
		]);
		const records = buildRunRecords({ discovered: d, provider: "codex", outcomes, phaseRecords: [], preservedOccurrences: [] });
		expect(records[0].outcome).toBe("failed");
		expect(records[0].detail).toBe("internal-error: ENOSPC");
	});

	it("escalates a primary outcome from a more-severe phase record (audit failure)", () => {
		const d = discovered({ skills: [skill("demo", "demo-skill")] });
		const outcomes = new Map<string, RunOutcome>([["skill:demo", { outcome: "migrated" }]]);
		const records = buildRunRecords({
			discovered: d,
			provider: "codex",
			outcomes,
			phaseRecords: [
				{ source: ".claude/skills/demo-skill/SKILL.md", type: "skill", provider: "codex", outcome: "failed", reason: "audit-rejected", detail: "runtime coupling" },
			],
			preservedOccurrences: [],
		});
		expect(records[0].outcome).toBe("failed");
		expect(records[0].reason).toBe("audit-rejected");
	});

	it("reclassifies a .claude/.env reference reason to point at the shell-env scaffold (item D)", () => {
		const envOcc: ReferenceOccurrence = {
			file: "codex/agent/planner",
			line: 5,
			span: "prose",
			kind: "env",
			decision: "preserve-warn",
			original: ".claude/.env",
			reason: "no provider equivalent for this source runtime path",
		};
		const reason = reportReasonForOccurrence(envOcc);
		expect(reason).toContain("shell_environment_policy");
		expect(reason).not.toContain("no provider equivalent");

		const nonEnv: ReferenceOccurrence = { ...envOcc, original: ".claude/scripts/x.cjs", kind: "unmapped-runtime", reason: "no provider equivalent" };
		expect(reportReasonForOccurrence(nonEnv)).toBe("no provider equivalent");
	});

	it("attaches preserved occurrences (with reclassified .env reason) to the owning artifact", () => {
		const d = discovered({ agents: [item("planner")] });
		const outcomes = new Map<string, RunOutcome>([["agent:planner", { outcome: "migrated" }]]);
		const records = buildRunRecords({
			discovered: d,
			provider: "codex",
			outcomes,
			phaseRecords: [],
			preservedOccurrences: [
				{ file: "codex/agent/planner", line: 12, span: "prose", kind: "env", decision: "preserve-warn", original: ".claude/.env", reason: "old" },
			],
		});
		expect(records[0].occurrences).toHaveLength(1);
		expect(records[0].occurrences?.[0].reason).toContain("shell_environment_policy");
	});
});
