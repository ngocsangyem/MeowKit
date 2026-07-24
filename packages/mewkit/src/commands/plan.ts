import path from "node:path";
import pc from "picocolors";
import { parsePlan, parsePhaseFile, REQUIRED_PHASE_SECTIONS, type PlanSummary } from "../core/plan-parser.js";

// `mewkit plan check|status` — READ-ONLY plan inspection.
//
// The plan Markdown is the sole authority. These commands read it and report;
// they never write. There is deliberately NO scaffold, edit, or set-status
// subcommand: the moment a CLI can mutate a plan, the plan has two authors and
// the checkboxes stop meaning what the human meant by them. Mutation would need
// its own plan proving planner authority, atomic writes, and rollback.
//
// Read-only is enforced by construction, not discipline: neither this module nor
// core/plan-parser.ts imports any write API.

export interface PlanArgs {
	subcommand?: string;
	target?: string;
	json?: boolean;
}

function pct(checked: number, total: number): string {
	if (total === 0) return "—";
	return `${Math.round((checked / total) * 100)}%`;
}

/** A compact progress bar. Purely presentational. */
function bar(checked: number, total: number, width = 20): string {
	if (total === 0) return pc.dim("─".repeat(width));
	const filled = Math.round((checked / total) * width);
	return pc.green("█".repeat(filled)) + pc.dim("░".repeat(width - filled));
}

/** Colorize a frontmatter status token without inventing new vocabulary. */
function statusTag(status: string | null): string {
	if (!status) return pc.dim("(no status)");
	const s = status.toLowerCase();
	if (s === "done" || s === "complete" || s === "completed") return pc.green(status);
	if (s === "in-progress" || s === "active" || s === "wip") return pc.yellow(status);
	if (s === "blocked") return pc.red(status);
	return pc.dim(status);
}

function renderStatus(summary: PlanSummary): void {
	console.log(pc.bold(pc.cyan(summary.title ?? path.basename(summary.dir))));
	console.log(`  ${pc.dim("plan:")}   ${summary.dir}`);
	console.log(`  ${pc.dim("status:")} ${statusTag(summary.status)}`);
	console.log();

	if (summary.phases.length > 0) {
		console.log(pc.bold("  Phases"));
		for (const p of summary.phases) {
			const c = p.checklist;
			const label = (p.title ?? p.file).slice(0, 58);
			console.log(
				`    ${bar(c.checked, c.total, 14)} ${String(pct(c.checked, c.total)).padStart(4)} ` +
					`${pc.dim(`${c.checked}/${c.total}`.padStart(6))}  ${label}`,
			);
			console.log(`      ${pc.dim(p.file)} · ${statusTag(p.status)}`);
		}
		console.log();
	}

	const a = summary.checklist;
	console.log(
		`  ${pc.bold("Overall")}  ${bar(a.checked, a.total)} ${pct(a.checked, a.total)} ${pc.dim(`(${a.checked}/${a.total} boxes)`)}`,
	);

	// Checkboxes record what a human ticked. Saying so keeps the number honest —
	// it is a claim about the plan file, not about the code.
	console.log(pc.dim("  Progress is what the plan's checkboxes say, not a verification of the work."));

	if (summary.issues.length > 0) {
		console.log();
		console.log(pc.bold(pc.yellow(`  Observations (${summary.issues.length})`)));
		for (const i of summary.issues) console.log(pc.yellow(`    • ${i}`));
	}
}

function renderCheck(file: string): number {
	const phase = parsePhaseFile(file);
	const ok = phase.missingSections.length === 0;

	console.log(pc.bold(pc.cyan(phase.title ?? phase.file)));
	console.log(`  ${pc.dim("file:")}   ${file}`);
	console.log(`  ${pc.dim("status:")} ${statusTag(phase.status)}`);
	if (phase.dependencies.length > 0) console.log(`  ${pc.dim("deps:")}   ${phase.dependencies.join(", ")}`);
	console.log(
		`  ${pc.dim("tasks:")}  ${phase.checklist.checked}/${phase.checklist.total} ${pc.dim(`(${pct(phase.checklist.checked, phase.checklist.total)})`)}`,
	);
	console.log();

	console.log(pc.bold("  Required sections"));
	for (const req of REQUIRED_PHASE_SECTIONS) {
		const present = !phase.missingSections.includes(req);
		console.log(`    ${present ? pc.green("✓") : pc.red("✗")} ${req}`);
	}

	if (!ok) {
		console.log();
		console.log(pc.red(`  Missing: ${phase.missingSections.join(", ")}`));
		console.log(pc.dim("  A phase file must be executable from a cold read — see documentation-management.md."));
	}
	return ok ? 0 : 1;
}

const USAGE = `Usage:
  mewkit plan status <plan-dir>    Progress across plan.md + phase files (read-only)
  mewkit plan check <phase-file>   Required-section + checklist report for one phase (read-only)
  mewkit plan approve <plan-dir>   Stamp the Gate 1 approval receipt (mutating)
  mewkit plan archive <plan-dir>   Mark statuses completed + move to tasks/plans/archive/ (mutating)

status/check are read-only by design: the plan Markdown stays the sole authority
here, and this module imports no write API. The mutating siblings (approve,
archive) live in their own modules. HTML rendering lives in \`mewkit visual-plan\`.`;

export async function plan(args: PlanArgs): Promise<void> {
	const { subcommand, target } = args;

	if (!subcommand || !["status", "check"].includes(subcommand)) {
		console.log(USAGE);
		process.exitCode = subcommand ? 1 : 0;
		return;
	}
	if (!target) {
		console.log(pc.red(`plan ${subcommand}: missing ${subcommand === "status" ? "<plan-dir>" : "<phase-file>"}`));
		process.exitCode = 1;
		return;
	}

	const resolved = path.resolve(target);

	try {
		if (subcommand === "check") {
			const code = renderCheck(resolved);
			if (args.json) {
				console.log(JSON.stringify(parsePhaseFile(resolved), null, 2));
			}
			process.exitCode = code;
			return;
		}

		const summary = parsePlan(resolved);
		if (args.json) {
			console.log(JSON.stringify(summary, null, 2));
		} else {
			renderStatus(summary);
		}
		// `status` reports; it does not judge. A plan with observations is not a
		// failed command — exit non-zero only when the plan could not be read.
		process.exitCode = 0;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.log(pc.red(`plan ${subcommand}: ${msg}`));
		process.exitCode = 1;
	}
}
