/**
 * Note gutter layout: same-column notes stack with collision shift; different
 * target columns are independent; ordering is by target-Y then id.
 */

import { describe, expect, it } from "vitest";
import { layoutNotes, NOTE_WIDTH, type NoteInput } from "../canvas/annotation-layout.js";

describe("layoutNotes", () => {
	it("places a single note right of its target at target top", () => {
		const [p] = layoutNotes([{ id: "n1", targetX: 100, targetY: 200, targetWidth: 300, height: 50 }]);
		expect(p.x).toBe(100 + 300 + 24); // targetX + width + gutter offset
		expect(p.y).toBe(200);
		expect(p.width).toBe(NOTE_WIDTH);
	});

	it("shifts a same-column note down to avoid overlap", () => {
		const notes: NoteInput[] = [
			{ id: "a", targetX: 0, targetY: 100, targetWidth: 100, height: 80 },
			{ id: "b", targetX: 0, targetY: 120, targetWidth: 100, height: 40 }, // would overlap 'a'
		];
		const [a, b] = layoutNotes(notes);
		expect(b.y).toBeGreaterThanOrEqual(a.y + a.height); // no overlap
	});

	it("keeps different target columns independent", () => {
		const notes: NoteInput[] = [
			{ id: "a", targetX: 0, targetY: 100, targetWidth: 100, height: 80 },
			{ id: "b", targetX: 500, targetY: 100, targetWidth: 100, height: 80 },
		];
		const placed = layoutNotes(notes);
		expect(placed.find((p) => p.id === "a")!.x).not.toBe(placed.find((p) => p.id === "b")!.x);
		expect(placed.every((p) => p.y === 100)).toBe(true); // neither shifted
	});
});
