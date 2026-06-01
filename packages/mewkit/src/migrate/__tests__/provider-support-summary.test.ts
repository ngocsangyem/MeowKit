import { describe, expect, it } from "vitest";
import { collectProviderSupportMatrix, findProviderSupportInfo } from "../provider-support-summary.js";

describe("provider support summary", () => {
	it("summarizes the effective provider registry after contract filtering", () => {
		const matrix = collectProviderSupportMatrix();

		expect(matrix.counts).toEqual({
			total: 16,
			verified: 8,
			experimental: 7,
			deprecated: 1,
			enabledSurfaces: 39,
		});
	});

	it("classifies Codex as the non-Claude hard-gate candidate", () => {
		const codex = findProviderSupportInfo("codex");

		expect(codex?.supportLevel).toBe("experimental");
		expect(codex?.role).toBe("hard-gate-candidate");
		expect(codex?.effectiveSurfaces).toEqual(["agents", "skills", "config", "rules", "hooks"]);
		expect(codex?.enforcement).toEqual({
			gate1: "candidate",
			gate2: "candidate",
			secretProtection: "candidate",
		});
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
