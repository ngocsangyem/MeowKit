import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { activateTask, ActivationError, normalizeTaskId } from "../core/task-record.js";
import { appendTraceRecord } from "../core/trace-append.js";
import { readInstallMetadata } from "../core/install-metadata.js";

// `mewkit plan approve <plan-dir|plan.md> [--by <approver>]` — stamp the Gate 1
// approval receipt onto a plan after a human has approved it.
//
// This is a MUTATION and deliberately lives OUTSIDE plan.ts, which is read-only
// by construction (it imports no write API). Keeping the two apart preserves that
// guarantee: `plan status`/`plan check` still cannot write, and approval is a
// separate, explicitly-named command.
//
// The hash + frontmatter surgery live in the pure-sh helper
// `.claude/hooks/lib/approval-receipt.sh` — the SAME file the shell Gate 1 hook
// uses to VERIFY. Shelling out to it (rather than reimplementing the hash in TS)
// is what guarantees the writer and the verifier can never drift. Anti-accidental
// per ADR 260715: this records "an approval was stamped against this plan
// revision", NOT a host-authenticated "a human approved" — the agent must only run
// it after a real human approval (intervention-recording-rules.md Rule 3).

export interface PlanApproveArgs {
	/** Plan directory or a plan.md path. */
	target?: string;
	/** Recorded in the receipt as `approved_by`. */
	by?: string;
	/** Opt out of durable activation (approval-only). Activation is on by default. */
	noActivate?: boolean;
	/** Invoking CLI version, for record provenance. */
	cliVersion?: string;
}

/** Best-effort installed kit version (provenance only). */
function kitVersion(projectRoot: string): string {
	try {
		return readInstallMetadata(path.join(projectRoot, ".claude")).meta?.version ?? "";
	} catch {
		return "";
	}
}

/**
 * Durably activate the plan as a task: write the active record + canonical pointer, then emit an
 * advisory transition trace. Stamp and activation are SEPARATE facts — a failure here does not
 * un-stamp the receipt, but it MUST exit non-zero and never claim activation succeeded.
 */
async function activatePlan(planFile: string, cliVersion: string | undefined): Promise<boolean> {
	const projectRoot = process.cwd();
	const planPath = path.relative(projectRoot, planFile) || planFile;
	const planSlug = path.basename(path.dirname(planFile));
	const taskId = normalizeTaskId(planSlug);
	try {
		const result = await activateTask(projectRoot, {
			taskId,
			planPath,
			planSlug,
			now: new Date().toISOString(),
			cliVersion,
			kitVersion: kitVersion(projectRoot),
			nextAction: "begin approved plan",
		});
		console.log(pc.green(`✓ Activated task ${pc.bold(taskId)} → tasks/active/${taskId}.json (+ active pointer).`));
		// Transition trace is advisory: a failed append never fails an already-durable activation.
		try {
			await appendTraceRecord(path.join(projectRoot, ".claude"), {
				event: "task_transition",
				taskId,
				planPath,
				data: { status: "active", trigger: "plan-approve", createdRecord: result.createdRecord },
			});
		} catch (emitErr) {
			console.log(pc.yellow(`⚠ activated, but transition trace emission failed: ${(emitErr as Error).message}`));
		}
		return true;
	} catch (err) {
		if (err instanceof ActivationError) {
			console.log(
				pc.red(
					`✗ Activation FAILED for task ${pc.bold(err.taskId)} — approval was stamped, but this task is NOT active.`,
				),
			);
			console.log(
				err.rolledBack
					? pc.dim("  The partial record was rolled back. Re-run `mewkit plan approve` after resolving the cause.")
					: pc.yellow(
							`  A partial record may remain at tasks/active/${err.taskId}.json — inspect and repair before re-approving.`,
						),
			);
			console.log(pc.dim(`  cause: ${err.message}`));
			return false;
		}
		throw err;
	}
}

/** Resolve a plan.md from either a directory or a direct file path. */
function resolvePlanFile(target: string): string {
	const resolved = path.resolve(target);
	if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
		return path.join(resolved, "plan.md");
	}
	return resolved;
}

export async function planApprove(args: PlanApproveArgs): Promise<void> {
	const { target } = args;
	if (!target) {
		console.log(pc.red("plan approve: missing <plan-dir> or <plan.md>"));
		console.log(pc.dim("Usage: mewkit plan approve <plan-dir|plan.md> [--by <approver>]"));
		process.exitCode = 1;
		return;
	}

	const planFile = resolvePlanFile(target);
	if (!fs.existsSync(planFile)) {
		console.log(pc.red(`plan approve: plan file not found: ${planFile}`));
		process.exitCode = 1;
		return;
	}

	// The receipt helper is shipped under .claude/hooks/lib/. It is resolved relative
	// to the project root (cwd), matching where the Gate 1 hook reads it from.
	const helper = path.resolve(".claude/hooks/lib/approval-receipt.sh");
	if (!fs.existsSync(helper)) {
		console.log(pc.red(`plan approve: approval-receipt helper not found at ${helper}`));
		console.log(pc.dim("This project may predate the receipt mechanism — reinstall .claude/ hooks."));
		process.exitCode = 1;
		return;
	}

	const approver = typeof args.by === "string" && args.by.trim().length > 0 ? args.by.trim() : gitUserOrHuman();

	try {
		const out = execFileSync("sh", [helper, "stamp", planFile, approver], { encoding: "utf8" });
		process.stdout.write(out);
		console.log(pc.green("✓ Gate 1 approval receipt stamped."));
		console.log(
			pc.dim(
				"Anti-accidental: this records an approval against THIS plan revision, not a host-authenticated human approval. Editing the plan body invalidates it (re-approval required).",
			),
		);
		// Durable activation is on by default; --no-activate is the explicit opt-out. A failed
		// activation exits non-zero without claiming success (the receipt stays stamped either way).
		if (args.noActivate) {
			console.log(pc.dim("Skipped durable activation (--no-activate)."));
			process.exitCode = 0;
		} else {
			const activated = await activatePlan(planFile, args.cliVersion);
			process.exitCode = activated ? 0 : 1;
		}
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.log(pc.red(`plan approve: failed to stamp receipt — ${msg}`));
		process.exitCode = 1;
	}
}

/** Best-effort approver identity: git user.email, else "human". Never fabricates. */
function gitUserOrHuman(): string {
	try {
		const email = execFileSync("git", ["config", "user.email"], { encoding: "utf8" }).trim();
		if (email.length > 0) return email;
	} catch {
		// no git identity configured — fall through
	}
	return "human";
}
