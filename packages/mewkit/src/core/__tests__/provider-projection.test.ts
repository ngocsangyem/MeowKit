// Phase 3 slice 3: provider projections + the four independent support levels. The core
// honesty invariant: `enforceable` is only "supported" where a real gating hook exists —
// never for prompt-only surfaces (Codex) — and unknown providers are report-only.
import { describe, expect, it } from "vitest";
import {
	PROVIDER_PROJECTIONS,
	getProjection,
	isProjectedProvider,
	type LevelSupport,
} from "../provider-projection.js";

describe("provider projections", () => {
	it("claude-code + claude-plugin support all four levels (real hooks enforce)", () => {
		for (const id of ["claude-code", "claude-plugin"]) {
			const p = PROVIDER_PROJECTIONS[id];
			expect(p.status).toBe("supported");
			expect(p.levels.enforceable).toBe("supported");
			expect(p.levels.invocable).toBe("supported");
		}
	});

	it("codex is partial and NEVER claims enforceable (prompt-only, no gating hook)", () => {
		const codex = PROVIDER_PROJECTIONS.codex;
		expect(codex.status).toBe("partial");
		expect(codex.bootstrapPlacement).toBe("instruction-file");
		expect(codex.levels.discoverable).toBe("supported");
		expect(codex.levels.selectable).toBe("supported");
		expect(codex.levels.invocable).toBe("advisory"); // model-driven, not host-guaranteed
		expect(codex.levels.enforceable).toBe("unsupported"); // the honesty invariant
	});

	it("no projection claims enforceable=supported without invocable=supported (levels stay coherent)", () => {
		for (const p of Object.values(PROVIDER_PROJECTIONS)) {
			if (p.levels.enforceable === "supported") {
				expect(p.levels.invocable).toBe("supported");
			}
		}
	});

	it("an unknown provider is report-only with every level unknown", () => {
		const p = getProjection("gemini");
		expect(p.status).toBe("report-only");
		expect(p.bootstrapPlacement).toBe("none");
		const levels = Object.values(p.levels) as LevelSupport[];
		expect(levels.every((l) => l === "unknown")).toBe(true);
		expect(isProjectedProvider("gemini")).toBe(false);
	});

	it("isProjectedProvider recognizes exactly the authored providers", () => {
		expect(isProjectedProvider("claude-code")).toBe(true);
		expect(isProjectedProvider("claude-plugin")).toBe(true);
		expect(isProjectedProvider("codex")).toBe(true);
		expect(isProjectedProvider("nope")).toBe(false);
	});
});
