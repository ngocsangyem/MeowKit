// Header substitution tests for buildMergedAgentsMd.
// Generated files must be brand-free: no "MeowKit" prose and no provenance
// attribution line — only the neutral title and target name remain.
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

	it("does not emit any toolkit identifier in the header", () => {
		const out = buildMergedAgentsMd(sections, "Codex");
		expect(out).not.toMatch(/mewkit|meowkit/i);
	});

	it("does not inject a provenance attribution line", () => {
		const out = buildMergedAgentsMd(sections, "Codex");
		expect(out).not.toContain("Ported from");
	});

	it("preserves the section join order", () => {
		const out = buildMergedAgentsMd(sections, "Codex");
		const firstIdx = out.indexOf("Agent: scout");
		const secondIdx = out.indexOf("Agent: planner");
		expect(firstIdx).toBeGreaterThan(-1);
		expect(secondIdx).toBeGreaterThan(firstIdx);
	});
});
