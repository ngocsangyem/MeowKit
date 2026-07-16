import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { CheckResult } from "../commands/validate.js";
import type { Status } from "../commands/doctor-checks.js";

// Workflow drift detector.
//
// `.claude/workflow.yaml` is the single source of truth for the lifecycle. This
// module parses it, then line-scans each prose file listed under `sources:` for
// tokens that CONTRADICT the spec: a phase id bound to the wrong name, a
// required-output path typo (tasks/review/ vs tasks/reviews/), an output glob
// bound to the wrong gate, an `applies_to` list that drops a phase, or a Reflect
// lead list that disagrees.
//
// Boundary (honest): this is a TOKEN/LINE detector, not a prose NLP parser. It
// guarantees phase names, gate-to-output binding, and required-output path
// patterns never disagree across files. It does NOT catch semantic wording
// contradictions that use no canonical token. That is the documented trade-off.

/** A single drift finding with enough context to locate and fix it. */
export interface Violation {
	file: string; // relative to project root
	line: number; // 1-based; 0 for whole-file/spec-level findings
	found: string;
	expected: string;
}

/** The canonical lifecycle, distilled from workflow.yaml into checkable sets. */
export interface CanonicalSpec {
	/** Every phase + substep name (Orient, Plan, ..., Simplify, Verify). */
	phaseNames: Set<string>;
	/** id (as written: "0".."6", "3.5", "3.6") → canonical name. */
	nameById: Map<string, string>;
	/** Integer phase ids that an `applies_to:` list must fully enumerate. */
	integerPhaseIds: number[];
	/** Gate id → its single required-output glob. */
	gateOutput: Map<string, string>;
	/** Canonical second path-segments under tasks/ that carry required outputs. */
	outputDirs: Set<string>; // e.g. {plans, reviews, contracts}
	/** Reflect-phase canonical leads (all must co-occur where leads are listed). */
	reflectLeads: string[];
	/** Prose files to scan, relative to project root, with validation scope. */
	sources: WorkflowSource[];
}

export interface WorkflowSource {
	path: string;
	lifecycleRender: boolean;
}

export class WorkflowSpecError extends Error {
	/** "missing" = file absent (downgradable to WARN in a non-scoped run);
	 *  "unparseable"/"malformed" = present but broken (always a FAIL). */
	constructor(
		message: string,
		readonly kind: "missing" | "unparseable" | "malformed" = "unparseable",
	) {
		super(message);
	}
}

interface RawSubstep {
	id?: string | number;
	name?: string;
}
interface RawPhase {
	id?: string | number;
	name?: string;
	leads?: string[];
	lead?: string;
	gate?: string;
	required_outputs?: string[];
	substeps?: RawSubstep[];
}
interface RawGate {
	id?: string;
	required_output?: string;
}
interface RawSpec {
	phases?: RawPhase[];
	gates?: RawGate[];
	contract_substep?: { required_output?: string };
	sources?: Array<string | { path?: unknown; lifecycle_render?: unknown }>;
}

/** Pull the second path segment out of a `tasks/<dir>/...` glob. */
function outputDirOf(glob: string): string | null {
	const m = /^tasks\/([A-Za-z0-9_-]+)\//.exec(glob.trim());
	return m ? m[1] : null;
}

/**
 * Parse `.claude/workflow.yaml` into a CanonicalSpec. Throws WorkflowSpecError
 * if the file is missing or unparseable — NEVER returns a degenerate "empty"
 * spec that would let drift pass silently.
 */
