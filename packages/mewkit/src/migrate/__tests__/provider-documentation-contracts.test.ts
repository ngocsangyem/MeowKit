import { describe, expect, it } from "vitest";
import {
	getProviderCapabilityContract,
	getProviderSurfaceContract,
	providerCapabilityRegistry,
	providerDocumentationContracts,
} from "../provider-documentation-contracts.js";

describe("provider documentation contracts", () => {
	it("covers every supported provider", () => {
		expect(Object.keys(providerDocumentationContracts).sort()).toEqual(["claude-code", "codex", "cursor"]);
	});

	it("tracks last-verified metadata for every provider contract", () => {
		for (const contract of Object.values(providerCapabilityRegistry)) {
			expect(contract.lastVerified).toBe("2026-05-16");
			expect(contract.docs.length).toBeGreaterThan(0);
		}
	});

	it("defaults undocumented surfaces to unsupported", () => {
		expect(getProviderSurfaceContract("cursor", "command").status).toBe("unsupported");
		expect(getProviderSurfaceContract("cursor", "hooks").status).toBe("unsupported");
	});

	it("preserves documented surfaces for strongly documented runtimes", () => {
		// Codex agent/hooks migration surfaces are `partial`, not `documented` — Codex
		// itself documents subagents/hooks, but the toolkit's migrate converter no
		// longer auto-ports a project's own .claude/agents|hooks (toolkit agents/hooks
		// ship via the native authored bundle instead).
		expect(getProviderSurfaceContract("codex", "agent").status).toBe("partial");
		expect(getProviderSurfaceContract("codex", "hooks").status).toBe("partial");
		expect(getProviderSurfaceContract("claude-code", "command").status).toBe("documented");
		expect(getProviderSurfaceContract("claude-code", "skill").status).toBe("documented");
		expect(getProviderSurfaceContract("cursor", "rules").status).toBe("documented");
	});

	it("exposes capability-level documentation contracts beyond surface allowlists", () => {
		expect(getProviderCapabilityContract("codex", "commands").status).toBe("documented");
		expect(getProviderCapabilityContract("codex", "rules").status).toBe("documented");
		expect(getProviderCapabilityContract("cursor", "agents").status).toBe("partial");
	});
});
