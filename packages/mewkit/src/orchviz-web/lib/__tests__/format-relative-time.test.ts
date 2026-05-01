/**
 * Unit tests for formatRelativeTime utility.
 *
 * Pure function; no DOM needed.
 */

import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "../format-relative-time.js";

describe("formatRelativeTime", () => {
	const now = 1_000_000_000; // fixed epoch ms

	it('returns "just now" for deltas under 60s', () => {
		expect(formatRelativeTime(now - 5_000, now)).toBe("just now");
		expect(formatRelativeTime(now - 59_000, now)).toBe("just now");
		// future timestamps also treated as "just now" (diff < 60s)
		expect(formatRelativeTime(now + 5_000, now)).toBe("just now");
	});

	it("returns minutes for 1m–59m deltas", () => {
		const result = formatRelativeTime(now - 3 * 60_000, now);
		expect(result).toMatch(/3 minutes? ago/);
	});

	it("returns hours for 1h–23h deltas", () => {
		const result = formatRelativeTime(now - 2 * 60 * 60_000, now);
		expect(result).toMatch(/2 hours? ago/);
	});

	it("returns days for 24h+ deltas", () => {
		const result = formatRelativeTime(now - 5 * 24 * 60 * 60_000, now);
		expect(result).toMatch(/5 days? ago/);
	});

	it("uses Date.now() when now is omitted", () => {
		// Just verify it doesn't throw
		const result = formatRelativeTime(Date.now() - 90_000);
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});
