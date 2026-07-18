import { describe, expect, it } from "vitest";
import { mergeCodexCapabilityBootstrap } from "../capability-bootstrap-projection.js";
import { renderBootstrap, BOOTSTRAP_START, BOOTSTRAP_END } from "../../core/bootstrap.js";
import { isProjectedProvider } from "../../core/provider-projection.js";

// Phase 6: the same semantic activation policy reaches Codex via the managed block, one
// renderer feeds both Claude and Codex, user content outside the markers is byte-preserved,
// and projection never inflates a provider's support claim.

describe("Codex bootstrap projection — shared semantic policy", () => {
	it("uses ONE renderer for Claude and Codex; both carry the composed-recall policy", () => {
		expect(renderBootstrap("codex")).toBe(renderBootstrap("claude-code"));
		expect(renderBootstrap("codex")).toContain("knowledgeRecall");
	});

	it("preserves user content before AND after the managed block byte-for-byte", () => {
		const before = "# AGENTS.md\n\nMy house rules: always run the linter.\n";
		const after = "\n## My Notes\n\nDeploy on Fridays. Never touch prod at 5pm.\n";
		const managed = `${BOOTSTRAP_START}\n${renderBootstrap("codex")}\n${BOOTSTRAP_END}`;
		const original = `${before}\n${managed}\n${after}`;
		const merged = mergeCodexCapabilityBootstrap(original);
		expect(merged).toContain("My house rules: always run the linter.");
		expect(merged).toContain("Deploy on Fridays. Never touch prod at 5pm.");
		expect(merged.match(/GENERATED:capability-bootstrap START/g)).toHaveLength(1);
	});

	it("is idempotent — a second merge over its own output is a zero diff", () => {
		const input = "# AGENTS.md\n\nProject-specific note kept verbatim.\n";
		const once = mergeCodexCapabilityBootstrap(input);
		const twice = mergeCodexCapabilityBootstrap(once);
		expect(twice).toBe(once);
		expect(twice).toContain("Project-specific note kept verbatim.");
	});

	it("does not inflate support claims for a report-only provider (no bootstrap projected)", () => {
		expect(isProjectedProvider("some-future-runtime")).toBe(false);
	});
});
