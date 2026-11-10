/**
 * Structural validation of a plan directory: `plan.md` plus every sibling
 * `phase-*.md`.
 *
 * This is the check the planning flow runs before presenting Gate 1, which is
 * why it runs here and not in a language the project may not have installed: a
 * mandatory gate step that only works where an interpreter happens to exist is a
 * gate that silently stops being mandatory.
 *
 * The verdict line is a stable marker — `PLAN_COMPLETE` or `PLAN_INCOMPLETE` —
 * because callers match on it rather than on an exit code alone.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { checkPhaseFile, parseFrontmatter, sectionBody } from "./plan-phase-structure.js";

const PLAN_REQUIRED_SECTIONS = ["## Goal"] as const;
const PLAN_REQUIRED_FRONTMATTER = ["title", "type", "status", "priority"] as const;

/** `handoff.next` is enum-validated when the optional `handoff:` block is present. */
const HANDOFF_NEXT_VALID = ["autobuild", "cook", "end", "red-team", "validate"] as const;

/** A goal is an outcome, so it must not open with an activity verb. */
const ACTIVITY_VERBS = ["implement", "create", "build", "add", "write", "set up", "configure"] as const;

const MAX_PLAN_LINES = 100;

export interface PlanStructureReport {
	/** Every issue in print order; warnings carry a `WARN ` prefix. */
	issues: string[];
	warningCount: number;
	errorCount: number;
	phaseCount: number;
	complete: boolean;
}

function checkPlanFile(content: string): string[] {
	const issues: string[] = [];

	if (!content.startsWith("---")) {
		issues.push("plan.md: Missing YAML frontmatter");
	} else {
		const block = content.split("---")[1] ?? "";
		for (const field of PLAN_REQUIRED_FRONTMATTER) {
			if (!block.includes(`${field}:`)) issues.push(`plan.md: Missing frontmatter: ${field}`);
		}
	}

	const fm = content.startsWith("---") ? parseFrontmatter(content) : null;
	const handoff = fm?.handoff;
	if (typeof handoff === "object" && handoff !== null && !Array.isArray(handoff)) {
		const next = (handoff as Record<string, unknown>).next;
		if (next !== null && next !== undefined && !HANDOFF_NEXT_VALID.includes(String(next) as never)) {
			issues.push(`plan.md: handoff.next '${String(next)}' not in [${HANDOFF_NEXT_VALID.map((v) => `'${v}'`).join(", ")}]`);
		}
	}

	for (const section of PLAN_REQUIRED_SECTIONS) {
		if (!content.includes(section)) issues.push(`plan.md: Missing section: ${section}`);
	}

	const goal = sectionBody(content, "## Goal")?.trim().toLowerCase();
	if (goal) {
		const verb = ACTIVITY_VERBS.find((v) => goal.startsWith(v));
		if (verb) issues.push(`plan.md: Goal starts with activity verb '${verb}' — rewrite as outcome`);
	}

	const lineCount = content.trim().split("\n").length;
	if (lineCount > MAX_PLAN_LINES) {
		issues.push(`plan.md: ${lineCount} lines (max 80 recommended) — move detail to phase files`);
	}

	return issues;
}

function phaseFilesIn(dir: string): string[] {
	try {
		return readdirSync(dir)
			.filter((name) => name.startsWith("phase-") && name.endsWith(".md"))
			.sort();
	} catch {
		return [];
	}
}

/** Validate `plan.md` and every `phase-*.md` beside it. A plan directory names its `plan.md`. */
export function checkPlanStructure(planPath: string): PlanStructureReport {
	const given = path.resolve(planPath);
	const resolved = existsSync(given) && statSync(given).isDirectory() ? path.join(given, "plan.md") : given;
	if (!existsSync(resolved)) {
		return { issues: [`File not found: ${planPath}`], warningCount: 0, errorCount: 1, phaseCount: 0, complete: false };
	}

	const content = readFileSync(resolved, "utf-8");
	const issues = checkPlanFile(content);
	const planDir = path.dirname(resolved);
	const phaseFiles = phaseFilesIn(planDir);

	for (const name of phaseFiles) {
		issues.push(...checkPhaseFile(readFileSync(path.join(planDir, name), "utf-8"), name));
	}
	for (const name of phaseFiles) {
		if (!content.includes(name)) issues.push(`plan.md: Phase file '${name}' exists but not linked in plan`);
	}

	// Only a non-WARN issue fails the plan. Legacy issues carry no prefix and
	// still count as errors, so an older caller's expectations do not change.
	const warningCount = issues.filter((i) => i.startsWith("WARN ")).length;
	const errorCount = issues.length - warningCount;
	return { issues, warningCount, errorCount, phaseCount: phaseFiles.length, complete: errorCount === 0 };
}

/** The report's printable lines, verdict marker first. */
export function renderPlanStructure(report: PlanStructureReport): string[] {
	const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;
	if (!report.complete) {
		return [
			`PLAN_INCOMPLETE: ${report.errorCount} error(s), ${report.warningCount} warning(s)`,
			...report.issues.map((i) => `  - ${i}`),
		];
	}
	const suffix = report.warningCount > 0 ? ` (${report.warningCount} ${plural(report.warningCount, "warning")})` : "";
	return [
		`PLAN_COMPLETE (${report.phaseCount} ${plural(report.phaseCount, "phase file")} validated)${suffix}`,
		...report.issues.filter((i) => i.startsWith("WARN ")).map((i) => `  - ${i}`),
	];
}
