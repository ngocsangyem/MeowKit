// Generated target files must contain zero toolkit branding — no persistent
// context pollution in the user's project. Codex agents/commands/hooks
// conversion is nulled (toolkit agents/commands/hooks ship via the native
// authored bundle instead, kept brand-clean by manual review — see the e2e
// suite's "leaves zero toolkit branding" coverage); this file now covers the
// remaining converter-path surfaces: md-strip and the merged AGENTS.md header.

import { describe, expect, it } from "vitest";
import { buildMergedAgentsMd } from "../converters/fm-strip.js";
import { stripClaudeRefs } from "../converters/md-strip.js";

const BRAND = /MeowKit|mewkit|meowkit/;

const brandHeavyBody = [
	"MeowKit ships this workflow. Run `npx mewkit migrate` to port it.",
	"Also try mewkit doctor and meowkit upgrade when things break.",
].join("\n");

describe("codex output is brand-free", () => {
	it("md-strip removes brand prose and CLI identifiers", () => {
		const result = stripClaudeRefs(brandHeavyBody, { provider: "codex", targetName: "Codex" });
		expect(result.content).not.toMatch(BRAND);
	});

	it("merged AGENTS.md header emits no brand strings", () => {
		expect(buildMergedAgentsMd(["## Agent: x\n\nbody"], "Codex")).not.toMatch(BRAND);
	});
});
