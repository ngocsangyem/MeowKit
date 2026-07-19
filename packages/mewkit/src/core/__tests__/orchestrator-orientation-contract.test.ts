// Contract test for the orchestrator's orientation-consumer section (.claude/agents/
// orchestrator.md). The orchestrator is a prompt, so the enforceable contract is textual: it MUST
// give deterministic routing for all five orientation outcomes and MUST stay a consumer — never
// prescribing that the agent invoke the CLI, read task records, or write durable state. This guards
// the contract against drift.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Resolve relative to THIS test file (cwd-independent) — the suite's canonical run is from the repo
// root, where a process.cwd()-relative `../../.claude` would point outside the repo.
const ORCH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"..",
	"..",
	".claude",
	"agents",
	"orchestrator.md",
);
const text = readFileSync(ORCH, "utf-8");
const lower = text.toLowerCase();

describe("orchestrator orientation-consumer contract", () => {
	it("has an injected-orientation consumer step", () => {
		expect(lower).toContain("consume injected orientation");
	});

	it("routes every one of the five orientation outcomes", () => {
		for (const outcome of ["active", "blocked", "stale", "ambiguous", "none", "corrupt-only"]) {
			expect(lower, `missing routing for "${outcome}"`).toContain(outcome);
		}
	});

	it("is a CONSUMER — it does NOT prescribe invoking the CLI, reading records, or writing state", () => {
		// The section must explicitly forbid the agent from owning orientation.
		expect(lower).toContain("do not invoke `mewkit`");
		expect(lower).toContain("tasks/active/");
		expect(lower).toContain("untrusted"); // treats the injected block as data, not proof
	});

	it("does not tell the agent to run an orientation CLI command itself", () => {
		// No prescriptive 'run `mewkit orient`' / 'npx mewkit orient' instruction to the agent.
		expect(lower).not.toMatch(/run `?(npx )?mewkit orient/);
	});

	it("gates the plan scan on a none/absent orientation (no unconditional scan)", () => {
		expect(lower).toContain("only when the orientation outcome is `none`");
	});
});
