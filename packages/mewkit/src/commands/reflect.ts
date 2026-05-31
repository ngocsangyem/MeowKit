import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { readEvents, type EventRecord } from "../core/event-log.js";

/**
 * `mewkit reflect` — retrospective over the canonical event log: what the harness
 * actually did (gates blocked, hooks failed, review outcomes, …). Pure consumer of
 * core/event-log.ts. Honesty rule dominates: metrics with no emitter or no derivable
 * pairing render `N/A`, never a fabricated zero.
 */

export interface ReflectOptions {
	/** Time window: `Nd` / `Nh` / ISO instant. */
	last?: string;
	task?: string;
	json?: boolean;
}

/** A label→count tally rendered as a sorted list. */
type Tally = Map<string, number>;

function bump(tally: Tally, key: string): void {
	tally.set(key, (tally.get(key) ?? 0) + 1);
}

function tallyToSorted(tally: Tally): Array<{ label: string; count: number }> {
	return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

function str(value: unknown, fallback = "?"): string {
	return typeof value === "string" && value.length > 0 ? value : fallback;
}

interface ReflectReport {
	window: string;
	totalEvents: number;
	malformed: number;
	gateBlocks: Array<{ label: string; count: number }>;
	privacyBlocks: Array<{ label: string; count: number }>;
	injectionBlocks: number;
	hookFailures: Array<{ label: string; count: number }>;
	reviewOutcomes: Array<{ label: string; count: number }>;
	/** slug → repeat count (>1 means the same review failed more than once). */
	repeatedReviewFailures: Array<{ label: string; count: number }>;
	/** Reserved event types with no emitter yet → reported as null (N/A). */
	skillsInvoked: Array<{ label: string; count: number }> | null;
	memoryWrites: number | null;
	/** Self-healing recovery is not emitted yet → N/A. */
	selfHealingAttempts: number | null;
	/** Lifecycle timings are not derivable without phase-transition events → N/A. */
	timings: null;
}

function aggregate(events: EventRecord[], malformed: number, window: string): ReflectReport {
	const gateBlocks: Tally = new Map();
	const privacyBlocks: Tally = new Map();
	const hookFailures: Tally = new Map();
	const reviewOutcomes: Tally = new Map();
	const reviewFailBySlug: Tally = new Map();
	let injectionBlocks = 0;

	for (const e of events) {
		switch (e.event) {
			case "gate.blocked":
				bump(gateBlocks, `${str(e.data.gate)} — ${str(e.data.reason, "")}`);
				break;
			case "privacy.blocked":
				bump(privacyBlocks, str(e.data.kind));
				break;
			case "injection.blocked":
				injectionBlocks++;
				break;
			case "hook.failed":
				bump(hookFailures, `${str(e.data.hook)} (${str(e.data.shell)}) exit ${str(String(e.data.exit_code), "?")}`);
				break;
			case "verdict_written": {
				const overall = str(e.data.overall).toUpperCase();
				bump(reviewOutcomes, overall);
				if (overall === "FAIL") bump(reviewFailBySlug, str(e.data.slug));
				break;
			}
			default:
				break;
		}
	}

	const repeatedReviewFailures = tallyToSorted(reviewFailBySlug).filter((r) => r.count > 1);

	return {
		window,
		totalEvents: events.length,
		malformed,
		gateBlocks: tallyToSorted(gateBlocks),
		privacyBlocks: tallyToSorted(privacyBlocks),
		injectionBlocks,
		hookFailures: tallyToSorted(hookFailures),
		reviewOutcomes: tallyToSorted(reviewOutcomes),
		repeatedReviewFailures,
		// Reserved — no emitter today (trace-schema.md). Never list/zero as if real.
		skillsInvoked: null,
		memoryWrites: null,
		selfHealingAttempts: null,
		timings: null,
	};
}

function findClaudeDir(): string | null {
	const candidate = path.join(process.cwd(), ".claude");
	return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : null;
}

const NA = pc.dim("N/A — usage events not emitted");

function renderList(title: string, rows: Array<{ label: string; count: number }>): void {
	console.log(pc.bold(title));
	if (rows.length === 0) {
		console.log(`  ${pc.dim("none in window")}`);
		return;
	}
	for (const { label, count } of rows) {
		console.log(`  ${pc.cyan(String(count).padStart(4))}  ${label}`);
	}
}

function renderText(report: ReflectReport): void {
	console.log(pc.bold(pc.cyan("MeowKit reflect — harness retrospective")));
	console.log(
		pc.dim(`Window: ${report.window} · ${report.totalEvents} events${report.malformed > 0 ? ` · ${report.malformed} malformed (skipped)` : ""}`),
	);
	if (report.window.includes("task ")) {
		// Honest caveat: gate/privacy/injection/hook events carry no data.task today,
		// so a task filter shows only workflow events — not gate/hook blocks.
		console.log(pc.dim("Note: --task matches workflow events only; gate/privacy/hook events are not task-tagged."));
	}
	console.log();

	if (report.totalEvents === 0) {
		console.log(pc.yellow("No events in window — nothing to reflect on yet."));
		console.log(pc.dim("The event log fills as the safety hooks block and the harness runs."));
		return;
	}

	renderList("Gate blocks (by gate · reason)", report.gateBlocks);
	console.log();
	renderList("Privacy blocks (by kind)", report.privacyBlocks);
	console.log();
	console.log(pc.bold("Injection blocks"));
	console.log(`  ${pc.cyan(String(report.injectionBlocks).padStart(4))}  prompt-injection (advisory)`);
	console.log();
	renderList("Hook failures (by hook · shell · exit)", report.hookFailures);
	console.log();
	renderList("Review outcomes (verdict_written)", report.reviewOutcomes);
	console.log();
	console.log(pc.bold("Repeated review failures"));
	if (report.repeatedReviewFailures.length === 0) {
		console.log(`  ${pc.dim("none repeated in window")}`);
	} else {
		for (const { label, count } of report.repeatedReviewFailures) {
			console.log(`  ${pc.yellow(`×${count}`)}  ${label}`);
		}
	}
	console.log();

	// Honest N/A panels — reserved/underivable metrics.
	console.log(pc.bold("Skills invoked") + `  ${NA}`);
	console.log(pc.bold("Memory writes") + `  ${NA}`);
	console.log(pc.bold("Self-healing attempts") + `  ${pc.dim("N/A — recovery events not emitted")}`);
	console.log(pc.bold("Lifecycle timings") + `  ${pc.dim("N/A — phase-transition events not emitted")}`);
}

export function reflect(opts: ReflectOptions = {}): void {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory in the current directory."));
		process.exit(1);
	}

	const { events, malformed } = readEvents(claudeDir, { since: opts.last, task: opts.task });
	const window = opts.last ? `last ${opts.last}${opts.task ? ` · task ${opts.task}` : ""}` : opts.task ? `task ${opts.task}` : "all";
	const report = aggregate(events, malformed, window);

	if (opts.json) {
		console.log(JSON.stringify(report, null, 2));
		return;
	}
	renderText(report);
}
