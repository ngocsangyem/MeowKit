import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { buildIndex, queryIndex, queryByTask, queryPresets } from "../core/derived-index.js";

// `mewkit index` / `mewkit query` — the opt-in derived SQLite index over the append logs.
// Build is explicit (never automatic, no hook). Query is read-only. Both advisory: exit 0,
// no gate. The DB is disposable — the logs remain canonical.

interface IndexOptions {
	json?: boolean;
	/** `mewkit query --task <id>` — task-joined evidence + plan linkage instead of aggregates. */
	task?: string;
	/** `mewkit query --presets` — the recovery-measurement presets over orient/transition events. */
	presets?: boolean;
}

function findClaudeDir(): string | null {
	let cur = process.cwd();
	for (;;) {
		const candidate = path.join(cur, ".claude");
		if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
		const parent = path.dirname(cur);
		if (parent === cur) return null;
		cur = parent;
	}
}

export function indexCommand(opts: IndexOptions = {}): void {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory."));
		process.exit(0);
	}
	const result = buildIndex(claudeDir);
	if (opts.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan("Derived index rebuilt")) + pc.dim(" (logs + wiki tree unchanged — canonical)"));
	console.log(`  ${pc.dim(result.dbPath)}`);
	console.log(`  schema v${result.schemaVersion} · ${result.traceRows} trace row(s) · ${result.costRows} cost row(s)`);
	console.log(
		`  wiki: ${result.wiki.pages} page(s) · ${result.wiki.candidates} candidate(s) · ${result.wiki.sources} source(s)`,
	);
}

export function queryCommand(opts: IndexOptions = {}): void {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory."));
		process.exit(0);
	}

	// Task-joined query: `mewkit query --task <id>` returns one task's evidence + plan linkage.
	if (opts.task) {
		let taskResult;
		try {
			taskResult = queryByTask(claudeDir, opts.task);
		} catch {
			console.log(pc.dim("No derived index yet — run `mewkit index` first (opt-in)."));
			return;
		}
		if (opts.json) {
			console.log(JSON.stringify(taskResult, null, 2));
			return;
		}
		console.log(
			pc.bold(pc.cyan(`Task evidence — ${taskResult.taskId}`)) +
				pc.dim(` (read-only, schema v${taskResult.schemaVersion})`),
		);
		if (taskResult.plans.length) console.log(pc.dim(`  plan: ${taskResult.plans.join(", ")}`));
		if (taskResult.events.length === 0) {
			console.log(pc.dim("  no task-joined events (unknown task, or index predates task ids)."));
			return;
		}
		for (const e of taskResult.events)
			console.log(`  ${pc.dim(e.ts ?? "?")}  ${e.event ?? "?"}${e.run_id ? pc.dim(` [${e.run_id}]`) : ""}`);
		return;
	}

	// Recovery-measurement presets: `mewkit query --presets`.
	if (opts.presets) {
		let presets;
		try {
			presets = queryPresets(claudeDir);
		} catch {
			console.log(pc.dim("No derived index yet — run `mewkit index` first (opt-in)."));
			return;
		}
		if (opts.json) {
			console.log(JSON.stringify(presets, null, 2));
			return;
		}
		console.log(pc.bold(pc.cyan("Recovery measurement")) + pc.dim(` (read-only, schema v${presets.schemaVersion})`));
		console.log(pc.bold("  Recovery outcomes:"));
		for (const r of presets.recoveryOutcomes) console.log(`    ${r.n}× ${r.outcome}`);
		if (presets.recoveryOutcomes.length === 0) console.log(pc.dim("    (no orient runs recorded)"));
		console.log(
			`  Stale-warning frequency: ${presets.staleWarnings.runsWithStale}/${presets.staleWarnings.totalRuns} orient run(s)`,
		);
		console.log(
			`  Transitions missing task context: ${presets.transitionsMissingTask.missing}/${presets.transitionsMissingTask.total}`,
		);
		if (presets.verificationRuns.length > 0) {
			console.log(pc.bold("  Verification runs by task:"));
			for (const v of presets.verificationRuns) console.log(`    ${v.runs}× ${v.taskId}`);
		}
		return;
	}

	let result;
	try {
		result = queryIndex(claudeDir);
	} catch {
		console.log(pc.dim("No derived index yet — run `mewkit index` first (opt-in)."));
		return; // advisory: missing index is not an error
	}
	if (opts.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan(`Derived index query`)) + pc.dim(` (read-only, schema v${result.schemaVersion})`));
	console.log(pc.bold("  Events by type:"));
	for (const r of result.eventsByType.slice(0, 12)) console.log(`    ${r.n}× ${r.event}`);
	if (result.eventsByType.length === 0) console.log(pc.dim("    (none)"));
	if (result.frictionByResponsibility.length > 0) {
		console.log(pc.bold("  Friction by responsibility:"));
		for (const r of result.frictionByResponsibility) console.log(`    ${r.n}× ${r.responsibility}`);
	}
	if (result.costByModel.length > 0) {
		console.log(pc.bold("  Cost by model:"));
		for (const r of result.costByModel.slice(0, 12))
			console.log(`    ${r.model || "(unknown)"}: ${r.entries} entr(ies), ${r.tokens} tokens`);
	}
}