export function loadWorkflowSpec(projectRoot: string): CanonicalSpec {
	const specPath = path.join(projectRoot, ".claude", "workflow.yaml");
	if (!fs.existsSync(specPath)) {
		throw new WorkflowSpecError(`Canonical workflow spec missing: ${specPath}`, "missing");
	}
	let raw: RawSpec;
	try {
		raw = yaml.load(fs.readFileSync(specPath, "utf-8")) as RawSpec;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		throw new WorkflowSpecError(`Canonical workflow spec is unparseable (${specPath}): ${msg}`, "unparseable");
	}
	if (!raw || typeof raw !== "object" || !Array.isArray(raw.phases)) {
		throw new WorkflowSpecError(`Canonical workflow spec malformed (no phases): ${specPath}`, "malformed");
	}

	const phaseNames = new Set<string>();
	const nameById = new Map<string, string>();
	const integerPhaseIds: number[] = [];
	let reflectLeads: string[] = [];

	for (const phase of raw.phases) {
		if (phase.id === undefined || !phase.name) continue;
		const id = String(phase.id);
		phaseNames.add(phase.name);
		nameById.set(id, phase.name);
		if (/^\d+$/.test(id)) integerPhaseIds.push(Number(id));
		if (phase.name === "Reflect") {
			reflectLeads = (phase.leads ?? (phase.lead ? [phase.lead] : [])).map((l) => String(l));
		}
		for (const sub of phase.substeps ?? []) {
			if (sub.id === undefined || !sub.name) continue;
			phaseNames.add(sub.name);
			nameById.set(String(sub.id), sub.name);
		}
	}

	const gateOutput = new Map<string, string>();
	const outputDirs = new Set<string>();
	for (const gate of raw.gates ?? []) {
		if (gate.id && gate.required_output) {
			gateOutput.set(gate.id, gate.required_output);
			const dir = outputDirOf(gate.required_output);
			if (dir) outputDirs.add(dir);
		}
	}
	for (const phase of raw.phases) {
		for (const glob of phase.required_outputs ?? []) {
			const dir = outputDirOf(glob);
			if (dir) outputDirs.add(dir);
		}
	}
	if (raw.contract_substep?.required_output) {
		const dir = outputDirOf(raw.contract_substep.required_output);
		if (dir) outputDirs.add(dir);
	}

	if (raw.sources !== undefined && !Array.isArray(raw.sources)) {
		throw new WorkflowSpecError(`Canonical workflow spec malformed (sources must be an array): ${specPath}`, "malformed");
	}
	const sources = (raw.sources ?? []).map((source, index): WorkflowSource => {
		if (typeof source === "string" && source.trim()) return { path: source, lifecycleRender: false };
		if (!source || typeof source !== "object" || typeof source.path !== "string" || !source.path.trim()) {
			throw new WorkflowSpecError(`Canonical workflow spec malformed (invalid sources[${index}] entry): ${specPath}`, "malformed");
		}
		if (source.lifecycle_render !== undefined && typeof source.lifecycle_render !== "boolean") {
			throw new WorkflowSpecError(`Canonical workflow spec malformed (sources[${index}].lifecycle_render must be boolean): ${specPath}`, "malformed");
		}
		return { path: source.path, lifecycleRender: source.lifecycle_render === true };
	});

	return { phaseNames, nameById, integerPhaseIds, gateOutput, outputDirs, reflectLeads, sources };
}

const PHASE_NAME_RE = /Phase\s+(\d+(?:\.\d+)?)\s+\(?([A-Za-z][A-Za-z]+)/g;
// Matches only the inline flow-sequence form `applies_to: [...]`. YAML block
// sequences (one id per line) are not detected — an accepted token-level limit.
const APPLIES_TO_RE = /applies_to:\s*\[([^\]]*)\]/;
const TASKS_PATH_RE = /tasks\/([A-Za-z0-9_-]+)\//g;

