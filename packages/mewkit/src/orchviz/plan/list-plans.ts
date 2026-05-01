/**
 * listPlans — enumerate all non-archived plan dirs in tasks/plans/.
 *
 * Per red-team SEC#6: realpath boundary check is applied to EVERY subdir before
 * any file inside is read. This mirrors the check in findActivePlan.
 *
 * Returns up to `limit` (default 100) PlanSummary objects sorted by plan.md
 * mtimeMs descending (most recently modified first).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { PlanStatus, PlanSummary } from "./types.js";
import { FRONTMATTER_RE, PHASE_FILE_RE, SLUG_RE } from "./plan-constants.js";

const DEFAULT_LIMIT = 100;

const VALID_PLAN_STATUSES = new Set<PlanStatus>([
	"draft",
	"in_progress",
	"active",
	"completed",
	"archived",
	"blocked",
	"unknown",
]);

function normalizePlanStatus(raw: unknown): PlanStatus {
	if (typeof raw !== "string") return "unknown";
	const lower = raw.toLowerCase().replace(/[-\s]+/g, "_").trim();
	if (VALID_PLAN_STATUSES.has(lower as PlanStatus)) return lower as PlanStatus;
	return "unknown";
}

function parsePlanFrontmatter(
	planFile: string,
): {
	title: string;
	status: PlanStatus;
	created: string;
	effort: string;
} | null {
	let raw: string;
	try {
		raw = fs.readFileSync(planFile, "utf-8");
	} catch {
		return null;
	}
	const slug = path.basename(path.dirname(planFile));
	const fmMatch = raw.match(FRONTMATTER_RE);
	if (!fmMatch) {
		return { title: slug, status: "unknown", created: "", effort: "?" };
	}
	let parsed: unknown;
	try {
		parsed = yaml.load(fmMatch[1], { schema: yaml.FAILSAFE_SCHEMA });
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object") {
		return { title: slug, status: "unknown", created: "", effort: "?" };
	}
	const obj = parsed as Record<string, unknown>;
	const status = normalizePlanStatus(obj.status);
	const title = typeof obj.title === "string" ? obj.title : slug;
	const created =
		typeof obj.created === "string"
			? obj.created
			: typeof obj.created === "number"
				? String(obj.created)
				: "";
	const effort =
		typeof obj.effort === "string"
			? obj.effort
			: typeof obj.effort === "number"
				? String(obj.effort)
				: "?";
	return { title, status, created, effort };
}

export interface ListPlansOptions {
	limit?: number;
}

/**
 * List all non-archived plans in projectRoot/tasks/plans/.
 * Each candidate subdir is realpath-checked against the boundary before read.
 */
export function listPlans(projectRoot: string, opts: ListPlansOptions = {}): PlanSummary[] {
	const limit = opts.limit ?? DEFAULT_LIMIT;
	const plansDir = path.join(projectRoot, "tasks", "plans");

	let resolvedPlansDir: string;
	try {
		resolvedPlansDir = fs.realpathSync(plansDir);
	} catch {
		return [];
	}
	const boundary = resolvedPlansDir + path.sep;

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(plansDir, { withFileTypes: true });
	} catch {
		return [];
	}

	const results: PlanSummary[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (!SLUG_RE.test(entry.name)) continue;

		const dir = path.join(plansDir, entry.name);

		let resolved: string;
		try {
			resolved = fs.realpathSync(dir);
		} catch {
			continue;
		}
		if (!(resolved + path.sep).startsWith(boundary)) continue;

		// One readdir per plan dir — covers both phase-count and (later, if needed)
		// any other phase-aware checks. Avoids a second readdirSync.
		let dirEntries: string[];
		try {
			dirEntries = fs.readdirSync(dir);
		} catch {
			continue;
		}
		if (!dirEntries.includes("plan.md")) continue;

		const planFile = path.join(dir, "plan.md");
		let planStat: fs.Stats;
		try {
			planStat = fs.statSync(planFile);
		} catch {
			continue;
		}
		if (!planStat.isFile()) continue;

		const fm = parsePlanFrontmatter(planFile);
		if (!fm) continue;
		if (fm.status === "archived") continue;

		const phaseCount = dirEntries.filter((name) => PHASE_FILE_RE.test(name)).length;

		results.push({
			slug: entry.name,
			title: fm.title,
			status: fm.status,
			created: fm.created,
			effort: fm.effort,
			mtimeMs: planStat.mtimeMs,
			phaseCount,
		});
	}

	results.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return results.slice(0, limit);
}
