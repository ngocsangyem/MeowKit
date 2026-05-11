// Header substitution tests for buildMergedAgentsMd.
// Verifies the merged-agents header no longer leaks "MeowKit" brand prose while
// keeping the `mewkit migrate` CLI identifier verbatim and the target name correct.
import { describe, expect, it } from "vitest";
import { buildMergedAgentsMd } from "../converters/fm-strip.js";

describe("buildMergedAgentsMd — header brand neutralization", () => {
	const sections = ["## Agent: scout\n\nbody one", "## Agent: planner\n\nbody two"];

	it("contains the correct Target line for Codex", () => {
		const out = buildMergedAgentsMd(sections, "Codex");
		expect(out).toContain("> Target: Codex");
	});

	it("contains the correct Target line for Kiro IDE", () => {
		const out = buildMergedAgentsMd(sections, "Kiro IDE");
		expect(out).toContain("> Target: Kiro IDE");
	});

	it("contains the correct Target line for Cursor", () => {
		const out = buildMergedAgentsMd(sections, "Cursor");
		expect(out).toContain("> Target: Cursor");
	});

	it("does not emit the 'MeowKit' brand prose in the header", () => {
		const out = buildMergedAgentsMd(sections, "Codex");
		expect(out).not.toContain("MeowKit");
	});

	it("keeps the 'mewkit migrate' CLI identifier verbatim in the header", () => {
		const out = buildMergedAgentsMd(sections, "Codex");
		expect(out).toContain("mewkit migrate");
	});

	it("includes the neutralized attribution phrase", () => {
		const out = buildMergedAgentsMd(sections, "Codex");
		expect(out).toContain("> Ported from the toolkit via mewkit migrate");
	});

	it("preserves the section join order", () => {
		const out = buildMergedAgentsMd(sections, "Codex");
		const firstIdx = out.indexOf("Agent: scout");
		const secondIdx = out.indexOf("Agent: planner");
		expect(firstIdx).toBeGreaterThan(-1);
		expect(secondIdx).toBeGreaterThan(firstIdx);
	});
});
