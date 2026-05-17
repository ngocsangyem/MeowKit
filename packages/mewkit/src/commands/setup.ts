import pc from "picocolors";
import { promptAndInstallSystemDeps } from "./setup-system-deps.js";
import { STEPS, type StepName, type StepResult } from "./setup-steps.js";

// Re-export public API so existing importers (doctor.ts, init.ts) keep working.
export { commandExists, installSystemDeps, promptAndInstallSystemDeps } from "./setup-system-deps.js";

/** Run setup steps. --only=<step> runs a single step. --system-deps installs system deps. */
export async function setup(args: { only?: string; systemDeps?: boolean }): Promise<void> {
	// --system-deps: standalone system dep install flow, skips normal steps
	if (args.systemDeps) {
		console.log(pc.bold("\nMeowKit Setup — System Dependencies\n"));
		await promptAndInstallSystemDeps();
		return;
	}

	// Always use cwd. No walk-up — avoids matching ~/.claude or parent projects.
	const dir = process.cwd();

	const stepsToRun: StepName[] = args.only ? [args.only as StepName] : (Object.keys(STEPS) as StepName[]);

	console.log(pc.bold("\nMeowKit Setup\n"));

	const results: StepResult[] = [];

	for (const stepName of stepsToRun) {
		const fn = STEPS[stepName];
		if (!fn) {
			console.error(pc.red(`Unknown step: ${stepName}. Available: ${Object.keys(STEPS).join(", ")}`));
			process.exit(1);
		}

		const result = await fn(dir);
		results.push(result);

		const icon =
			result.status === "pass"
				? pc.green("✓")
				: result.status === "skip"
					? pc.yellow("○")
					: result.status === "warn"
						? pc.yellow("!")
						: pc.red("✗");
		console.log(`  ${icon} ${pc.bold(stepName)}: ${result.message}`);
	}

	const passed = results.filter((r) => r.status === "pass").length;
	const skipped = results.filter((r) => r.status === "skip").length;
	const warned = results.filter((r) => r.status === "warn").length;
	const failed = results.filter((r) => r.status === "fail").length;

	const parts = [`${passed} configured`, `${skipped} skipped`];
	if (warned > 0) parts.push(`${warned} warnings`);
	if (failed > 0) parts.push(`${failed} failed`);
	console.log(`\n  ${pc.bold("Summary:")} ${parts.join(", ")}`);

	if (failed > 0) {
		process.exit(1);
	}
}
