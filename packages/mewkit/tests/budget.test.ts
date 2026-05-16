import { describe, expect, it } from "vitest";
import { filterBudgetEntries, toBudgetRow } from "../src/commands/budget.js";

describe("toBudgetRow", () => {
	it("keeps legacy estimated_tokens entries intact", () => {
		const row = toBudgetRow({
			date: "2026-05-01 10:00",
			command: "mk:fix",
			tier: "STANDARD",
			estimated_tokens: 1234,
			task: "repair parser",
		});

		expect(row).toEqual({
			date: "2026-05-01 10:00",
			command: "mk:fix",
			tier: "STANDARD",
			tokens: 1234,
			task: "repair parser",
		});
	});

	it("derives tokens from schema-v2 session snapshots", () => {
		const row = toBudgetRow({
			date: "2026-05-01 11:00",
			session_id: "abc123",
			model: "gpt-5.5",
			tokens_in: 500,
			tokens_out: 1500,
			cache_write_tokens: 25,
			cache_read_tokens: 75,
		});

		expect(row).toEqual({
			date: "2026-05-01 11:00",
			command: "session",
			tier: "gpt-5.5",
			tokens: 2100,
			task: "session abc123",
		});
	});

	it("treats missing or invalid numeric fields as zero instead of NaN", () => {
		const row = toBudgetRow({
			date: "2026-05-01 12:00",
			model: "unknown",
			tokens_in: " ",
			tokens_out: "not-a-number",
			cache_write_tokens: undefined,
			cache_read_tokens: '',
		});

		expect(row.tokens).toBe(0);
		expect(Number.isNaN(row.tokens)).toBe(false);
		expect(row.task).toBe("session snapshot");
	});

	it("filters by session id using schema-v2 entries", () => {
		const filtered = filterBudgetEntries(
			[
				{ date: "2026-05-01 10:00", session_id: "sess-a", tokens_in: 10, tokens_out: 20 },
				{ date: "2026-05-01 11:00", session_id: "sess-b", tokens_in: 30, tokens_out: 40 },
				{ date: "2026-05-01 12:00", estimated_tokens: 99 },
			],
			{ sessionId: "sess-b" },
		);

		expect(filtered).toHaveLength(1);
		expect(filtered[0]).toMatchObject({ session_id: "sess-b" });
	});

	it("filters by day across legacy and schema-v2 entries", () => {
		const filtered = filterBudgetEntries(
			[
				{ date: "2026-05-01 10:00", estimated_tokens: 10 },
				{ date: "2026-05-02 11:00", session_id: "sess-b", tokens_in: 30, tokens_out: 40 },
				{ date: "2026-05-01 12:00", session_id: "sess-c", tokens_in: 50, tokens_out: 60 },
			],
			{ day: "2026-05-01" },
		);

		expect(filtered).toHaveLength(2);
		expect(filtered.map((entry) => entry.date)).toEqual(["2026-05-01 10:00", "2026-05-01 12:00"]);
	});

	it("supports combining session and day filters", () => {
		const filtered = filterBudgetEntries(
			[
				{ date: "2026-05-01 10:00", session_id: "sess-a", tokens_in: 10, tokens_out: 20 },
				{ date: "2026-05-01 11:00", session_id: "sess-b", tokens_in: 30, tokens_out: 40 },
				{ date: "2026-05-02 12:00", session_id: "sess-b", tokens_in: 50, tokens_out: 60 },
			],
			{ sessionId: "sess-b", day: "2026-05-01" },
		);

		expect(filtered).toHaveLength(1);
		expect(filtered[0]).toMatchObject({ date: "2026-05-01 11:00", session_id: "sess-b" });
	});
});
