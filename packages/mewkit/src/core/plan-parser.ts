// Shared read-only parser for the canonical plan shape.
//
//   tasks/plans/YYMMDD-name/
//     plan.md              — overview, ≤80 lines (gate-rules.md → Plan Shape)
//     phase-XX-name.md     — the executable detail
//
// READ-ONLY BY CONSTRUCTION. This module imports `readFileSync`/`existsSync` and
// nothing that writes — no `writeFileSync`, no `mkdirSync`, no `rmSync`. That is
// the enforcement, not a convention: the plan Markdown is the sole authority, and
// a CLI that could edit it would become a second one. Checkboxes are the progress
// record; this reads them and says what it sees.
//
// It reports what the files SAY. It does not judge whether a phase is truly done
// — an unchecked box on finished work and a checked box on unfinished work are
// both real states the plan owner reconciles, not the parser.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** Required sections in a phase file (documentation-management.md → Phase Files). */
export const REQUIRED_PHASE_SECTIONS = [
	"Overview",
	"Requirements",
	"Implementation Steps",
	"Success Criteria",
	"Risk Assessment",
] as const;

export interface PhaseChecklist {
	total: number;
	checked: number;
}

export interface PhaseFile {
	file: string; // basename
	title: string | null;
	status: string | null; // frontmatter `status:`
	phase: string | null;
	dependencies: string[];
	sections: string[]; // `## ` headings present
	missingSections: string[];
	checklist: PhaseChecklist;
}

export interface PlanSummary {
	dir: string;
	title: string | null;
	status: string | null;
	planMdPresent: boolean;
	planMdLines: number;
	phases: PhaseFile[];
	/** Aggregate across every phase file. */
	checklist: PhaseChecklist;
	issues: string[];
}

/** Extract the YAML frontmatter block as raw lines, or [] when absent. */
function frontmatterLines(body: string): string[] {
	if (!body.startsWith("---")) return [];
	const end = body.indexOf("\n---", 3);
	if (end === -1) return [];
	return body.slice(4, end).split("\n");
}

/** A scalar frontmatter field. Quotes stripped; nothing clever — plans are hand-written. */
function field(fm: string[], key: string): string | null {
	const line = fm.find((l) => l.trimStart().startsWith(`${key}:`));
	if (!line) return null;
	const raw = line.slice(line.indexOf(":") + 1).trim();
	return raw.replace(/^["']|["']$/g, "") || null;
}

/** An inline-array frontmatter field (`dependencies: [1, 2]`). */
function arrayField(fm: string[], key: string): string[] {
	const raw = field(fm, key);
	if (!raw) return [];
	const inner = raw.replace(/^\[|\]$/g, "").trim();
	if (!inner) return [];
	return inner
		.split(",")
		.map((s) => s.trim().replace(/^["']|["']$/g, ""))
		.filter(Boolean);
}

/** Count `- [ ]` / `- [x]` task boxes. */
function checklist(body: string): PhaseChecklist {
	const boxes = body.match(/^\s*[-*]\s+\[[ xX]\]/gm) ?? [];
	const checked = boxes.filter((b) => /\[[xX]\]/.test(b)).length;
	return { total: boxes.length, checked };
}

/** Parse one phase file. Throws only if the file is unreadable. */
export function parsePhaseFile(abs: string): PhaseFile {
	const body = readFileSync(abs, "utf-8");
	const fm = frontmatterLines(body);
	const sections = (body.match(/^##\s+(.+)$/gm) ?? []).map((h) => h.replace(/^##\s+/, "").trim());

	// A heading matches when the required name appears in it — real plans write
	// "## Risk Assessment" but also "## Success Criteria (Phase 2)".
	const missingSections = REQUIRED_PHASE_SECTIONS.filter(
		(req) => !sections.some((s) => s.toLowerCase().includes(req.toLowerCase())),
	);

	return {
		file: path.basename(abs),
		title: field(fm, "title"),
		status: field(fm, "status"),
		phase: field(fm, "phase"),
		dependencies: arrayField(fm, "dependencies"),
		sections,
		missingSections,
		checklist: checklist(body),
	};
}

/** Phase files in a plan dir, sorted by filename (which encodes phase order). */
export function listPhaseFiles(planDir: string): string[] {
	if (!existsSync(planDir) || !statSync(planDir).isDirectory()) return [];
	return readdirSync(planDir)
		.filter((f) => /^phase-\d+.*\.md$/.test(f))
		.sort()
		.map((f) => path.join(planDir, f));
}

/**
 * Parse a plan directory into a summary.
 *
 * `issues` names what a reader should know before trusting the numbers — a
 * missing plan.md, an over-length overview, a phase with no checklist. They are
 * observations, not verdicts: this is an inspector, and Gate 1 belongs to the human.
 */
export function parsePlan(planDir: string): PlanSummary {
	const issues: string[] = [];
	const planMd = path.join(planDir, "plan.md");
	const planMdPresent = existsSync(planMd);

	let title: string | null = null;
	let status: string | null = null;
	let planMdLines = 0;

	if (planMdPresent) {
		const body = readFileSync(planMd, "utf-8");
		const fm = frontmatterLines(body);
		title = field(fm, "title");
		status = field(fm, "status");
		planMdLines = body.split("\n").length;
		// gate-rules.md → Plan Shape: "plan.md is the overview entrypoint and stays
		// under 80 lines". Reported, never enforced — the CLI does not gate.
		if (planMdLines > 80) issues.push(`plan.md is ${planMdLines} lines (overview should stay under 80)`);
	} else {
		issues.push("no plan.md — Gate 1 expects one at the plan root");
	}

	const phases = listPhaseFiles(planDir).map(parsePhaseFile);
	if (phases.length === 0) issues.push("no phase-XX-*.md files found");

	for (const p of phases) {
		if (p.missingSections.length > 0) {
			issues.push(`${p.file} is missing: ${p.missingSections.join(", ")}`);
		}
	}

	const aggregate = phases.reduce<PhaseChecklist>(
		(acc, p) => ({ total: acc.total + p.checklist.total, checked: acc.checked + p.checklist.checked }),
		{ total: 0, checked: 0 },
	);

	return { dir: planDir, title, status, planMdPresent, planMdLines, phases, checklist: aggregate, issues };
}
