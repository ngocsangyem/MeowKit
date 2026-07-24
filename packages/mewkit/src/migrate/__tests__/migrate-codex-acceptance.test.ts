// Phase-7 acceptance: an init-shaped kit fixture exercises the cross-phase Codex
// migration contract in one run. Assertions intentionally read generated
// artifacts and migration-report.json instead of brittle stdout text.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CODEX_MIN_SUPPORTED_VERSION } from "../providers/codex/capabilities.js";
import { setupKitInstallMigrateE2e, type MigrateE2eEnv } from "./helpers/migrate-e2e-harness.js";
import { codexTargetProfile } from "../../validate/targets/codex-target.js";

let env: MigrateE2eEnv;
let exitCode: number;

interface HooksJson {
	hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string }> }>>;
}

interface ReportShape {
	header: {
		counts: { migrated: number; skipped: number; failed: number; narrowed: number; total: number };
		secretKeysOmitted?: number;
	};
	artifacts: Array<{ type: string; sourcePath: string; status: string; reason?: string; targetPath?: string }>;
}

beforeAll(async () => {
	// This fixture covers the documented 0.142 hook surface. The fallback tier
	// intentionally omits newer events when no Codex binary is available.
	env = await setupKitInstallMigrateE2e("target-codex-acceptance", "optimistic");
	exitCode = await env.run({ includeMcp: true });
}, 60_000);

afterAll(async () => {
	await env.cleanup();
});

function readReport(): ReportShape {
	return JSON.parse(readFileSync(join(env.projectDir, ".codex", "migration-report.json"), "utf-8")) as ReportShape;
}

function hookCommands(): string[] {
	const hooksJson = JSON.parse(readFileSync(join(env.projectDir, ".codex", "hooks.json"), "utf-8")) as HooksJson;
	return Object.values(hooksJson.hooks).flatMap((groups) =>
		groups.flatMap((group) => group.hooks.map((h) => h.command)),
	);
}

