/**
 * findActivePlan — discover the most-recent non-archived plan dir.
 *
 * Per red-team C1 (orchviz redesign plan): every candidate path is realpath-resolved
 * and asserted to live inside `${projectRoot}/tasks/plans/`. Symlinks pointing
 * outside the boundary are rejected to prevent path-disclosure via /api/plan.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { createLogger } from "../logger.js";

const log = createLogger("PlanFinder");

interface Candidate {
	dir: string;
	mtimeMs: number;
}

export function findActivePlan(projectRoot: string): string | null {
	const plansDir = path.join(projectRoot, "tasks", "plans");
	if (!fs.existsSync(plansDir)) return null;

	const boundary = path.resolve(plansDir) + path.sep;
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(plansDir, { withFileTypes: true });
	} catch {
		return null;
	}

	const candidates: Candidate[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const dir = path.join(plansDir, entry.name);
		const planFile = path.join(dir, "plan.md");

		// Boundary check (red-team C1)
		let resolved: string;
		try {
			resolved = fs.realpathSync(dir);
		} catch {
			continue;
		}
		if (!(resolved + path.sep).startsWith(boundary)) {
			log.warn(`rejecting plan dir outside boundary: ${dir} -> ${resolved}`);
			continue;
		}

		let stat: fs.Stats;
		try {
			stat = fs.statSync(planFile);
		} catch {
			continue;
		}
		if (!stat.isFile()) continue;
		if (isArchived(planFile)) continue;
		candidates.push({ dir, mtimeMs: stat.mtimeMs });
	}

	if (candidates.length === 0) return null;
	candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return candidates[0].dir;
}

function isArchived(planFile: string): boolean {
	let raw: string;
	try {
		raw = fs.readFileSync(planFile, "utf-8");
	} catch {
		return false;
	}
	const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) return false;
	let parsed: unknown;
	try {
		parsed = yaml.load(fmMatch[1], { schema: yaml.FAILSAFE_SCHEMA });
	} catch {
		return false;
	}
	if (!parsed || typeof parsed !== "object") return false;
	const status = (parsed as Record<string, unknown>).status;
	return typeof status === "string" && status.toLowerCase() === "archived";
}
