/**
 * Plan lifecycle helpers for completion-driven archiving.
 *
 * A plan is complete when every non-abandoned phase todo is checked and at
 * least one todo exists. Failed phases block auto-archive so humans can resolve
 * the terminal state explicitly.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parsePhaseFile } from "./parse-phase-file.js";
import { PHASE_FILE_RE } from "./plan-constants.js";

export type PlanLifecycleResult =
	| { archived: false; reason: "not-complete" | "no-todos" | "failed-phase" | "missing-plan" | "already-archived" }
	| { archived: true; from: string; to: string };

type IncompletePlanReason = Extract<PlanLifecycleResult, { archived: false }>["reason"];

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function planCompletionState(planDir: string): { complete: boolean; reason?: IncompletePlanReason } {
	let entries: string[];
	try {
		entries = fs.readdirSync(planDir);
	} catch {
		return { complete: false, reason: "missing-plan" };
	}

	let totalTodos = 0;
	for (const name of entries) {
		if (!PHASE_FILE_RE.test(name)) continue;
		const phase = parsePhaseFile(path.join(planDir, name));
		if (!phase || phase.abandoned) continue;
		if (phase.status === "failed") return { complete: false, reason: "failed-phase" };
		totalTodos += phase.todos.length;
		if (phase.todos.some((todo) => !todo.checked)) return { complete: false, reason: "not-complete" };
	}

	if (totalTodos === 0) return { complete: false, reason: "no-todos" };
	return { complete: true };
}

function withCompletedStatus(content: string): string {
	const match = content.match(FRONTMATTER_RE);
	if (!match) {
		return `---\nstatus: completed\n---\n${content}`;
	}

	const block = match[1];
	const eol = block.includes("\r\n") ? "\r\n" : "\n";
	const lines = block.split(/\r?\n/);
	const statusIdx = lines.findIndex((line) => /^\s*status\s*:/.test(line));
	if (statusIdx >= 0) {
		lines[statusIdx] = "status: completed";
	} else {
		lines.push("status: completed");
	}

	return content.replace(FRONTMATTER_RE, `---${eol}${lines.join(eol)}${eol}---`);
}

function markPlanCompleted(planDir: string): boolean {
	const planPath = path.join(planDir, "plan.md");
	let content: string;
	try {
		content = fs.readFileSync(planPath, "utf-8");
	} catch {
		return false;
	}
	const next = withCompletedStatus(content);
	if (next !== content) fs.writeFileSync(planPath, next, "utf-8");
	return true;
}

function uniqueArchivePath(archiveRoot: string, slug: string): string {
	let candidate = path.join(archiveRoot, slug);
	let suffix = 2;
	while (fs.existsSync(candidate)) {
		candidate = path.join(archiveRoot, `${slug}-${suffix}`);
		suffix += 1;
	}
	return candidate;
}

export function completeAndArchivePlanIfDone(planDir: string, plansDir = path.dirname(planDir)): PlanLifecycleResult {
	const slug = path.basename(planDir);
	if (slug === "archive" || planDir.includes(`${path.sep}archive${path.sep}`)) {
		return { archived: false, reason: "already-archived" };
	}
	if (!fs.existsSync(path.join(planDir, "plan.md"))) {
		return { archived: false, reason: "missing-plan" };
	}

	const state = planCompletionState(planDir);
	if (!state.complete) return { archived: false, reason: state.reason ?? "not-complete" };
	if (!markPlanCompleted(planDir)) return { archived: false, reason: "missing-plan" };

	const archiveRoot = path.join(plansDir, "archive");
	fs.mkdirSync(archiveRoot, { recursive: true });
	const destination = uniqueArchivePath(archiveRoot, slug);
	fs.renameSync(planDir, destination);
	return { archived: true, from: planDir, to: destination };
}
