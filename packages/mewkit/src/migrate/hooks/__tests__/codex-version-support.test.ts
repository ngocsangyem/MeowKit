// Version-support helpers gate deny-capable hooks. Below CODEX_MIN_SUPPORTED_VERSION
// (0.142.0) the merger emits a hard WARN naming affected safety hooks.

import { describe, expect, it } from "vitest";
import { CODEX_MIN_SUPPORTED_VERSION, isCodexVersionSupported } from "../../providers/codex/capabilities.js";

describe("isCodexVersionSupported", () => {
	it("targets 0.142.0 as the minimum supported hook tier", () => {
		expect(CODEX_MIN_SUPPORTED_VERSION).toBe("0.142.0");
	});

	it("accepts versions at or above the minimum", () => {
		expect(isCodexVersionSupported("0.142.0")).toBe(true);
		expect(isCodexVersionSupported("0.143.1")).toBe(true);
		expect(isCodexVersionSupported("1.0.0")).toBe(true);
	});

	it("rejects the pre-stable-hooks fallback anchor and anything below the minimum", () => {
		expect(isCodexVersionSupported("0.124.0")).toBe(false);
		expect(isCodexVersionSupported("0.141.9")).toBe(false);
	});

	it("rejects unparseable version strings (fail-closed)", () => {
		expect(isCodexVersionSupported("not-a-version")).toBe(false);
		expect(isCodexVersionSupported("")).toBe(false);
	});
});
