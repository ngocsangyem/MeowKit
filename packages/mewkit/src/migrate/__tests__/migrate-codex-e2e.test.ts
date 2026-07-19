// End-to-end: fresh migrate of the fixture corpus into a temp project for the
// codex target. Asserts the plan-level contract: commands emitted as skills,
// rules merged into AGENTS.md, zero unexplained source references, zero
// toolkit branding, and no persistent toolkit files in the target project.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
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
	// Opt-in surface: .mcp.json at the project root.
	await writeFile(
		join(env.projectDir, ".mcp.json"),
		JSON.stringify({ mcpServers: { context7: { command: "npx", args: ["-y", "@upstash/context7-mcp"] } } }),
		"utf-8",
	);
	exitCode = await env.run({ includeMcp: true });
}, 60_000);

afterAll(async () => {
	await env.cleanup();
});

describe("migrate fixture corpus → codex (fresh install)", () => {
	it("succeeds", () => {
		expect(exitCode).toBe(0);
	});

	it("emits the command as an Agent Skill with frontmatter and adaptation guidance", () => {
		const skillPath = join(env.projectDir, ".agents", "skills", "source-command-mk-fix", "SKILL.md");
		expect(existsSync(skillPath)).toBe(true);
		const content = readFileSync(skillPath, "utf-8");
		expect(content).toContain("name: source-command-mk-fix");
		expect(content).toContain("$ARGUMENTS");
		expect(content).toContain("## Usage guidance");
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

	it("writes codex agents TOML and merges the managed config block with neutral sentinels", () => {
		const agentToml = readFileSync(join(env.projectDir, ".codex", "agents", "planner.toml"), "utf-8");
		expect(agentToml).toContain('name = "planner"');
		const configToml = readFileSync(join(env.projectDir, ".codex", "config.toml"), "utf-8");
		expect(configToml).toContain("# --- managed-agents-start ---");
		expect(configToml).not.toContain("mewkit-managed");
	});

	it("rewrites the agent TOML fenced ref to a migrated skill script, preserving only out-of-set refs", () => {
		const agentToml = readFileSync(join(env.projectDir, ".codex", "agents", "planner.toml"), "utf-8");
		// demo-skill IS in the migration set → the fenced script ref is rewritten to
		// the provider target (previously blanket-preserved because migratedRefs was dropped).
		expect(agentToml).toContain("python3 .agents/skills/demo-skill/scripts/run.py");
		// No .claude/skills reference to a migrated asset survives in the agent TOML.
		expect(agentToml).not.toContain(".claude/skills/demo-skill");
		// A genuinely out-of-set runtime ref (no provider surface) still preserves — fail-closed.
		expect(agentToml).toContain("node .claude/scripts/validate-docs.cjs");
	});

	it("merges the opted-in MCP servers into config.toml", () => {
		const configToml = readFileSync(join(env.projectDir, ".codex", "config.toml"), "utf-8");
		expect(configToml).toContain("[mcp_servers.context7]");
		expect(configToml).toContain('command = "npx"');
	});

	it("leaves zero toolkit branding and no toolkit files in the target project", () => {
		const generated = collectFiles(env.projectDir).filter(
			(f) =>
				!f.includes(`${env.projectDir}/.claude`) && !f.endsWith(".mcp.json") && !f.endsWith(".codex/capabilities.json"),
		);
		expect(generated.length).toBeGreaterThan(0);
		for (const file of generated) {
			// The bounded bootstrap intentionally names documented CLI invocations (allowed as
			// literal CLI tokens per skill-authoring Rule 7). Strip those exact trusted operations
			// before asserting no narrative/toolkit branding remains.
			const content = readFileSync(file, "utf-8")
				.replace(/npx mewkit capabilities resolve --intent/g, "")
				.replace(/npx mewkit orient/g, "");
			expect(content, file).not.toMatch(/MeowKit|mewkit|meowkit/);
		}
		expect(existsSync(join(env.projectDir, ".mewkit"))).toBe(false);
	});
});
