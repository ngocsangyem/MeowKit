// Phase 5 slice 3: per-provider repo-context ACQUISITION descriptors. MeowKit names the
// host-native read/search tools; it never executes them. Authored providers expose a real
// surface; anything else is honestly report-only (null read/search) — no acquisition claimed.
import { describe, expect, it } from "vitest";
import { getAcquisitionDescriptor, ACQUISITION_DESCRIPTORS } from "../repo-context-adapter.js";

describe("getAcquisitionDescriptor", () => {
	it("claude-code / claude-plugin expose typed Read + Grep/Glob (supported)", () => {
		for (const p of ["claude-code", "claude-plugin"]) {
			const d = getAcquisitionDescriptor(p);
			expect(d.status).toBe("supported");
			expect(d.read?.tool).toBe("Read");
			expect(d.search?.tool).toBe("Grep+Glob");
		}
	});

	it("codex acquires via shell (cat/ripgrep) — present but partial (advisory)", () => {
		const d = getAcquisitionDescriptor("codex");
		expect(d.status).toBe("partial");
		expect(d.read?.tool).toMatch(/shell/);
		expect(d.search?.tool).toMatch(/shell/);
		expect(d.read?.note).toMatch(/advisory/i);
	});

	it("an unknown provider is report-only with NO read/search surface (claims nothing)", () => {
		const d = getAcquisitionDescriptor("some-future-runtime");
		expect(d.status).toBe("report-only");
		expect(d.read).toBeNull();
		expect(d.search).toBeNull();
		expect(d.provider).toBe("some-future-runtime");
	});

	it("every authored descriptor that claims a surface names BOTH read and search (no half-claim)", () => {
		for (const d of Object.values(ACQUISITION_DESCRIPTORS)) {
			expect(d.status).not.toBe("report-only"); // authored set is supported/partial only
			expect(d.read, d.provider).not.toBeNull();
			expect(d.search, d.provider).not.toBeNull();
		}
	});
});
