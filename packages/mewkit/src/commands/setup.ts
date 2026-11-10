import pc from "picocolors";
import { promptAndInstallSystemDeps } from "./setup-system-deps.js";
import { STEPS, type StepName, type StepResult } from "./setup-steps.js";
import {
	beginMachineOutput,
	endMachineOutput,
	printMutationJson,
	type MutationReport,
	type PlannedChange,
} from "../core/mutation-report.js";

// Re-export public API so existing importers (doctor.ts, init.ts) keep working.
export { commandExists, installSystemDeps, promptAndInstallSystemDeps } from "./setup-system-deps.js";

export interface SetupArgs {
	only?: string;
	systemDeps?: boolean;
	skills?: string;
	/** Plan only: every step reports what it would write and writes none of it. */
	dryRun?: boolean;
	/** Print the one mutation envelope on stdout instead of the step lines. */
	json?: boolean;
}

const ICON: Record<StepResult["status"], string> = {
	pass: pc.green("✓"),
	skip: pc.yellow("○"),
	warn: pc.yellow("!"),
	fail: pc.red("✗"),
};

/** Run setup steps. --only=<step> runs a single step. --system-deps installs system deps. */
export async function setup(args: SetupArgs): Promise<void> {
	const dryRun = args.dryRun === true;
	// `--json` narrates on stderr for the whole run, so stdout carries the
	// envelope and nothing else.
	if (args.json === true) beginMachineOutput();
	const report: MutationReport = { ok: true, command: "setup", dryRun, planned: [], applied: [], notes: [] };
	const finish = (exitCode?: number): void => {
		if (args.json === true) {
			report.ok = exitCode === undefined || exitCode === 0;
			printMutationJson(report);
			endMachineOutput();
		}
		if (exitCode !== undefined && exitCode !== 0) process.exit(exitCode);
	};

	// --system-deps: standalone system dep install flow, skips normal steps
	if (args.systemDeps) {
		console.log(pc.bold("\nMeowKit Setup — System Dependencies\n"));
		if (dryRun) {
			// The installers are package managers writing outside the project; a
			// preview of them is a list this command cannot honestly produce, so it
			// says what it did not do rather than printing a plan it cannot keep.
			const note =
				"Dry-run: system dependencies are installed by your package manager — nothing was run. Drop --dry-run to install.";
			console.log(pc.yellow(note));
			report.notes.push(note);
			finish();
			return;
		}
		await promptAndInstallSystemDeps();
		finish();
		return;
	}

	// Always use cwd. No walk-up — avoids matching ~/.claude or parent projects.
	const dir = process.cwd();

	// Opt-in: with no --skills, the environment step creates nothing. Setup is
	// safe to run (and re-run) on a project that never wants an interpreter.
	const skills = (args.skills ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	const stepsToRun: StepName[] = args.only ? [args.only as StepName] : (Object.keys(STEPS) as StepName[]);

	console.log(pc.bold(dryRun ? "\nMeowKit Setup — dry run, nothing will be written\n" : "\nMeowKit Setup\n"));

	const results: StepResult[] = [];

	for (const stepName of stepsToRun) {
		const fn = STEPS[stepName];
		if (!fn) {
			const error = `Unknown step: ${stepName}. Available: ${Object.keys(STEPS).join(", ")}`;
			console.error(pc.red(error));
			report.error = error;
			report.fix = `Pass one of: ${Object.keys(STEPS).join(", ")}`;
			finish(1);
			return;
		}

		const result = await fn(dir, { skills, dryRun });
		results.push(result);
		const changes: PlannedChange[] = result.changes ?? [];
		report.planned.push(...changes);
		if (!dryRun) report.applied.push(...changes);
		report.notes.push(`${stepName}: ${result.status} — ${result.message}`);

		console.log(`  ${ICON[result.status]} ${pc.bold(stepName)}: ${result.message}`);
		for (const change of changes) {
			const detail = change.detail === undefined ? "" : pc.dim(` (${change.detail})`);
			console.log(`      ${pc.dim(dryRun ? "would" : "did")} ${change.action} ${change.path}${detail}`);
		}
	}

	const count = (status: StepResult["status"]): number => results.filter((r) => r.status === status).length;
	const parts = [`${count("pass")} configured`, `${count("skip")} skipped`];
	if (count("warn") > 0) parts.push(`${count("warn")} warnings`);
	if (count("fail") > 0) parts.push(`${count("fail")} failed`);
	console.log(`\n  ${pc.bold("Summary:")} ${parts.join(", ")}`);

	finish(count("fail") > 0 ? 1 : 0);
}
