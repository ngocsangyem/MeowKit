import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
	runScenario,
	loadScenarioByName,
	listScenarios,
	hasHarness,
	type ScenarioResult,
	type SimStatus,
} from "../core/simulation-runner.js";

/**
 * `mewkit simulate` — run declarative given→when→expect scenarios against a scaffolded
 * temp harness via the real configured hooks. Generalizes the `doctor --hard-gates`
 * probes into data-driven `.claude/simulations/*.yaml`.
 */

export interface SimulateOptions {
	scenario?: string;
	all?: boolean;
	json?: boolean;
	/** Downgrade SKIP from a failure to a pass (off by default — a SKIP means not exercised). */
	allowSkip?: boolean;
}

function findClaudeDir(): string | null {
	const candidate = path.join(process.cwd(), ".claude");
	return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : null;
}

function chip(status: SimStatus): string {
	if (status === "PASS") return pc.green("PASS");
	if (status === "FAIL") return pc.red("FAIL");
	return pc.yellow("SKIP");
}

function renderResult(result: ScenarioResult): void {
	console.log(`  [${chip(result.status)}] ${pc.bold(result.name)}`);
	for (const step of result.steps) {
		console.log(`         ${chip(step.status)}  ${pc.dim(`${step.detail} — expected: ${step.expected}; actual: ${step.actual}`)}`);
	}
}

export async function simulate(opts: SimulateOptions = {}): Promise<void> {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory in the current directory."));
		process.exit(1);
	}
	const srcRoot = path.dirname(claudeDir);

	if (process.platform === "win32") {
		console.error(pc.yellow("simulate is skipped on Windows — POSIX shell hooks cannot be probed here."));
		return;
	}
	if (!hasHarness(srcRoot)) {
		console.error(pc.red("No .claude/settings.json + hooks/ found; nothing to simulate."));
		process.exit(1);
	}

	let names: string[];
	if (opts.all) {
		names = listScenarios(srcRoot);
		if (names.length === 0) {
			console.error(pc.red("No scenarios found in .claude/simulations/."));
			process.exit(1);
		}
	} else if (opts.scenario) {
		names = [opts.scenario];
	} else {
		console.error(pc.red("Specify --scenario <name> or --all."));
		console.log(pc.dim(`Available: ${listScenarios(srcRoot).join(", ") || "(none)"}`));
		process.exit(1);
	}

	const results: ScenarioResult[] = [];
	for (const name of names) {
		try {
			results.push(runScenario(loadScenarioByName(srcRoot, name), srcRoot));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			results.push({
				name,
				status: "FAIL",
				steps: [{ status: "FAIL", detail: `Scenario load/run error: ${message}`, expected: "loadable scenario", actual: "error" }],
			});
		}
	}

	const counts = { PASS: 0, FAIL: 0, SKIP: 0 };
	for (const r of results) counts[r.status]++;

	if (opts.json) {
		console.log(JSON.stringify({ results, summary: counts }, null, 2));
	} else {
		console.log(pc.bold(pc.cyan("MeowKit simulate — scenario results")));
		console.log();
		for (const r of results) renderResult(r);
		console.log();
		console.log(`${pc.green(`${counts.PASS} PASS`)} / ${pc.red(`${counts.FAIL} FAIL`)} / ${pc.yellow(`${counts.SKIP} SKIP`)}`);
	}

	const skipIsFailure = !opts.allowSkip;
	const failed = counts.FAIL > 0 || (skipIsFailure && counts.SKIP > 0);
	if (failed) process.exit(1);
}
