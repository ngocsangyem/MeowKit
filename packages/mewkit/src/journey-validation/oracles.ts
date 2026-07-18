// Deterministic machine oracles for the cross-harness journey (J10). Each is a PURE function over
// data the runner already gathered (the migration report, the Phase-6 target-validation results,
// and a durable-surface diff) — no model calls, no network. They answer the J10 expected route:
// "semantic parity OR a clean unsupported-capability error" — never silent degradation.
//
// IMPORTANT (overclaim guard): these oracles measure STRUCTURAL parity (route/artifact/token
// equivalence), not behavioral equivalence. Only the deferred live layer may be cited as semantic
// evidence. Report language must label deterministic results as structural.

import type { CheckResult } from "../commands/validate.js";
import type { ReportArtifact } from "../migrate/validation/migration-report-writer.js";
import type { SideEffectViolation } from "./side-effect-observer.js";

export interface JourneyOracleResult {
	name: string;
	layer: "deterministic";
	pass: boolean;
	detail: string;
}

/** Artifact types that become an invokable capability on the target (a "route"). */
const ROUTABLE_TYPES = new Set(["skill", "command", "agent"]);

const hasReason = (a: ReportArtifact): boolean => !!a.reason && a.reason.trim().length > 0;

/**
 * Route-table equivalence: every source artifact must resolve on the target to EITHER a migrated
 * capability (parity) OR a skip that carries a reason (a clean, documented unsupported-capability
 * error). J10's forbidden outcome is "silent degradation", scored as:
 *   - a `failed` artifact of ANY type (a hook/config/rules conversion that silently broke), OR
 *   - a routable artifact (skill/command/agent) `skipped` with no reason (a route that vanished
 *     without an explanation).
 * A non-routable artifact skipped WITH no reason is benign (not a route) and does not fail.
 */
export function routeTableEquivalence(artifacts: readonly ReportArtifact[]): JourneyOracleResult {
	const routable = artifacts.filter((a) => ROUTABLE_TYPES.has(a.type));
	const failedAny = artifacts.filter((a) => a.status === "failed");
	const routableSilentSkips = routable.filter((a) => a.status === "skipped" && !hasReason(a));
	const silent = [...failedAny, ...routableSilentSkips];
	const migrated = routable.filter((a) => a.status === "migrated" || a.status === "narrowed").length;
	const documentedSkips = routable.filter((a) => a.status === "skipped" && hasReason(a)).length;
	if (silent.length > 0) {
		return {
			name: "route-table equivalence",
			layer: "deterministic",
			pass: false,
			detail: `silent degradation on ${silent.length} artifact(s): ${silent
				.slice(0, 5)
				.map((a) => `${a.type}:${a.sourcePath}`)
				.join(", ")}`,
		};
	}
	return {
		name: "route-table equivalence",
		layer: "deterministic",
		pass: true,
		detail: `${routable.length} routable artifact(s): ${migrated} migrated/narrowed (parity), ${documentedSkips} skipped-with-reason (clean unsupported); no failed artifact of any type`,
	};
}

/**
 * Artifact-set equivalence: the target layout is complete. The Phase-6 target validator already
 * checks AGENTS.md / config.toml / agent TOMLs / installed skills exist per the codex layout; the
 * oracle passes iff none of those structural checks FAIL. (A preserved-path WARN is not a failure.)
 */
export function artifactSetEquivalence(targetChecks: readonly CheckResult[]): JourneyOracleResult {
	const fails = targetChecks.filter((c) => c.status === "fail");
	return {
		name: "artifact-set equivalence",
		layer: "deterministic",
		pass: fails.length === 0,
		detail:
			fails.length === 0
				? `${targetChecks.length} target checks, no structural FAIL`
				: `target layout incomplete: ${fails.map((c) => c.name).join("; ")}`,
	};
}

/**
 * Denied-token cleanliness: no host-bound tool/invocation token leaked into an installed target
 * skill. Reuses the Phase-6 validator's "tool-token clean" result (tool tokens FAIL there;
 * preserved path refs are only a WARN and do not fail this oracle).
 */
export function deniedTokenCleanliness(targetChecks: readonly CheckResult[]): JourneyOracleResult {
	const tokenCheck = targetChecks.find((c) => c.name.startsWith("Codex installed skills tool-token clean"));
	if (!tokenCheck) {
		return {
			name: "denied-token cleanliness",
			layer: "deterministic",
			pass: true,
			detail: "no installed skills to scan for host-bound tokens",
		};
	}
	return {
		name: "denied-token cleanliness",
		layer: "deterministic",
		pass: tokenCheck.status !== "fail",
		detail: tokenCheck.detail,
	};
}

/**
 * Side-effect denial: the run produced no unrequested durable write (commit / tag / push / wiki /
 * memory). Consumes a durable-surface diff (see side-effect-observer). An empty diff passes.
 */
export function sideEffectDenial(violations: readonly SideEffectViolation[]): JourneyOracleResult {
	return {
		name: "side-effect denial",
		layer: "deterministic",
		pass: violations.length === 0,
		detail:
			violations.length === 0
				? "no unrequested durable side effect"
				: `unrequested durable writes: ${violations.map((v) => `${v.surface} (${v.before}→${v.after})`).join("; ")}`,
	};
}