/** Scan one prose file for tokens that contradict the canonical spec. */
export function scanForViolations(spec: CanonicalSpec, projectRoot: string, relPath: string, lifecycleRender = false): Violation[] {
	const abs = path.join(projectRoot, relPath);
	if (!fs.existsSync(abs)) {
		return [{ file: relPath, line: 0, found: "missing source file", expected: "file listed in workflow.yaml sources must exist" }];
	}
	const violations: Violation[] = [];
	const lines = fs.readFileSync(abs, "utf-8").split("\n");
	const body = lines.join("\n");
	const canonicalPointer = "Canonical source: .claude/workflow.yaml";
	if (!body.includes(canonicalPointer)) {
		violations.push({ file: relPath, line: 0, found: "missing canonical source pointer", expected: canonicalPointer });
	}
	if (lifecycleRender) {
		const sequence = [...spec.nameById].map(([id, name]) => `${id}:${name}`).join(" > ");
		const expectedMarker = `<!-- Workflow phase sequence: ${sequence} -->`;
		if (!body.includes(expectedMarker)) {
			violations.push({ file: relPath, line: 0, found: "missing or reordered workflow phase sequence marker", expected: expectedMarker });
		}
	}

	// Confusable singular forms of the canonical output dirs (the realistic typo).
	const dirTypos = new Map<string, string>(); // typo -> canonical
	for (const dir of spec.outputDirs) {
		if (dir.endsWith("s")) dirTypos.set(dir.slice(0, -1), dir);
	}

	lines.forEach((text, idx) => {
		const lineNo = idx + 1;

		// 1. Phase id ↔ name binding. Only a contradiction when the word after
		//    "Phase N" is itself an EXACT canonical phase name bound to a different
		//    id (e.g. "Phase 4 Build"). Prose like "Phase 3 GREEN" or "Phase 2
		//    optional" is not a name claim and is correctly ignored.
		for (const m of text.matchAll(PHASE_NAME_RE)) {
			const id = m[1];
			const word = m[2];
			if (spec.phaseNames.has(word) && spec.nameById.get(id) !== word) {
				const expected = spec.nameById.get(id);
				violations.push({
					file: relPath,
					line: lineNo,
					found: `Phase ${id} ${word}`,
					expected: expected ? `Phase ${id} ${expected}` : `${word} is canonical Phase ${[...spec.nameById].find(([, n]) => n === word)?.[0]}, not ${id}`,
				});
			}
		}

		// 2. Required-output path typo (e.g. tasks/review/ for tasks/reviews/).
		for (const m of text.matchAll(TASKS_PATH_RE)) {
			const dir = m[1];
			const canonical = dirTypos.get(dir);
			if (canonical) {
				violations.push({ file: relPath, line: lineNo, found: `tasks/${dir}/`, expected: `tasks/${canonical}/` });
			}
		}

		// 3. Output glob bound to the wrong gate. Only when a SINGLE gate is on the
		//    line — a line that names both gates is a legitimate summary, not drift.
		const reviewOut = spec.gateOutput.get("gate_2");
		const planOut = spec.gateOutput.get("gate_1");
		const hasGate1 = /\bGate\s*1\b/.test(text);
		const hasGate2 = /\bGate\s*2\b/.test(text);
		if (hasGate1 && !hasGate2 && reviewOut && new RegExp(globToProbe(reviewOut)).test(text)) {
			violations.push({ file: relPath, line: lineNo, found: `Gate 1 referencing ${reviewOut}`, expected: `Gate 2 owns ${reviewOut}` });
		}
		if (hasGate2 && !hasGate1 && planOut && new RegExp(globToProbe(planOut)).test(text)) {
			violations.push({ file: relPath, line: lineNo, found: `Gate 2 referencing ${planOut}`, expected: `Gate 1 owns ${planOut}` });
		}

		// 4. applies_to must enumerate every integer phase id.
		const am = APPLIES_TO_RE.exec(text);
		if (am) {
			const present = new Set((am[1].match(/\d+/g) ?? []).map(Number));
			const missing = spec.integerPhaseIds.filter((n) => !present.has(n));
			if (missing.length > 0) {
				violations.push({ file: relPath, line: lineNo, found: `applies_to omits Phase ${missing.join(", ")}`, expected: `applies_to includes Phase ${spec.integerPhaseIds.join(", ")}` });
			}
		}

	});

	// 5. Reflect lead list (file-level). A file that enumerates the Reflect leads
	//    (mentions Reflect and ≥2 of the canonical leads) must carry ALL of them.
	//    Gating on ≥2 avoids flagging files that mention one agent incidentally.
	if (/\bReflect\b/.test(body)) {
		const present = spec.reflectLeads.filter((l) => body.includes(l));
		if (present.length >= 2 && present.length < spec.reflectLeads.length) {
			const missingLeads = spec.reflectLeads.filter((l) => !body.includes(l));
			violations.push({ file: relPath, line: 0, found: `Reflect leads missing ${missingLeads.join(", ")}`, expected: `Reflect leads = ${spec.reflectLeads.join(" + ")}` });
		}
	}

	return violations;
}

/** Turn a glob into a loose substring probe (escape regex metachars, `*`→`.*`). */
function globToProbe(glob: string): string {
	return glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
}

/**
 * Run the full drift check. Returns CheckResults under the "Workflow" section:
 * a hard FAIL if the spec can't load, a per-source PASS/FAIL otherwise, and a
 * hard FAIL if a configured source lacks its canonical pointer or required
 * lifecycle marker.
 */
export function checkWorkflowDrift(projectRoot: string, opts: { missingSpecSeverity?: Status } = {}): CheckResult[] {
	let spec: CanonicalSpec;
	try {
		spec = loadWorkflowSpec(projectRoot);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		// A wholly-absent spec may downgrade to WARN (un-upgraded install); a
		// present-but-broken spec is always a FAIL.
		const kind = error instanceof WorkflowSpecError ? error.kind : "unparseable";
		const status: Status = kind === "missing" ? (opts.missingSpecSeverity ?? "fail") : "fail";
		const detail = kind === "missing" && status === "warn" ? `${msg} — run \`mewkit upgrade\` to install it` : msg;
		return [{ name: "Workflow spec loads", status, detail, section: "Workflow" }];
	}

	const results: CheckResult[] = [];
	for (const source of spec.sources) {
		const violations = scanForViolations(spec, projectRoot, source.path, source.lifecycleRender);
		if (violations.length === 0) {
			results.push({ name: `No drift: ${source.path}`, status: "pass", detail: source.path, section: "Workflow" });
		} else {
			const detail = violations
				.map((v) => `${v.file}:${v.line} found "${v.found}" — expected "${v.expected}"`)
				.join("\n         ");
			results.push({ name: `Drift in ${source.path}`, status: "fail", detail, section: "Workflow" });
		}
	}

	return results;
}
