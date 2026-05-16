import { describe, expect, it } from "vitest";
import {
	getProviderCapabilityContract,
	getProviderSurfaceContract,
	providerCapabilityRegistry,
	providerDocumentationContracts,
} from "../provider-documentation-contracts.js";

describe("provider documentation contracts", () => {
	it("covers every supported provider", () => {
		expect(Object.keys(providerDocumentationContracts).sort()).toEqual([
			"amp",
			"antigravity",
			"claude-code",
			"cline",
			"codex",
			"cursor",
			"droid",
			"gemini-cli",
			"github-copilot",
			"goose",
			"kilo",
			"kiro",
			"opencode",
			"openhands",
			"roo",
			"windsurf",
		]);
	});

	it("tracks last-verified metadata for every provider contract", () => {
		for (const contract of Object.values(providerCapabilityRegistry)) {
			expect(contract.lastVerified).toBe("2026-05-16");
			expect(contract.docs.length).toBeGreaterThan(0);
		}
	});

	it("defaults undocumented surfaces to unsupported", () => {
		expect(getProviderSurfaceContract("codex", "command").status).toBe("unsupported");
		expect(getProviderSurfaceContract("openhands", "config").status).toBe("unsupported");
	});

	it("preserves documented surfaces for strongly documented runtimes", () => {
		expect(getProviderSurfaceContract("codex", "agent").status).toBe("documented");
		expect(getProviderSurfaceContract("codex", "hooks").status).toBe("documented");
		expect(getProviderSurfaceContract("gemini-cli", "command").status).toBe("documented");
		expect(getProviderSurfaceContract("kiro", "skill").status).toBe("documented");
		expect(getProviderSurfaceContract("windsurf", "rules").status).toBe("documented");
	});

	it("exposes capability-level documentation contracts beyond surface allowlists", () => {
		expect(getProviderCapabilityContract("codex", "commands").status).toBe("partial");
		expect(getProviderCapabilityContract("codex", "rules").status).toBe("documented");
		expect(getProviderCapabilityContract("kilo", "workspace_config").status).toBe("partial");
	});
});
