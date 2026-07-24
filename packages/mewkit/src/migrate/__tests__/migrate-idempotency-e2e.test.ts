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
		const first = JSON.parse(readFileSync(reportPath, "utf-8")) as {
			header: { timestamp: string };
			artifacts: unknown[];
		};

		expect(await env.run({})).toBe(0);
		const second = JSON.parse(readFileSync(reportPath, "utf-8")) as {
			header: { timestamp: string };
			artifacts: unknown[];
		};

		// Artifact keys are stable — only the header timestamp is allowed to vary.
		expect(JSON.stringify(second.artifacts)).toBe(JSON.stringify(first.artifacts));
	});

	// NOTE: the "keeps a user-edited target by default, overwrites with --force"
	// scenario previously exercised a converted-command skill file
	// (.agents/skills/source-command-mk-fix/SKILL.md) — the ONLY codex artifact
	// that went through the standard reconcile keep/conflict system. Commands
	// conversion is now nulled for Codex (toolkit commands ship as native Agent
	// Skills; custom commands are not auto-ported). The remaining codex surfaces
	// have no keep-by-default artifact to exercise this against: skills always
	// force-reinstall every run (skill-directory-installer.ts `cp(..., {force:
	// true})`, bypassing reconcile conflict entirely — see the skill directory
	// installer's own test suite), and config/rules merge-single into the
	// managed AGENTS.md surface below (always re-applied). There is no longer a
	// per-file "keep unless --force" codex artifact to test.

	it("AGENTS.md is a managed authored surface — a hand-edited rule section is re-applied from source on re-migrate (no --force)", async () => {
		const agentsPath = join(env.projectDir, "AGENTS.md");
		const before = readFileSync(agentsPath, "utf-8");
		expect(before).toContain("## Rule: tool-rules"); // sanity: a source rule merged in
		expect(before).toContain("Authored Codex instruction surface"); // authored base present
		await writeFile(
			agentsPath,
			before.replace("## Rule: tool-rules", "## Rule: tool-rules\n<!-- user hand-edit -->"),
			"utf-8",
		);

		// Every remaining codex-installed surface is managed/authored post-cutover:
		// the overlay force-rewrites its base and the source rules re-merge onto it every run, so a
		// direct hand-edit is NOT preserved — consistent with config.toml and every other flipped surface.
		// Users customize AGENTS.md by editing their source `.claude/rules/`, not AGENTS.md itself.
		expect(await env.run({})).toBe(0);
		const after = readFileSync(agentsPath, "utf-8");
		expect(after).not.toContain("user hand-edit"); // hand-edit overwritten (managed)
		expect(after).toContain("## Rule: tool-rules"); // section re-merged from source
		expect(after).toContain("Authored Codex instruction surface"); // authored base intact
	});
});
