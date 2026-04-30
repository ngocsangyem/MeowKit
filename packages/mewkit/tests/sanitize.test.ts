/**
 * Sanitize tests: ANSI strip, secret scrub, SSE-frame-injection defense.
 */

import { describe, expect, it } from "vitest";
import { sanitizeEvent } from "../src/orchviz/sanitize.js";
import { scrubSecrets } from "../src/orchviz/redact.js";
import { stripAnsi } from "../src/orchviz/parser/strip-ansi.js";

describe("scrubSecrets (strict-prefix only)", () => {
	it("redacts sk- API keys", () => {
		expect(scrubSecrets("sk-abcdef1234567890ABCDEFG_-")).toContain("REDACTED");
	});
	it("redacts ghp_ tokens", () => {
		const token = "ghp_" + "A".repeat(36);
		expect(scrubSecrets(`x ${token} y`)).toContain("REDACTED");
	});
	it("redacts AKIA AWS keys", () => {
		expect(scrubSecrets("AKIAIOSFODNN7EXAMPLE")).toContain("REDACTED");
	});
	it("redacts PEM blocks", () => {
		const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----";
		expect(scrubSecrets(pem)).toContain("REDACTED");
	});
	it("does NOT redact lexical 'password=' (false-positive avoidance)", () => {
		expect(scrubSecrets("user said password=hunter2")).toBe("user said password=hunter2");
	});
});

describe("stripAnsi", () => {
	it("removes CSI color sequences", () => {
		expect(stripAnsi("\x1b[31mred\x1b[0m text")).toBe("red text");
	});
	it("preserves plain text unchanged", () => {
		expect(stripAnsi("plain")).toBe("plain");
	});
});

describe("sanitizeEvent (combined)", () => {
	it("strips ANSI + scrubs secrets + collapses newlines", () => {
		const out = sanitizeEvent({
			time: 1,
			type: "message",
			payload: {
				agent: "orchestrator",
				content: "\x1b[31mred\x1b[0m line1\nline2\nsk-abcdef1234567890ABCD",
			},
		});
		const c = out.payload.content as string;
		expect(c).not.toContain("\x1b");
		expect(c).not.toContain("\n");
		expect(c).toContain("REDACTED");
	});
	it("preserves non-string fields", () => {
		const out = sanitizeEvent({
			time: 42,
			type: "tool_call_end",
			payload: { tokenCost: 100, isError: false, agent: "x" },
		});
		expect(out.payload.tokenCost).toBe(100);
		expect(out.payload.isError).toBe(false);
		expect(out.time).toBe(42);
	});
});
