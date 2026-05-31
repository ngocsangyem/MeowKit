import { describe, expect, it } from "vitest";
import { suggestionsFromEvents } from "../evolution/event-clusters.js";
import type { EventRecord } from "../event-log.js";

function event(event: string, data: Record<string, unknown>): EventRecord {
	return { schema_version: "1.0", ts: new Date().toISOString(), event, data };
}

describe("evolution suggestions", () => {
	it("promotes repeated hook and review failures without applying edits", () => {
		const suggestions = suggestionsFromEvents(
			[
				event("hook.failed", { hook: "gate-enforcement.sh", exit_code: 2 }),
				event("hook.failed", { hook: "gate-enforcement.sh", exit_code: 2 }),
				event("verdict_written", { overall: "FAIL", slug: "auth-review", task: "a" }),
				event("verdict_written", { overall: "FAIL", slug: "auth-review", task: "b" }),
			],
			0,
		);
		expect(suggestions.map((s) => s.kind)).toContain("hook-test");
		expect(suggestions.map((s) => s.kind)).toContain("review-promotion");
		expect(suggestions.every((s) => s.neverAutoApply)).toBe(true);
	});

	it("reports malformed trace rows as hardening evidence", () => {
		const suggestions = suggestionsFromEvents([], 3);
		expect(suggestions[0]?.kind).toBe("trace-hardening");
		expect(suggestions[0]?.evidence[0]?.count).toBe(3);
	});
});
