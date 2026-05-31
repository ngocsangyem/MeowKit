import { describe, expect, it } from "vitest";
import { analyzeArtifactUsage, filterUnused } from "../usage/usage-analyzer.js";
import type { InventoryEntry } from "../build-inventory.js";
import type { EventRecord } from "../event-log.js";

const skill: InventoryEntry = {
	type: "skill",
	path: "skills/cook/SKILL.md",
	id: "mk:cook",
	owner: "lifecycle",
	criticality: "high",
	status: "active",
	runtime: "claude-code",
	source: "frontmatter",
};

function event(data: Record<string, unknown>): EventRecord {
	return { schema_version: "1.0", ts: "2026-05-31T00:00:00.000Z", event: "skill.invoked", data };
}

describe("usage analyzer", () => {
	it("renders N/A when usage events are absent", () => {
		const report = analyzeArtifactUsage([skill], []);
		expect(report.status).toBe("na");
		expect(filterUnused(report)).toEqual([]);
	});

	it("counts emitted usage events", () => {
		const report = analyzeArtifactUsage([skill], [event({ skill: "mk:cook" }), event({ skill: "mk:cook" })]);
		expect(report.status).toBe("available");
		expect(report.artifacts[0]?.count).toBe(2);
		expect(filterUnused(report, 3)).toHaveLength(1);
	});
});
