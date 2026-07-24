// Version-support helpers gate deny-capable hooks. Below CODEX_MIN_SUPPORTED_VERSION
// (0.142.0) the merger emits a hard WARN naming affected safety hooks.

import { describe, expect, it } from "vitest";
import {
	CODEX_MIN_SUPPORTED_VERSION,
	detectCodexVersion,
	isCodexVersionSupported,
} from "../../providers/codex/capabilities.js";

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

// Warn-and-degrade policy (migrate codex + init --target codex): a below-minimum Codex WARNS
// and installs anyway (the bundle is inert config; gated surfaces degrade at runtime). The
// warn is only emitted when a version is actually DETECTED — an undetectable version never nags.
describe("warn-and-degrade version detection", () => {
	it("returns null under a compat override so callers do not warn on an undetectable version", async () => {
		const prev = process.env.MEWKIT_CODEX_COMPAT;
		process.env.MEWKIT_CODEX_COMPAT = "strict";
		try {
			expect(await detectCodexVersion()).toBeNull();
		} finally {
			if (prev === undefined) delete process.env.MEWKIT_CODEX_COMPAT;
			else process.env.MEWKIT_CODEX_COMPAT = prev;
		}
	});
});
