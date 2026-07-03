// Run-twice idempotency: a second migrate over an unchanged source must be a
// full no-op — byte-identical generated output. Also covers the target-edited
// conflict path (keep by default, overwrite with --force).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupMigrateE2e, type MigrateE2eEnv } from "./helpers/migrate-e2e-harness.js";

let env: MigrateE2eEnv;

function snapshotTree(root: string, skipPrefixes: string[]): Map<string, string> {
	const snapshot = new Map<string, string>();
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			const rel = relative(root, full);
			if (skipPrefixes.some((prefix) => rel.startsWith(prefix))) continue;
			if (statSync(full).isDirectory()) walk(full);
			else snapshot.set(rel, readFileSync(full, "utf-8"));
		}
	};
	walk(root);
	return snapshot;
}

beforeAll(async () => {
	env = await setupMigrateE2e("target-idem-e2e");
}, 60_000);

afterAll(async () => {
	await env.cleanup();
});

describe("migrate idempotency and conflict handling", () => {
	// The migration report is a MANAGED artifact carrying a real run timestamp — it
	// is intentionally non-idempotent and is exempt from the reconciler's churn
	// surface (see reconcile/portable-manifest.ts isManagedMigrationReportPath). It
	// is excluded from the byte-identical snapshot for that reason.
	const REPORT_SKIP = [".claude", join(".codex", "migration-report.json"), join(".codex", "migration-report.md")];

	it("second run over unchanged source is byte-identical (excluding the timestamped report)", async () => {
		expect(await env.run({})).toBe(0);
		const first = snapshotTree(env.projectDir, REPORT_SKIP);
		expect(first.size).toBeGreaterThan(0);

		expect(await env.run({})).toBe(0);
		const second = snapshotTree(env.projectDir, REPORT_SKIP);

		expect(Array.from(second.keys()).sort()).toEqual(Array.from(first.keys()).sort());
		for (const [file, content] of second) {
			expect(content, file).toBe(first.get(file));
		}
	});

	it("the migration report's per-artifact section is deterministic across re-runs", async () => {
		expect(await env.run({})).toBe(0);
		const reportPath = join(env.projectDir, ".codex", "migration-report.json");
		const first = JSON.parse(readFileSync(reportPath, "utf-8")) as { header: { timestamp: string }; artifacts: unknown[] };

		expect(await env.run({})).toBe(0);
		const second = JSON.parse(readFileSync(reportPath, "utf-8")) as { header: { timestamp: string }; artifacts: unknown[] };

		// Artifact keys are stable — only the header timestamp is allowed to vary.
		expect(JSON.stringify(second.artifacts)).toBe(JSON.stringify(first.artifacts));
	});

	it("keeps a user-edited target by default and overwrites it with --force", async () => {
		const skillPath = join(env.projectDir, ".agents", "skills", "source-command-mk-fix", "SKILL.md");
		const userEdit = `${readFileSync(skillPath, "utf-8")}\n<!-- user customization -->\n`;
		await writeFile(skillPath, userEdit, "utf-8");

		expect(await env.run({})).toBe(0);
		expect(readFileSync(skillPath, "utf-8")).toBe(userEdit);

		expect(await env.run({ force: true })).toBe(0);
		expect(readFileSync(skillPath, "utf-8")).not.toContain("user customization");
	});
});
