// Boundary tests for the hook context renderer: the header is always present, control characters
// and raw multiline payloads never escape into output, every field and the total block stay within
// budget, and a plan path outside the project root is never rendered.
import { describe, expect, it } from "vitest";
import {
	renderOrientContext,
	sanitizeField,
	ORIENT_RENDER_LIMITS,
	ORIENT_UNTRUSTED_HEADER,
} from "../orient-context-renderer.js";
import { buildOrientEnvelope } from "../orient-envelope.js";
import { fixtures, INJECTION_FIELD } from "./fixtures/recovery-states.js";

describe("sanitizeField", () => {
	it("strips control characters and collapses newlines/tabs to single spaces", () => {
		const out = sanitizeField(INJECTION_FIELD);
		// eslint-disable-next-line no-control-regex
		expect(out).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
		expect(out).not.toContain("\n");
		expect(out).not.toContain("\t");
	});

	it("truncates to maxFieldChars with an ellipsis", () => {
		const out = sanitizeField("A".repeat(1000));
		expect(out.length).toBe(ORIENT_RENDER_LIMITS.maxFieldChars);
		expect(out.endsWith("…")).toBe(true);
	});
});

describe("renderOrientContext", () => {
	it("always begins with the untrusted-state header", () => {
		const e = buildOrientEnvelope(fixtures.activePlanned.state, fixtures.activePlanned.pointer);
		expect(renderOrientContext(e).startsWith(ORIENT_UNTRUSTED_HEADER)).toBe(true);
	});

	it("renders injection-shaped fields with no control chars and no raw multiline escape", () => {
		const e = buildOrientEnvelope(fixtures.injectionField.state, fixtures.injectionField.pointer);
		const out = renderOrientContext(e);
		// One line per field: the only newlines are the block's own line separators, never inside a value.
		for (const line of out.split("\n")) {
			// eslint-disable-next-line no-control-regex
			expect(line).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
		}
		expect(out.length).toBeLessThanOrEqual(ORIENT_RENDER_LIMITS.maxTotalChars);
	});

	it("never exceeds the declared total budget (chars and coarse tokens)", () => {
		const e = buildOrientEnvelope(fixtures.injectionField.state, fixtures.injectionField.pointer);
		const out = renderOrientContext(e);
		expect(out.length).toBeLessThanOrEqual(ORIENT_RENDER_LIMITS.maxTotalChars);
		expect(Math.ceil(out.length / 4)).toBeLessThanOrEqual(ORIENT_RENDER_LIMITS.maxTotalTokens);
	});

	it("omits a plan path that escapes the project root", () => {
		const e = buildOrientEnvelope(fixtures.activePlanned.state, fixtures.activePlanned.pointer);
		// Force an out-of-project absolute plan path and confirm containment guard fires.
		if (e.activeTask) e.activeTask.planPath = "/etc/passwd";
		const out = renderOrientContext(e, { projectRoot: "/work/project" });
		expect(out).toContain("path outside project");
		expect(out).not.toContain("/etc/passwd");
	});

	it("surfaces the ambiguous candidate list", () => {
		const e = buildOrientEnvelope(fixtures.multiActive.state, fixtures.multiActive.pointer);
		const out = renderOrientContext(e);
		expect(out).toContain("orientation: ambiguous");
		expect(out).toContain("task-a");
		expect(out).toContain("task-b");
	});
});
