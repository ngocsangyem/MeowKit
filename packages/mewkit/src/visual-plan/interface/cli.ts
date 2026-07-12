/**
 * `mewkit visual-plan <subcommand>` dispatch + reporter.
 *
 * Subcommands (Phase 1): validate | status | approve | rehash. Each resolves
 * the plan directory, runs the matching application function, and reports in
 * human or `--json` form. Exit codes: 0 ok, 1 contract/precondition failure,
 * 2 usage/path error. Sets `process.exitCode` (never calls `process.exit`) so
 * the surface stays unit-testable.
 */

import * as path from "node:path";
import pc from "picocolors";
import { validatePlan } from "../application/validate-plan.js";
import { planStatus } from "../application/status.js";
import { approvePlan } from "../application/approve.js";
import { rehashPlan } from "../application/rehash.js";
import { exportPlanHtml } from "../application/export-plan.js";
import { runStudio } from "./studio.js";
import { resolvePlanDir, PlanPathError } from "../infrastructure/visual-plan-repository.js";
import { atomicWriteFileSync } from "../infrastructure/atomic-write.js";
import type { ValidationError } from "../domain/errors.js";

export interface VisualPlanCliArgs {
	subcommand?: string;
	planDir?: string;
	revision?: string | number;
	json?: boolean;
	open?: boolean;
	noOpen?: boolean;
	force?: boolean;
	port?: number;
	format?: string;
}

const emit = (value: unknown): void => console.log(JSON.stringify(value, null, 2));

function printErrors(errors: ValidationError[]): void {
	for (const e of errors) console.error(`  ${pc.red("✗")} ${pc.bold(e.path)} — ${e.message} ${pc.dim(`[${e.code}]`)}`);
}

function runValidate(planDir: string, json: boolean): void {
	const r = validatePlan(planDir);
	if (json) {
		emit({ ok: r.ok, coverage: r.coverage ?? null, errors: r.errors });
	} else if (r.ok) {
		const c = r.coverage;
		const cov = c ? ` (coverage ${c.resolved} resolved / ${c.planned} planned / ${c.omitted} omitted / ${c.unresolved} unresolved)` : "";
		console.log(`${pc.green("✓")} visual-plan valid${cov}`);
	} else {
		console.error(`${pc.red("✗")} visual-plan invalid — ${r.errors.length} error(s):`);
		printErrors(r.errors);
	}
	process.exitCode = r.ok ? 0 : 1;
}

function runStatus(planDir: string, json: boolean): void {
	const s = planStatus(planDir);
	if (json) {
		emit(s);
	} else if (!s.exists) {
		console.log(pc.dim("no visual artifact for this plan"));
	} else {
		const c = s.coverage;
		console.log(
			`${s.valid ? pc.green("valid") : pc.red("invalid")} · rev ${s.revision} · review ${pc.bold(s.reviewStatus ?? "?")}` +
				(c ? ` · coverage ${c.resolved}/${c.planned}/${c.omitted}/${c.unresolved} (R/P/O/U)` : "") +
				(s.errorCount ? ` · ${s.errorCount} error(s)` : ""),
		);
	}
	// Contract violation exits non-zero (phase Requirements). An absent artifact
	// is NOT a violation — nothing to gate on — so it stays 0.
	process.exitCode = s.exists && !s.valid ? 1 : 0;
}

function runApprove(planDir: string, revisionArg: string | number | undefined, json: boolean): void {
	const raw = String(revisionArg ?? "");
	// Strict: reject trailing garbage / floats rather than silently coercing
	// (e.g. "3abc" or "3.5"). Approval is pinned to an exact revision.
	if (!/^\d+$/.test(raw)) {
		console.error(pc.red("approve requires --revision <n> (non-negative integer)"));
		process.exitCode = 2;
		return;
	}
	const revision = parseInt(raw, 10);
	const r = approvePlan(planDir, revision);
	if (json) {
		emit(r);
	} else if (r.ok) {
		console.log(`${pc.green("✓")} approved revision ${revision}`);
	} else {
		console.error(`${pc.red("✗")} approval refused (${r.failedPreconditions.length} precondition(s)):`);
		for (const p of r.failedPreconditions) console.error(`  ${pc.red("✗")} ${p}`);
	}
	process.exitCode = r.ok ? 0 : 1;
}

function runExport(planDir: string, format: string | undefined, json: boolean): void {
	if (format !== undefined && format !== "html") {
		console.error(pc.red(`export --format ${format} not supported (only 'html')`));
		process.exitCode = 2;
		return;
	}
	const r = exportPlanHtml(planDir);
	if (!r.ok || !r.html) {
		if (json) emit(r);
		else console.error(`${pc.red("✗")} export failed — ${r.error ?? "unknown"}`);
		process.exitCode = 1;
		return;
	}
	const out = path.join(planDir, "plan.html");
	atomicWriteFileSync(out, r.html);
	if (json) emit({ ok: true, path: out });
	else console.log(`${pc.green("✓")} exported ${out}`);
	process.exitCode = 0;
}

function runRehash(planDir: string, json: boolean): void {
	const r = rehashPlan(planDir);
	if (json) {
		emit(r);
	} else if (r.ok) {
		console.log(`${pc.green("✓")} source hashes refreshed${r.clearedApproval ? pc.yellow(" — prior approval cleared") : ""}`);
	} else {
		printErrors(r.errors);
	}
	process.exitCode = r.ok ? 0 : 1;
}

/** Dispatch a `visual-plan` subcommand. Returns a promise for the long-running studio commands. */
export function visualPlanCommand(args: VisualPlanCliArgs): void | Promise<void> {
	const sub = args.subcommand;
	// Long-running studio commands (own their plan-dir resolution + browser lifecycle).
	if (sub === "edit" || sub === "view") {
		return runStudio({ mode: sub, planDir: args.planDir, open: args.open, noOpen: args.noOpen, force: args.force, port: args.port });
	}
	const known = new Set(["validate", "status", "approve", "rehash", "export"]);
	if (!sub || !known.has(sub)) {
		console.error(pc.red(`visual-plan: expected one of validate|status|approve|rehash|export|edit|view (got ${sub ?? "nothing"})`));
		process.exitCode = 2;
		return;
	}
	if (!args.planDir) {
		console.error(pc.red(`visual-plan ${sub}: missing <plan-dir>`));
		process.exitCode = 2;
		return;
	}
	let planDir: string;
	try {
		planDir = resolvePlanDir(args.planDir);
	} catch (e) {
		console.error(pc.red(e instanceof PlanPathError ? e.message : String(e)));
		process.exitCode = 2;
		return;
	}
	const json = args.json === true;
	if (sub === "validate") runValidate(planDir, json);
	else if (sub === "status") runStatus(planDir, json);
	else if (sub === "approve") runApprove(planDir, args.revision, json);
	else if (sub === "export") runExport(planDir, args.format, json);
	else runRehash(planDir, json);
}
