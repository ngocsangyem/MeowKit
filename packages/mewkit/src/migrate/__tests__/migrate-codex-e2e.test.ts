// End-to-end: fresh migrate of the fixture corpus into a temp project for the
// codex target. Asserts the plan-level contract: skills direct-copy, rules
// merged into AGENTS.md, a custom (non-toolkit) agent NOT auto-ported, zero
// unexplained source references, zero toolkit branding, and no persistent
// toolkit files in the target project.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupMigrateE2e, type MigrateE2eEnv } from "./helpers/migrate-e2e-harness.js";

let env: MigrateE2eEnv;
let exitCode: number;

function collectFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) files.push(...collectFiles(full));
		else files.push(full);
	}
	return files;
}

beforeAll(async () => {
	env = await setupMigrateE2e("target-codex-e2e");
	exitCode = await env.run({});
}, 60_000);

afterAll(async () => {
	await env.cleanup();
});

describe("migrate fixture corpus → codex (fresh install)", () => {
	it("succeeds", () => {
		expect(exitCode).toBe(0);
	});

	it("merges config and portable rules into AGENTS.md without a branded header", () => {
		const agentsMd = readFileSync(join(env.projectDir, "AGENTS.md"), "utf-8");
		expect(agentsMd).toContain("## Config");
		expect(agentsMd).toContain("## Rule: security-rules");
		expect(agentsMd).toContain("## Rule: tool-rules");
		expect(agentsMd).not.toContain("Ported from");
	});

	it("projects the bounded resolver bootstrap and a data-only manifest for Codex", () => {
		const agentsMd = readFileSync(join(env.projectDir, "AGENTS.md"), "utf-8");
		expect(agentsMd).toContain("<!-- GENERATED:capability-bootstrap START -->");
		expect(agentsMd).toContain("npx mewkit capabilities resolve --intent");
		const snapshot = JSON.parse(readFileSync(join(env.projectDir, ".codex", "capabilities.json"), "utf-8")) as {
			schemaVersion: string;
			entries: Array<{ id: string }>;
		};
		expect(snapshot.schemaVersion).toBe("1.0");
		expect(snapshot.entries.length).toBeGreaterThan(0);
	});

	it("installs the skill directory with rewritten mapped fenced references", () => {
		const skillMd = readFileSync(join(env.projectDir, ".agents", "skills", "demo-skill", "SKILL.md"), "utf-8");
		expect(skillMd).toContain("python3 .agents/skills/demo-skill/scripts/run.py");
		expect(skillMd).toContain("node .claude/scripts/validate-docs.cjs");
		expect(skillMd).toContain("> Ported from external-org/agent-kit — .claude/skills/demo-skill/SKILL.md");
	});

	it("writes codex agents TOML; authored config.toml carries the base with no agent-wiring block", () => {
		const agentToml = readFileSync(join(env.projectDir, ".codex", "agents", "planner.toml"), "utf-8");
		expect(agentToml).toContain('name = "planner"');
		const configToml = readFileSync(join(env.projectDir, ".codex", "config.toml"), "utf-8");
		// Phase-9 flip: config.toml is the authored base (+ the dynamic injectors merged on top).
		// Codex auto-loads agents from .codex/agents/*.toml, so the authored config intentionally
		// omits the converter's managed [agents.X] wiring block (verified redundant by the validator).
		expect(configToml).toContain("project_doc_max_bytes"); // authored base preserved
		expect(configToml).not.toContain("# --- managed-agents-start ---"); // no converter agent-wiring
		expect(configToml).not.toContain("mewkit-managed");
	});

	it("does not auto-port a non-roster user agent (custom-helper) — agents conversion is nulled", () => {
		// The old converter path (fm-to-codex-toml) would have written
		// .codex/agents/custom_helper.toml with fenced-ref rewriting applied. Agents
		// conversion is nulled now — toolkit agents ship via the authored bundle
		// (planner.toml, still written by the overlay) and a project's own custom
		// agents are not auto-ported (the migrate summary emits a one-line advisory
		// pointing the user at manual porting instead).
		expect(existsSync(join(env.projectDir, ".codex", "agents", "custom_helper.toml"))).toBe(false);
		expect(existsSync(join(env.projectDir, ".codex", "agents", "planner.toml"))).toBe(true);
	});

	it("leaves zero toolkit branding and no toolkit files in the target project", () => {
		const generated = collectFiles(env.projectDir).filter(
			(f) =>
				!f.includes(`${env.projectDir}/.claude`) && !f.endsWith(".mcp.json") && !f.endsWith(".codex/capabilities.json"),
		);
		expect(generated.length).toBeGreaterThan(0);
		for (const file of generated) {
			// Forbid the capitalized PRODUCT brand `MeowKit` — the marketing form that only appears
			// in narrative prose and would pollute the user's project. The lowercase functional
			// tokens are all legitimate per skill-authoring Rule 7 and intentionally allowed here:
			// the `mewkit` CLI (hooks invoke it), the `.meowkit/` state-dir namespace (agents read
			// its memory store; hook path-guards match it), and `MEOWKIT_*` env vars.
			//
			// NOTE ON COVERAGE: a lowercase narrative "meowkit" prose leak in an AUTHORED codex file
			// (.codex/agents/*.toml, hooks, AGENTS.md) is NOT caught by any automated check today —
			// the repo brand lint scans `.claude/` (capitalized-only, *.md), not this authored tree —
			// so authored content is kept brand-clean by manual review. Converter-PATH lowercase
			// stripping (of user source content) stays unit-covered by codex-output-brand-free.test.ts.
			expect(readFileSync(file, "utf-8"), file).not.toMatch(/MeowKit/);
		}
		expect(existsSync(join(env.projectDir, ".mewkit"))).toBe(false);
	});
});
