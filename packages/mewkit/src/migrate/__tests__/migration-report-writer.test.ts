// Unit tests for the migration report writer: schema shape, md↔json consistency,
// deterministic artifact ordering, verdict line, and secret-count surfacing.

import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { MigrationDecisionRecord } from "../validation/migration-record-types.js";
import {
	buildMigrationReport,
	foldArtifacts,
	MIGRATION_REPORT_SCHEMA_VERSION,
	migrationVerdictLine,
	renderMigrationReportMarkdown,
	writeMigrationReport,
} from "../validation/migration-report-writer.js";

const fixedNow = (): Date => new Date("2020-01-02T03:04:05.000Z");

function rec(
	over: Partial<MigrationDecisionRecord> & Pick<MigrationDecisionRecord, "source" | "outcome">,
): MigrationDecisionRecord {
	return { type: "agent", provider: "codex", reason: "converted", ...over } as MigrationDecisionRecord;
}

describe("migration-report-writer", () => {
	const cleanups: string[] = [];
	afterAll(async () => {
		for (const dir of cleanups) await rm(dir, { recursive: true, force: true });
	});

	it("builds a versioned report with correct counts", () => {
		const report = buildMigrationReport({
			provider: "codex",
			version: "1.2.3",
			codexMinSupportedVersion: "0.142.0",
			now: fixedNow,
			records: [
				rec({ source: "a", outcome: "migrated" }),
				rec({ source: "b", outcome: "skipped", reason: "no-provider-surface" }),
				rec({ source: "c", outcome: "failed", reason: "conversion-error" }),
				rec({ source: "d", outcome: "partial", reason: "runtime-neutralized" }),
			],
		});
		expect(report.schemaVersion).toBe(MIGRATION_REPORT_SCHEMA_VERSION);
		expect(report.header.provider).toBe("codex");
		expect(report.header.version).toBe("1.2.3");
		expect(report.header.codexMinSupportedVersion).toBe("0.142.0");
		expect(report.header.timestamp).toBe("2020-01-02T03:04:05.000Z");
		expect(report.header.counts).toEqual({ migrated: 1, skipped: 1, failed: 1, narrowed: 1, total: 4 });
	});

	it("folds duplicate artifact keys, keeping the more severe outcome", () => {
		const artifacts = foldArtifacts([
			rec({ source: "x", outcome: "migrated" }),
			rec({ source: "x", outcome: "failed", reason: "audit-rejected" }),
		]);
		expect(artifacts).toHaveLength(1);
		expect(artifacts[0].status).toBe("failed");
	});

	it("orders artifacts deterministically by stable key", () => {
		const a = foldArtifacts([rec({ source: "z", outcome: "migrated" }), rec({ source: "a", outcome: "migrated" })]);
		const b = foldArtifacts([rec({ source: "a", outcome: "migrated" }), rec({ source: "z", outcome: "migrated" })]);
		expect(a.map((r) => r.sourcePath)).toEqual(b.map((r) => r.sourcePath));
		expect(a[0].sourcePath).toBe("a");
	});

	it("renders md from the same object (json ↔ md consistency)", () => {
		const report = buildMigrationReport({
			provider: "codex",
			version: "9.9.9",
			now: fixedNow,
			secretKeysOmitted: 2,
			records: [rec({ source: "planner", outcome: "migrated", target: ".codex/agents/planner.toml" })],
		});
		const md = renderMigrationReportMarkdown(report);
		expect(md).toContain("# Migration report");
		expect(md).toContain("Provider: codex");
		expect(md).toContain("Migrated: 1");
		expect(md).toContain("Secret-like env keys omitted");
		expect(md).toContain("| agent | planner |");
	});

	it("maps every non-migrated status to a concrete next action in the md", () => {
		const report = buildMigrationReport({
			provider: "codex",
			version: "1.0.0",
			now: fixedNow,
			records: [
				rec({ source: "brk", outcome: "failed", reason: "conversion-error", detail: "boom" }),
				rec({ source: "nrw", outcome: "partial", reason: "runtime-neutralized" }),
			],
		});
		const md = renderMigrationReportMarkdown(report);
		expect(md).toContain("## Needs attention");
		expect(md).toMatch(/\*\*failed\*\*/);
		expect(md).toMatch(/\*\*narrowed\*\*/);
		expect(md).toMatch(/Next: .+re-run migrate/);
		expect(md).toMatch(/Next: .+reduced coverage/);
	});

	it("produces the single verdict line", () => {
		const report = buildMigrationReport({
			provider: "codex",
			version: "1.0.0",
			now: fixedNow,
			records: [
				rec({ source: "a", outcome: "migrated" }),
				rec({ source: "b", outcome: "skipped" }),
				rec({ source: "c", outcome: "failed", reason: "conversion-error" }),
			],
		});
		expect(migrationVerdictLine(report, ".codex/migration-report.json")).toBe(
			"Migration: 1 migrated, 1 skipped, 1 need attention -> .codex/migration-report.json",
		);
	});

	it("writes both json and md to the output dir, creating it first", async () => {
		const base = mkdtempSync(join(tmpdir(), "report-writer-"));
		cleanups.push(base);
		const outputDir = join(base, "nested", ".codex"); // does not exist yet
		const report = buildMigrationReport({
			provider: "codex",
			version: "1.0.0",
			now: fixedNow,
			records: [rec({ source: "a", outcome: "migrated" })],
		});
		const written = await writeMigrationReport(report, outputDir);
		const parsed = JSON.parse(readFileSync(written.jsonPath, "utf-8"));
		expect(parsed.schemaVersion).toBe(MIGRATION_REPORT_SCHEMA_VERSION);
		expect(readFileSync(written.mdPath, "utf-8")).toContain("# Migration report");
	});
});