describe("migrate codex acceptance — kit-install completeness", () => {
	it("succeeds and persists the report", () => {
		expect(exitCode).toBe(0);
		expect(existsSync(join(env.projectDir, ".codex", "migration-report.json"))).toBe(true);
		expect(existsSync(join(env.projectDir, ".codex", "migration-report.md"))).toBe(true);
	});

	it("keeps the report identity invariant and records the supported Codex hook tier", () => {
		const report = readReport();
		const { counts } = report.header;
		expect(counts.migrated + counts.skipped + counts.failed + counts.narrowed).toBe(counts.total);
		expect(readFileSync(join(env.projectDir, ".codex", "migration-report.json"), "utf-8")).toContain(
			CODEX_MIN_SUPPORTED_VERSION,
		);
	});

	it("emits the authored Codex hook set (runnable, single-root) and still accounts for every source hook", () => {
		const commands = hookCommands();
		// Phase-9 flip: the hooks surface is authored. hooks.json declares the 3 native Codex
		// safety+capture hooks (capture, privacy-block, gate-enforcement) — NOT a 1:1 map of the
		// 22 source Claude hooks. Each resolves its wrapper via the git root (Codex exposes no
		// project-dir env), single-root, runnable.
		expect(commands).toHaveLength(3);
		for (const command of commands) {
			expect(command).not.toContain(`${env.projectDir}/${env.projectDir}`);
			expect(command).toContain("git rev-parse --show-toplevel");
			expect(command).toMatch(/\.codex\/hooks\/(capture|privacy-block|gate-enforcement)\.cjs/);
		}
		for (const name of ["capture", "privacy-block", "gate-enforcement"]) {
			expect(existsSync(join(env.projectDir, ".codex", "hooks", `${name}.cjs`)), name).toBe(true);
		}

		// The migration report still accounts for every source hook — none silently dropped —
		// and the safety hooks are recorded migrated.
		const hookRecords = readReport().artifacts.filter((a) => a.type === "hooks");
		const migratedOrSkipped = hookRecords.filter((a) => a.status === "migrated" || a.status === "skipped");
		expect(migratedOrSkipped.length).toBe(22);
		expect(hookRecords.find((a) => a.sourcePath === "gate-enforcement.sh")?.status).toBe("migrated");
		expect(hookRecords.find((a) => a.sourcePath === "privacy-block.sh")?.status).toBe("migrated");
	});

	it("rewrites migrated skill refs while preserving genuinely out-of-set refs", () => {
		// Asserted against a NON-roster user agent (custom-helper.md → custom_helper.toml): the
		// authored-bundle overlay overwrites toolkit agents (planner.toml) but never a user-custom
		// agent, so the converter's ref-rewriting stays observable end-to-end post-cutover (also
		// unit-covered in the ref-rewrite suites).
		const agentToml = readFileSync(join(env.projectDir, ".codex", "agents", "custom_helper.toml"), "utf-8");
		expect(agentToml).toContain("python3 .agents/skills/demo-skill/scripts/run.py");
		expect(agentToml).not.toContain(".claude/skills/demo-skill");
		expect(agentToml).toContain("node .claude/scripts/validate-docs.cjs");
	});

	it("installs previously audit-sensitive skill content with annotated env rewrites", () => {
		const skillMd = readFileSync(join(env.projectDir, ".agents", "skills", "demo-skill", "SKILL.md"), "utf-8");
		expect(skillMd).toContain(".agents/skills/demo-skill/scripts/run.py");
		expect(existsSync(join(env.projectDir, ".agents", "skills", "demo-skill", "scripts", "run.py"))).toBe(true);
	});

	it("emits config completeness surfaces without leaking source env secrets", () => {
		const configToml = readFileSync(join(env.projectDir, ".codex", "config.toml"), "utf-8");
		expect(configToml).toContain("[mcp_servers.context7]");
		expect(configToml).toContain("[shell_environment_policy]");
		expect(configToml).toContain("MY_REGION");
		expect(configToml).not.toContain("sk-do-not-leak-phase7");
		expect(configToml).not.toContain("JIRA_API_TOKEN");

		// No modelRouting override mechanism: a known source tier has no target model
		// id (deployment-specific), so the converter discloses it as a commented hint and the
		// target inherits its own configured default. Asserted on the non-roster custom_helper
		// agent — the overlay overwrites the toolkit planner.toml with authored content.
		const customToml = readFileSync(join(env.projectDir, ".codex", "agents", "custom_helper.toml"), "utf-8");
		expect(customToml).toContain('# model = "opus"');
		expect(customToml).not.toContain('model_reasoning_effort');
		expect(readReport().header.secretKeysOmitted).toBe(1);
	});

	it("keeps AGENTS.md self-contained with explicit budget-raise guidance when over budget", () => {
		const agentsMd = readFileSync(join(env.projectDir, "AGENTS.md"), "utf-8");
		expect(agentsMd.startsWith("# AGENTS.md")).toBe(true);
		const budgetLines = readFileSync(join(env.projectDir, ".codex", "migration-report.json"), "utf-8");
		expect(budgetLines).toContain("project_doc_max_bytes");
	});

	it("keeps one idempotent resolver bootstrap and writes a capability snapshot", () => {
		const agentsMd = readFileSync(join(env.projectDir, "AGENTS.md"), "utf-8");
		expect(agentsMd.match(/GENERATED:capability-bootstrap START/g)).toHaveLength(1);
		expect(agentsMd).toContain("npx mewkit capabilities resolve --intent");
		const snapshot = JSON.parse(readFileSync(join(env.projectDir, ".codex", "capabilities.json"), "utf-8")) as {
			schemaVersion: string;
			entries: unknown[];
		};
		expect(snapshot.schemaVersion).toBe("1.0");
		expect(snapshot.entries.length).toBeGreaterThan(0);
	});

	it("is idempotent on a second run over the generated output", async () => {
		expect(await env.run({ includeMcp: true })).toBe(0);
		const report = readReport();
		const { counts } = report.header;
		expect(counts.migrated + counts.skipped + counts.failed + counts.narrowed).toBe(counts.total);
		expect(hookCommands()).toHaveLength(3); // authored hook set (phase-9 flip), idempotent on re-run
		const agentsMd = readFileSync(join(env.projectDir, "AGENTS.md"), "utf-8");
		expect(agentsMd.match(/GENERATED:capability-bootstrap START/g)).toHaveLength(1);
	});

	// Phase 6: the migration validates its OWN output — the target validator finds no FAIL on a
	// fresh, correct Codex tree. Generating the fixture by real migration (not a checked-in snapshot)
	// keeps this honest as the output evolves.
	it("passes `validate --target codex` on its own generated output (no FAIL)", async () => {
		const results = await codexTargetProfile.check(env.projectDir);
		const fails = results.filter((r) => r.status === "fail");
		expect(fails, fails.map((f) => `${f.name}: ${f.detail}`).join("; ")).toEqual([]);
		expect(results.find((r) => r.name.startsWith("Codex installed skills tool-token clean"))?.status).toBe("pass");
	});
});
