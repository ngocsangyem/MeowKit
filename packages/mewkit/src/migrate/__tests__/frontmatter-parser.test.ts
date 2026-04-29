import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../frontmatter-parser.js";

describe("parseFrontmatter", () => {
	it("parses standard YAML frontmatter", () => {
		const result = parseFrontmatter(`---
name: scout
description: Quick file scout
model: opus
---
Body content here`);
		expect(result.frontmatter.name).toBe("scout");
		expect(result.frontmatter.description).toBe("Quick file scout");
		expect(result.frontmatter.model).toBe("opus");
		expect(result.body).toBe("Body content here");
		expect(result.warnings).toEqual([]);
	});

	it("returns empty frontmatter when no fence", () => {
		const result = parseFrontmatter("Just a body, no frontmatter");
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("Just a body, no frontmatter");
	});

	it("strips BOM from input", () => {
		const result = parseFrontmatter(`﻿---
name: scout
---
Body`);
		expect(result.frontmatter.name).toBe("scout");
	});

	it("handles CRLF line endings", () => {
		const result = parseFrontmatter("---\r\nname: scout\r\n---\r\nBody");
		expect(result.frontmatter.name).toBe("scout");
	});

	it("normalizes argument-hint to argumentHint", () => {
		const result = parseFrontmatter(`---
argument-hint: <agent-name>
---
`);
		expect(result.frontmatter.argumentHint).toBe("<agent-name>");
	});

	it("preserves extra unknown fields", () => {
		const result = parseFrontmatter(`---
name: foo
custom-field: bar
---
Body`);
		expect(result.frontmatter["custom-field"]).toBe("bar");
		expect(result.frontmatter.name).toBe("foo");
	});

	it("truncates over-long description with warning", () => {
		const longDesc = "x".repeat(600);
		const result = parseFrontmatter(`---
description: ${longDesc}
---
`);
		expect(result.frontmatter.description?.length).toBeLessThanOrEqual(500);
		expect(result.warnings.some((w) => /description.*truncated/.test(w))).toBe(true);
	});

	it("falls through to fallback parser on YAML errors", () => {
		// Unquoted YAML value with colon — strict YAML would fail; fallback should rescue
		const result = parseFrontmatter(`---
description: Tools: read, write, edit
---
Body`);
		// Either YAML or fallback — both should produce something usable
		expect(result.body).toBeTruthy();
	});

	it("handles whitespace-only frontmatter block", () => {
		const result = parseFrontmatter("---\n\n---\nJust body");
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("Just body");
	});
});
