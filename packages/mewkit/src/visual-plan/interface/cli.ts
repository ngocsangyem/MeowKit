/**
 * `mewkit visual-plan <subcommand>` dispatch + reporter.
 *
 * Subcommands: validate | status | approve | rehash | export | prepare-feedback
 * (sync) and edit | view (long-running studio). Each resolves
 * the plan directory, runs the matching application function, and reports in
 * human or `--json` form. Exit codes: 0 ok, 1 contract/precondition failure,
 * 2 usage/path error. Sets `process.exitCode` (never calls `process.exit`) so
 * the surface stays unit-testable.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import { validatePlan } from "../application/validate-plan.js";
import { planStatus } from "../application/status.js";
import { approvePlan } from "../application/approve.js";
import { rehashPlan } from "../application/rehash.js";
import { exportPlanHtml } from "../application/export-plan.js";
import { prepareFeedback } from "../application/prepare-feedback.js";
import { checkBatchFresh, recordResolution } from "../application/apply-feedback.js";
import { patchPlan } from "../application/patch-plan.js";
import { PatchOpSchema } from "../domain/patches.js";
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
	ops?: string;
	batch?: string;
	check?: boolean;
	receipt?: string;
	op?: string;
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

function readJsonFile(file: string): unknown {
	return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/** `patch <dir> --op <file>` — apply one typed visual op (single-writer; no If-Match). */
function runPatch(planDir: string, opFile: string | undefined, json: boolean): void {
	if (!opFile) {
		console.error(pc.red("patch requires --op <op.json> (a single typed patch op)"));
		process.exitCode = 2;
		return;
	}
	let opJson: unknown;
	try {
		opJson = readJsonFile(opFile);
	} catch (e) {
		console.error(pc.red(`could not read --op file: ${e instanceof Error ? e.message : String(e)}`));
		process.exitCode = 2;
		return;
	}
	const op = PatchOpSchema.safeParse(opJson);
	if (!op.success) {
		console.error(pc.red(`invalid patch op: ${op.error.issues[0]?.message ?? "schema"}`));
		process.exitCode = 2;
		return;
	}
	const r = patchPlan(planDir, op.data);
	if (json) emit(r);
	else if (r.status === "ok") console.log(`${pc.green("✓")} patched → revision ${r.revision}`);
	else console.error(`${pc.red("✗")} ${r.status}${r.message ? `: ${r.message}` : ""}`);
	process.exitCode = r.status === "ok" ? 0 : 1;
}

/** `apply-feedback <dir> --batch <id> [--check | --receipt <file>]` — deterministic loop mechanics. */
function runApplyFeedback(planDir: string, args: VisualPlanCliArgs, json: boolean): void {
	if (!args.batch) {
		console.error(pc.red("apply-feedback requires --batch <batch-id>"));
		process.exitCode = 2;
		return;
	}
	if (args.check) {
		const r = checkBatchFresh(planDir, args.batch);
		if (json) emit(r);
		else if (r.ok) console.log(`${pc.green("✓")} batch ${args.batch} is fresh — safe to apply`);
		else console.error(`${pc.red("✗")} ${r.stale ? "STALE" : "cannot apply"}: ${r.reason}`);
		process.exitCode = r.ok ? 0 : 1;
		return;
	}
	if (args.receipt) {
		let entries: unknown;
		try {
			entries = readJsonFile(args.receipt);
		} catch (e) {
			console.error(pc.red(`could not read --receipt file: ${e instanceof Error ? e.message : String(e)}`));
			process.exitCode = 2;
			return;
		}
		const r = recordResolution(planDir, args.batch, entries);
		if (json) emit(r);
		else if (r.ok) {
			console.log(`${pc.green("✓")} receipt written: ${r.receiptPath}`);
			console.log(`  reopen: ${pc.cyan(r.reopenCommand ?? "")}`);
		} else console.error(`${pc.red("✗")} ${r.error}`);
		process.exitCode = r.ok ? 0 : 1;
		return;
	}
	console.error(pc.red("apply-feedback requires --check (pre-apply gate) or --receipt <file> (record outcomes)"));
	process.exitCode = 2;
}

function runPrepareFeedback(planDir: string, opsFile: string | undefined, json: boolean): void {
	if (!opsFile) {
		console.error(pc.red("prepare-feedback requires --ops <operations.json> (a JSON array of feedback operations)"));
		process.exitCode = 2;
		return;
	}
	let operations: unknown;
	try {
		operations = JSON.parse(fs.readFileSync(opsFile, "utf-8"));
	} catch (e) {
		console.error(pc.red(`could not read --ops file: ${e instanceof Error ? e.message : String(e)}`));
		process.exitCode = 2;
		return;
	}
	if (!Array.isArray(operations)) {
		console.error(pc.red("--ops file must contain a JSON array of operations"));
		process.exitCode = 2;
		return;
	}
	const r = prepareFeedback(planDir, operations);
	if (json) {
		emit(r);
	} else if (r.ok) {
		console.log(`${pc.green("✓")} feedback batch ${pc.bold(r.batchId ?? "")}`);
		console.log(`  copy: ${pc.cyan(r.copyCommand ?? "")}`);
	} else {
		console.error(`${pc.red("✗")} ${r.error ?? "prepare failed"}`);
	}
	process.exitCode = r.ok ? 0 : 1;
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
	const known = new Set(["validate", "status", "approve", "rehash", "export", "prepare-feedback", "apply-feedback", "patch"]);
	if (!sub || !known.has(sub)) {
		console.error(pc.red(`visual-plan: expected one of validate|status|approve|rehash|export|prepare-feedback|apply-feedback|patch|edit|view (got ${sub ?? "nothing"})`));
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
	else if (sub === "prepare-feedback") runPrepareFeedback(planDir, args.ops, json);
	else if (sub === "apply-feedback") runApplyFeedback(planDir, args, json);
	else if (sub === "patch") runPatch(planDir, args.op, json);
	else runRehash(planDir, json);
}
