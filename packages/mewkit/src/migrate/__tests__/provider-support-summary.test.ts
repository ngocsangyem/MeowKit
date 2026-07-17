import { describe, expect, it } from "vitest";
import { collectProviderSupportMatrix, findProviderSupportInfo } from "../provider-support-summary.js";
import { providerSummary } from "../../core/provider-adapter.js";
import { isProjectedProvider } from "../../core/provider-projection.js";

describe("provider support summary", () => {
	it("summarizes the effective provider registry after contract filtering", () => {
		const matrix = collectProviderSupportMatrix();

		expect(matrix.counts).toEqual({
			total: 16,
			verified: 8,
			experimental: 7,
			deprecated: 1,
			enabledSurfaces: 40,
		});
	});

	it("classifies Codex as a hard-gate CANDIDATE, not a full harness (migrates every surface but cannot prove a gate)", () => {
		const codex = findProviderSupportInfo("codex");

		expect(codex?.supportLevel).toBe("experimental");
		expect(codex?.role).toBe("hard-gate-candidate"); // NOT full-harness — no proven enforcement
		expect(codex?.capabilityStatus).toBe("partial"); // adapter truth, mirrored into the summary
		expect(codex?.effectiveSurfaces).toEqual(["agents", "commands", "skills", "config", "rules", "hooks"]);
		expect(codex?.enforcement).toEqual({
			gate1: "advisory",
			gate2: "advisory",
			secretProtection: "advisory",
		});
	});

	it("classifies Claude Code as a full harness with enforced gates (proven PreToolUse deny)", () => {
		const cc = findProviderSupportInfo("claude-code");
		expect(cc?.role).toBe("full-harness");
		expect(cc?.capabilityStatus).toBe("supported");
		expect(cc?.enforcement).toEqual({ gate1: "enforced", gate2: "enforced", secretProtection: "enforced" });
	});

	it("classifies policy-only providers as advisory instead of hard-gate capable", () => {
		const cursor = findProviderSupportInfo("cursor");
		const antigravity = findProviderSupportInfo("antigravity");

		expect(cursor?.role).toBe("policy-advisory");
		expect(cursor?.effectiveSurfaces).toEqual(["config", "rules"]);
		expect(cursor?.enforcement.gate1).toBe("advisory");
		expect(antigravity?.role).toBe("policy-advisory");
		expect(antigravity?.effectiveSurfaces).toEqual(["rules"]);
		expect(antigravity?.enforcement.secretProtection).toBe("advisory");
	});

	it("does not market disabled or deprecated providers as practical support", () => {
		expect(findProviderSupportInfo("kilo")?.role).toBe("disabled");
		expect(findProviderSupportInfo("openhands")?.role).toBe("disabled");
		expect(findProviderSupportInfo("roo")?.role).toBe("deprecated");
	});
});

describe("provider truth unification — summary derives from the adapter (single source)", () => {
	it("every adapter-projected provider's summary enforcement/status EQUALS the adapter (no re-declared constant)", () => {
		const matrix = collectProviderSupportMatrix();
		for (const info of matrix.providers) {
			if (!isProjectedProvider(info.id)) continue;
			const truth = providerSummary(info.id);
			// If a future edit re-hardcodes enforcement in the summary (e.g. back to "candidate"),
			// this diverges from the adapter and fails — the two models can no longer disagree.
			expect(info.enforcement, `${info.id} enforcement must match adapter`).toEqual(truth.enforcement);
			expect(info.capabilityStatus, `${info.id} capabilityStatus must match adapter`).toBe(truth.supportState);
		}
	});

	it("no provider is 'full-harness' unless the adapter proves a gate (honesty invariant)", () => {
		const matrix = collectProviderSupportMatrix();
		for (const info of matrix.providers) {
			if (info.role !== "full-harness") continue;
			expect(isProjectedProvider(info.id), `${info.id} full-harness requires an adapter projection`).toBe(true);
			expect(providerSummary(info.id).gatesProven, `${info.id} full-harness requires a proven gate`).toBe(true);
		}
	});
});
