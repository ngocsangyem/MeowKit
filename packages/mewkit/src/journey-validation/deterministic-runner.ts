// Deterministic J10 evaluator: given a generated codex target (produced by a real
// `mewkit migrate codex` run) plus a durable-surface diff captured around that migration, it runs
// the four machine oracles and returns a structural cross-harness parity result. NO model calls,
// NO network — this is the CI-provable layer that clears the audit's cross-harness stop-condition.
//
// Library boundary: this evaluator is migration-agnostic. The caller owns the isolated migration
// (HOME redirect, chdir, compat tier — see the migrate e2e harness) and the before/after durable
// snapshots; the evaluator only READS the resulting target. That keeps it deterministic and lets
// the deferred live RunnerBackend reuse it unchanged.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "../commands/validate.js";
import type { ReportArtifact, ReportCounts } from "../migrate/validation/migration-report-writer.js";
import { codexTargetProfile } from "../validate/targets/codex-target.js";
import {
	artifactSetEquivalence,
	deniedTokenCleanliness,
	routeTableEquivalence,
	sideEffectDenial,
	type JourneyOracleResult,
} from "./oracles.js";
import type { SideEffectViolation } from "./side-effect-observer.js";

interface MigrationReportShape {
	header: { counts: ReportCounts };
	artifacts: ReportArtifact[];
}

export interface StructuralParity {
	/** Migrated + narrowed routable artifacts (present on the target). */
	migrated: number;
	/** Skipped-with-reason routable artifacts (clean unsupported-capability errors). */
	documentedSkips: number;
	/** Total routable source artifacts considered. */
	routable: number;
}

export interface CrossHarnessResult {
	provider: "codex";
	/** All deterministic oracles passed → structural parity holds (NOT semantic — see oracles.ts). */
	pass: boolean;
	structuralParity: StructuralParity;
	oracles: JourneyOracleResult[];
	targetChecks: CheckResult[];
}

const ROUTABLE_TYPES = new Set(["skill", "command", "agent"]);

function readReport(projectDir: string): MigrationReportShape {
	const reportPath = join(projectDir, ".codex", "migration-report.json");
	if (!existsSync(reportPath)) {
		throw new Error(`no migration report at ${reportPath} — migrate the target before evaluating`);
	}
	return JSON.parse(readFileSync(reportPath, "utf-8")) as MigrationReportShape;
}

/**
 * Evaluate structural cross-harness parity for a generated codex target. Runs the Phase-6 target
 * validator + the four J10 oracles and returns a pass iff every oracle passes.
 */
export async function evaluateCrossHarnessParity(input: {
	projectDir: string;
	sideEffects: readonly SideEffectViolation[];
}): Promise<CrossHarnessResult> {
	const report = readReport(input.projectDir);
	const targetChecks = await codexTargetProfile.check(input.projectDir);

	const oracles: JourneyOracleResult[] = [
		routeTableEquivalence(report.artifacts),
		artifactSetEquivalence(targetChecks),
		deniedTokenCleanliness(targetChecks),
		sideEffectDenial(input.sideEffects),
	];

	const routable = report.artifacts.filter((a) => ROUTABLE_TYPES.has(a.type));
	const structuralParity: StructuralParity = {
		migrated: routable.filter((a) => a.status === "migrated" || a.status === "narrowed").length,
		documentedSkips: routable.filter((a) => a.status === "skipped" && !!a.reason).length,
		routable: routable.length,
	};

	return {
		provider: "codex",
		pass: oracles.every((o) => o.pass),
		structuralParity,
		oracles,
		targetChecks,
	};
}
