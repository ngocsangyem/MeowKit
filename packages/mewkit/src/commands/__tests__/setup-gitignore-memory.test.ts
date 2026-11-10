// A stale `.meowkit/memory/` ignore line must be stripped BEFORE the "entries already
// present" skip.
//
// In v2 the whole memory directory was gitignored. In v3 the store is committed and reviewed
// in the PR diff — that review IS the replacement for the deleted approve gate. A project set
// up by the previous version has BOTH the old memory line and the new `.meowkit/telemetry/`
// line, so the probe returned `skip` and the stale line survived: the committed-store premise
// then silently did not hold on exactly the installs with history worth reviewing.
import { describe, expect, it } from "vitest";
import { stripStaleMemoryIgnore } from "../setup-steps.js";

describe("stripStaleMemoryIgnore", () => {
	it("removes the v2 memory ignore line", () => {
		const result = stripStaleMemoryIgnore("# MeowKit\n.meowkit/memory/\n.meowkit/telemetry/\n");
		expect(result.stripped).toBe(true);
		expect(result.content).not.toContain(".meowkit/memory/");
		expect(result.content).toContain(".meowkit/telemetry/");
	});

	it("removes the glob and bare-path spellings too", () => {
		for (const line of [".meowkit/memory", ".meowkit/memory/**", "/.meowkit/memory/", "  .meowkit/memory/  "]) {
			expect(stripStaleMemoryIgnore(`a\n${line}\nb\n`).stripped, line).toBe(true);
		}
	});

	it("leaves an explicit user negation alone", () => {
		// `!` is a deliberate re-include; rewriting it would reverse a user's decision.
		const content = "a\n!.meowkit/memory/\nb\n";
		expect(stripStaleMemoryIgnore(content)).toEqual({ content, stripped: false });
	});

	it("leaves an unrelated memory path alone", () => {
		const content = "a\nsrc/memory/\n.meowkit/memory/cache/\nb\n";
		expect(stripStaleMemoryIgnore(content).stripped).toBe(false);
	});

	it("reports no change for a clean gitignore", () => {
		const content = "# MeowKit\n.meowkit/telemetry/\n.meowkit/state/\n";
		expect(stripStaleMemoryIgnore(content)).toEqual({ content, stripped: false });
	});
});
