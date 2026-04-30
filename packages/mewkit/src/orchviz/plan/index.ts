/**
 * orchviz plan parser — orchestrator for plan + phase files.
 *
 * Public API:
 *   - findActivePlan(projectRoot)
 *   - readPlan(planDir)
 *
 * Read-only by design. v1.1 does not write to plan files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { PhaseState, PlanState } from "./types.js";

export type { PhaseState, PhaseStatus, PlanState, TodoItem } from "./types.js";
export { findActivePlan } from "./find-active-plan.js";
export { parsePlanFile, type PlanScaffold } from "./parse-plan-file.js";
export { parsePhaseFile } from "./parse-phase-file.js";

import { findActivePlan } from "./find-active-plan.js";
import { parsePlanFile } from "./parse-plan-file.js";
import { parsePhaseFile } from "./parse-phase-file.js";
import { createLogger } from "../logger.js";

const log = createLogger("PlanReader");
const PHASE_FILE_RE = /^phase-\d+-.+\.md$/i;

export function readPlan(planDir: string): PlanState | null {
	const scaffold = parsePlanFile(planDir);
	if (!scaffold) return null;

	const boundary = path.resolve(planDir) + path.sep;
	let entries: string[];
	try {
		entries = fs.readdirSync(planDir);
	} catch {
		return null;
	}

	const phaseFiles: string[] = [];
	for (const name of entries) {
		if (!PHASE_FILE_RE.test(name)) continue;
		const full = path.join(planDir, name);
		// Boundary check (red-team C1) — defense in depth even though planDir already checked.
		let resolved: string;
		try {
			resolved = fs.realpathSync(full);
		} catch {
			continue;
		}
		if (!resolved.startsWith(boundary)) {
			log.warn(`rejecting phase file outside boundary: ${full}`);
			continue;
		}
		phaseFiles.push(full);
	}

	const phases: PhaseState[] = [];
	for (const filePath of phaseFiles) {
		const phase = parsePhaseFile(filePath);
		if (phase) phases.push(phase);
	}
	phases.sort((a, b) => a.number - b.number);

	return { ...scaffold, phases };
}

/**
 * Compute a cache key from filesystem mtimes (red-team H3).
 * Returns a string like "1730403600000:1730403700000" or null if planDir gone.
 */
export function planMtimeKey(planDir: string): string | null {
	try {
		const planStat = fs.statSync(path.join(planDir, "plan.md"));
		let maxPhaseMtime = 0;
		for (const name of fs.readdirSync(planDir)) {
			if (!PHASE_FILE_RE.test(name)) continue;
			const stat = fs.statSync(path.join(planDir, name));
			if (stat.mtimeMs > maxPhaseMtime) maxPhaseMtime = stat.mtimeMs;
		}
		return `${planStat.mtimeMs}:${maxPhaseMtime}`;
	} catch {
		return null;
	}
}
