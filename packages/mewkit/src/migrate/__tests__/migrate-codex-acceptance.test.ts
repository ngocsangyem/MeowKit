// Phase-7 acceptance: an init-shaped kit fixture exercises the cross-phase Codex
// migration contract in one run. Assertions intentionally read generated
// artifacts and migration-report.json instead of brittle stdout text.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CODEX_MIN_SUPPORTED_VERSION } from "../providers/codex/capabilities.js";
import {
	setupKitInstallMigrateE2e,
	type MigrateE2eEnv,
} from "./helpers/migrate-e2e-harness.js";

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
	env = await setupKitInstallMigrateE2e("target-codex-acceptance");
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
	return Object.values(hooksJson.hooks).flatMap((groups) => groups.flatMap((group) => group.hooks.map((h) => h.command)));
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

	it("accounts for all 22 source hook registrations with runnable, single-root commands", () => {
		const commands = hookCommands();
		expect(commands).toHaveLength(22);
		for (const command of commands) {
			expect(command).not.toContain(`${env.projectDir}/${env.projectDir}`);
			const wrapperPath = command.replace(/^node\s+/, "").replace(/^"|"$/g, "");
			expect(existsSync(wrapperPath), command).toBe(true);
		}

		const hookRecords = readReport().artifacts.filter((a) => a.type === "hooks");
		const migratedOrSkipped = hookRecords.filter((a) => a.status === "migrated" || a.status === "skipped");
		expect(migratedOrSkipped.length).toBe(22);
		expect(hookRecords.find((a) => a.sourcePath === "gate-enforcement.sh")?.status).toBe("migrated");
		expect(hookRecords.find((a) => a.sourcePath === "privacy-block.sh")?.status).toBe("migrated");
	});

	it("rewrites migrated skill refs while preserving genuinely out-of-set refs", () => {
		const agentToml = readFileSync(join(env.projectDir, ".codex", "agents", "planner.toml"), "utf-8");
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

		const plannerToml = readFileSync(join(env.projectDir, ".codex", "agents", "planner.toml"), "utf-8");
		expect(plannerToml).toContain('model = "codex-heavy"');
		expect(plannerToml).toContain('model_reasoning_effort = "xhigh"');
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
		expect(hookCommands()).toHaveLength(22);
		const agentsMd = readFileSync(join(env.projectDir, "AGENTS.md"), "utf-8");
		expect(agentsMd.match(/GENERATED:capability-bootstrap START/g)).toHaveLength(1);
	});
});
