/**
 * Unit tests for apply-todo-toggle.ts — applyTodoToggle pure function.
 *
 * Coverage (8+ cases per spec):
 *   1. Flip unchecked → checked (basic forward flip)
 *   2. Flip checked → unchecked (basic reverse flip)
 *   3. Idempotent no-op: marker already matches desired → {changed: false}
 *   4. Out-of-range index → {error: "out-of-range"}
 *   5. Missing ## Todo List section → {error: "section-missing"}
 *   6. Code-fence skip: [ ] inside ``` block is NOT counted
 *   7. CRLF round-trip: CRLF preserved after flip
 *   8. Exotic markers: ~ and ✓ treated as checked; flipping to unchecked works
 */

import { describe, expect, it } from "vitest";
import { applyTodoToggle } from "../apply-todo-toggle.js";

// ── Helper ──────────────────────────────────────────────────────────────────
function makeContent(todos: string[], crlf = false): string {
	const eol = crlf ? "\r\n" : "\n";
	const lines = [
		"# Phase 1",
		"",
		"## Overview",
		"Some text here.",
		"",
		"## Todo List",
		...todos,
		"",
		"## Next Steps",
		"Nothing yet.",
		"",
	];
	return lines.join(eol);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("applyTodoToggle", () => {
	it("1. flips unchecked to checked (forward flip)", () => {
		const content = makeContent(["- [ ] Task A", "- [ ] Task B"]);
		const result = applyTodoToggle(content, 0, true);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(true);
		expect(result.content).toContain("- [x] Task A");
		expect(result.content).toContain("- [ ] Task B");
	});

	it("2. flips checked to unchecked (reverse flip)", () => {
		const content = makeContent(["- [x] Task A", "- [ ] Task B"]);
		const result = applyTodoToggle(content, 0, false);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(true);
		expect(result.content).toContain("- [ ] Task A");
		expect(result.content).toContain("- [ ] Task B");
	});

	it("3a. idempotent: already-checked → check = no-op (changed: false)", () => {
		const content = makeContent(["- [x] Task A"]);
		const result = applyTodoToggle(content, 0, true);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(false);
		// content should be unchanged reference
		expect(result.content).toBe(content);
	});

	it("3b. idempotent: already-unchecked → uncheck = no-op (changed: false)", () => {
		const content = makeContent(["- [ ] Task A"]);
		const result = applyTodoToggle(content, 0, false);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(false);
		expect(result.content).toBe(content);
	});

	it("4. out-of-range index returns error tag", () => {
		const content = makeContent(["- [ ] Task A"]);
		const result = applyTodoToggle(content, 5, true);
		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toBe("out-of-range");
	});

	it("5. missing ## Todo List section returns error tag", () => {
		const content = "# Phase 1\n\n## Overview\nNo todo section here.\n";
		const result = applyTodoToggle(content, 0, true);
		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toBe("section-missing");
	});

	it("6. code-fence skip: [ ] inside ``` block is NOT counted", () => {
		// The fenced [ ] should be ignored; only the real todo is index 0
		const content = makeContent([
			"```",
			"- [ ] This is inside a fence and should NOT count",
			"```",
			"- [ ] Real todo",
		]);
		const result = applyTodoToggle(content, 0, true);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(true);
		// The real todo at index 0 gets flipped
		expect(result.content).toContain("- [x] Real todo");
		// Fenced line is unchanged
		expect(result.content).toContain("- [ ] This is inside a fence and should NOT count");
	});

	it("7. CRLF round-trip: CRLF preserved after flip", () => {
		const content = makeContent(["- [ ] Task A", "- [x] Task B"], true /* crlf */);
		expect(content).toContain("\r\n");
		const result = applyTodoToggle(content, 0, true);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(true);
		// Output must still use CRLF
		expect(result.content).toContain("\r\n");
		expect(result.content).toContain("- [x] Task A");
		// No bare \n that isn't part of \r\n
		const crlfCount = (result.content.match(/\r\n/g) ?? []).length;
		const lfOnlyCount = (result.content.match(/(?<!\r)\n/g) ?? []).length;
		expect(crlfCount).toBeGreaterThan(0);
		expect(lfOnlyCount).toBe(0);
	});

	it("8a. exotic marker ~ treated as checked; flipping to unchecked works", () => {
		const content = makeContent(["- [~] Task A"]);
		const result = applyTodoToggle(content, 0, false);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(true);
		expect(result.content).toContain("- [ ] Task A");
	});

	it("8b. exotic marker ✓ treated as checked; flipping to unchecked works", () => {
		const content = makeContent(["- [✓] Task A"]);
		const result = applyTodoToggle(content, 0, false);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(true);
		expect(result.content).toContain("- [ ] Task A");
	});

	it("flips the second todo (idx=1) independently", () => {
		const content = makeContent(["- [ ] Task A", "- [ ] Task B", "- [x] Task C"]);
		const result = applyTodoToggle(content, 1, true);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(true);
		expect(result.content).toContain("- [ ] Task A");
		expect(result.content).toContain("- [x] Task B");
		expect(result.content).toContain("- [x] Task C");
	});

	it("preserves trailing newline on LF content", () => {
		const content = "# Phase\n\n## Todo List\n\n- [ ] Task\n";
		const result = applyTodoToggle(content, 0, true);
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.changed).toBe(true);
		expect(result.content.endsWith("\n")).toBe(true);
	});
});
