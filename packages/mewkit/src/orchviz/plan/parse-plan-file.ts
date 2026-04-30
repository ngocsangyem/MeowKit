/**
 * parse-plan-file — read plan.md frontmatter into a PlanState scaffold.
 *
 * Per red-team M2: frontmatter regex tolerates `\r\n` (Windows checkouts).
 * Per red-team C1: caller is responsible for boundary checks before this runs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { PlanState } from "./types.js";

export interface PlanScaffold {
	slug: string;
	title: string;
	status: string;
	effort: string;
	created: string;
	path: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function asString(v: unknown, fallback = ""): string {
	if (typeof v === "string") return v;
	if (typeof v === "number") return String(v);
	return fallback;
}

export function parsePlanFile(planDir: string): PlanScaffold | null {
	const planFile = path.join(planDir, "plan.md");
	let raw: string;
	try {
		raw = fs.readFileSync(planFile, "utf-8");
	} catch {
		return null;
	}
	const slug = path.basename(planDir);

	const fmMatch = raw.match(FRONTMATTER_RE);
	if (!fmMatch) {
		return {
			slug,
			title: slug,
			status: "unknown",
			effort: "?",
			created: "",
			path: planDir,
		};
	}
	let parsed: unknown;
	try {
		parsed = yaml.load(fmMatch[1], { schema: yaml.FAILSAFE_SCHEMA });
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object") return null;
	const obj = parsed as Record<string, unknown>;

	return {
		slug,
		title: asString(obj.title, slug),
		status: asString(obj.status, "unknown"),
		effort: asString(obj.effort, "?"),
		created: asString(obj.created, ""),
		path: planDir,
	};
}

/** Combine a scaffold + parsed phases into a PlanState. */
export function buildPlanState(scaffold: PlanScaffold, phases: PlanState["phases"]): PlanState {
	return { ...scaffold, phases };
}
