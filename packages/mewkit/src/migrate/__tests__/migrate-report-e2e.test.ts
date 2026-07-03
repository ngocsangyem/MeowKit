// End-to-end: a real migrate run persists the migration report to
// .codex/migration-report.json + .md. Asserts the identity invariant
// (migrated + skipped + failed == discovered artifacts), the skipped-vs-failed
// distinction, the shell-env scaffold emission (item C), and the security gate
// (no .env value or key NAME leaks into the report).

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupMigrateE2e, type MigrateE2eEnv } from "./helpers/migrate-e2e-harness.js";

let env: MigrateE2eEnv;
let exitCode: number;

// A sentinel value that must NEVER appear in the report (it lives in .claude/.env).
const ENV_SECRET_VALUE = "sk-do-not-leak-abc123";
const ENV_SECRET_KEYNAME = "JIRA_API_TOKEN"; // secret-like name → omitted from scaffold + report

interface ReportShape {
	schemaVersion: number;
	header: {
		provider: string;
		version: string;
		timestamp: string;
		counts: { migrated: number; skipped: number; failed: number; narrowed: number; total: number };
		secretKeysOmitted?: number;
	};
	artifacts: Array<{ type: string; sourcePath: string; status: string; reason?: string }>;
}

beforeAll(async () => {
	env = await setupMigrateE2e("target-report-e2e");
	// Add a source .env with a secret-like key + value, plus a non-secret key.
	await writeFile(
		join(env.sourceDir, ".env"),
		`${ENV_SECRET_KEYNAME}=${ENV_SECRET_VALUE}\nMY_REGION=eu-west-1\n`,
		"utf-8",
	);
	// Add an unsupported hook handler (.py) so a skippedShellHooks (dropped) record
	// exists. (.sh hooks now migrate via a generated wrapper; only .ps1/.bat/.cmd/.py
	// have no portable execution path and are reported as skipped.)
	await mkdir(join(env.sourceDir, "hooks"), { recursive: true });
	await writeFile(join(env.sourceDir, "hooks", "legacy-probe.py"), "print('probe')\n", "utf-8");
	exitCode = await env.run({});
}, 60_000);

afterAll(async () => {
	await env.cleanup();
});

function readReport(): ReportShape {
	return JSON.parse(readFileSync(join(env.projectDir, ".codex", "migration-report.json"), "utf-8")) as ReportShape;
}

describe("migrate persists a migration report", () => {
	it("succeeds and writes both report artifacts", () => {
		expect(exitCode).toBe(0);
		expect(existsSync(join(env.projectDir, ".codex", "migration-report.json"))).toBe(true);
		expect(existsSync(join(env.projectDir, ".codex", "migration-report.md"))).toBe(true);
	});

	it("carries the versioned schema + codex provider header", () => {
		const report = readReport();
		expect(report.schemaVersion).toBe(1);
		expect(report.header.provider).toBe("codex");
		expect(report.header.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("satisfies the identity invariant: migrated + skipped + failed == total discovered", () => {
		const { counts } = readReport().header;
		expect(counts.migrated + counts.skipped + counts.failed + counts.narrowed).toBe(counts.total);
		expect(counts.total).toBeGreaterThan(0);
	});

	it("distinguishes an unsupported dropped hook as skipped (not failed)", () => {
		const report = readReport();
		const probe = report.artifacts.find((a) => a.sourcePath === "legacy-probe.py");
		expect(probe).toBeDefined();
		expect(probe?.status).toBe("skipped");
	});

	it("threads a Phase-2 hook decision (HooksMergeResult.records) into the report (item B)", () => {
		const report = readReport();
		const hook = report.artifacts.find((a) => a.type === "hooks" && a.sourcePath === "validate-docs.cjs");
		expect(hook).toBeDefined();
		// The `event-unsupported` reason is emitted ONLY by the Phase-2 hooks merger's
		// per-hook decision records — its presence proves those records reached the report.
		expect(hook?.reason).toBe("event-unsupported");
	});

	it("emits the [shell_environment_policy] scaffold into config.toml (item C)", () => {
		const configToml = readFileSync(join(env.projectDir, ".codex", "config.toml"), "utf-8");
		expect(configToml).toContain("[shell_environment_policy]");
		expect(configToml).toContain("MY_REGION");
	});

	it("records the aggregate secret-key-omitted count without the key name", () => {
		const report = readReport();
		expect(report.header.secretKeysOmitted).toBe(1);
	});

	it("SECURITY: leaks neither the .env value nor the secret key NAME into either report artifact", () => {
		const json = readFileSync(join(env.projectDir, ".codex", "migration-report.json"), "utf-8");
		const md = readFileSync(join(env.projectDir, ".codex", "migration-report.md"), "utf-8");
		for (const surface of [json, md]) {
			expect(surface).not.toContain(ENV_SECRET_VALUE);
			expect(surface).not.toContain(ENV_SECRET_KEYNAME);
		}
	});

	it("SECURITY: the shell-env scaffold in config.toml never contains the secret value or secret key name", () => {
		const configToml = readFileSync(join(env.projectDir, ".codex", "config.toml"), "utf-8");
		expect(configToml).not.toContain(ENV_SECRET_VALUE);
		expect(configToml).not.toContain(ENV_SECRET_KEYNAME);
	});
});
