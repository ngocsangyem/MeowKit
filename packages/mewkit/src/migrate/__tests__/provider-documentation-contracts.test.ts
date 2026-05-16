import { describe, expect, it } from "vitest";
import { getProviderSurfaceContract, providerDocumentationContracts } from "../provider-documentation-contracts.js";

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

	it("defaults undocumented surfaces to unsupported", () => {
		expect(getProviderSurfaceContract("codex", "agent").status).toBe("unsupported");
		expect(getProviderSurfaceContract("openhands", "config").status).toBe("unsupported");
	});

	it("preserves documented surfaces for strongly documented runtimes", () => {
		expect(getProviderSurfaceContract("gemini-cli", "command").status).toBe("documented");
		expect(getProviderSurfaceContract("kiro", "skill").status).toBe("documented");
		expect(getProviderSurfaceContract("windsurf", "rules").status).toBe("documented");
	});
});
