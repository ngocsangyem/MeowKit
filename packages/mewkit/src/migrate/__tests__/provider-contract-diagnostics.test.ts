import { describe, expect, it } from "vitest";
import { collectProviderContractDiagnostics, summarizeProviderContractDiagnostics } from "../provider-contract-diagnostics.js";

describe("provider contract diagnostics", () => {
	it("separates provider support level from surface contract status", () => {
		const diagnostics = collectProviderContractDiagnostics();

		expect(diagnostics.length).toBeGreaterThan(0);
		expect(diagnostics.every((diagnostic) => ["verified", "experimental", "deprecated"].includes(diagnostic.providerSupportLevel))).toBe(
			true,
		);
		expect(diagnostics.every((diagnostic) => ["documented", "partial", "unsupported"].includes(diagnostic.surfaceStatus))).toBe(
			true,
		);
	});

	it("summarizes only warnings and failures for selected providers", () => {
		const messages = summarizeProviderContractDiagnostics(collectProviderContractDiagnostics(), ["codex"]);

		expect(messages.every((message) => message.startsWith("Codex:"))).toBe(true);
	});
});
