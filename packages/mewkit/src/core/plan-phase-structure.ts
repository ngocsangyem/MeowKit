/**
 * Structural checks for one `phase-XX-*.md` file.
 *
 * Severity is split on purpose. A missing frontmatter block is a WARN, because
 * plans authored before the block existed must keep validating. Drift between
 * frontmatter and the todo list, a reserved sentinel status, and a phase number
 * that disagrees with its own filename are ERRORs: each one makes the plan lie
 * about its own state, which is worse than saying nothing.
 */

import { load as parseYaml } from "js-yaml";

/** The full phase template. A phase file must be executable from a cold read. */
export const REQUIRED_PHASE_SECTIONS = [
	"## Context Links",
	"## Overview",
	"## Key Insights",
	"## Requirements",
	"## Architecture",
	"## Related Code Files",
	"## Implementation Steps",
	"## Todo List",
	"## Success Criteria",
	"## Risk Assessment",
	"## Security Considerations",
	"## Next Steps",
] as const;

const VALID_STATUS = ["abandoned", "active", "completed", "failed", "in_progress", "pending"] as const;
const FRONTMATTER_FIELDS = ["phase", "title", "status", "priority", "effort", "dependencies"] as const;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const TODO_RE = /^[ \t]*-[ \t]*\[( |x|X)\][ \t]+/gm;
const MAX_PHASE_LINES = 200;

export interface PhaseIssues {
	warnings: string[];
	errors: string[];
}

/** Frontmatter as a plain object, or null when absent or malformed. */
export function parseFrontmatter(content: string): Record<string, unknown> | null {
	const match = FRONTMATTER_RE.exec(content);
	if (!match) return null;
	let parsed: unknown;
	try {
		parsed = parseYaml(match[1] ?? "");
	} catch {
		return null;
	}
	return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
		? (parsed as Record<string, unknown>)
		: null;
}

/** A named `## ` section's body, up to the next `## ` heading. */
export function sectionBody(content: string, heading: string): string | null {
	const index = content.indexOf(`${heading}\n`);
	if (index === -1) return null;
	const rest = content.slice(index + heading.length + 1);
	const next = rest.search(/\n##[^#]/);
	return next === -1 ? rest : rest.slice(0, next);
}

/** Total and checked todos in the `## Todo List` section. */
export function countCheckboxes(content: string): { total: number; checked: number } {
	const body = sectionBody(content, "## Todo List");
	if (body === null) return { total: 0, checked: 0 };
	let total = 0;
	let checked = 0;
	for (const match of body.matchAll(TODO_RE)) {
		total += 1;
		if (match[1] === "x" || match[1] === "X") checked += 1;
	}
	return { total, checked };
}

function list(values: readonly string[]): string {
	return `[${values.map((v) => `'${v}'`).join(", ")}]`;
}

function checkFrontmatter(content: string, basename: string): PhaseIssues {
	const warnings: string[] = [];
	const errors: string[] = [];
	const fm = parseFrontmatter(content);
	if (fm === null) {
		warnings.push(`${basename}: missing or malformed frontmatter (legacy compat — add per phase-template.md)`);
		return { warnings, errors };
	}

	for (const field of FRONTMATTER_FIELDS) {
		if (!(field in fm)) warnings.push(`${basename}: frontmatter missing field '${field}'`);
	}

	const raw = fm.status;
	let status = "";
	if (raw === null || raw === undefined || raw === "") {
		warnings.push(`${basename}: frontmatter 'status' has no value — author should set explicit status`);
	} else if (typeof raw === "string") {
		status = raw.toLowerCase();
	} else {
		status = String(raw);
	}
	if (status === "unknown") {
		errors.push(`${basename}: 'status: unknown' is reserved as parser sentinel — never write`);
	} else if (status && !VALID_STATUS.includes(status as (typeof VALID_STATUS)[number])) {
		errors.push(`${basename}: invalid status '${status}'; allowed: ${list(VALID_STATUS)}`);
	}

	const fromName = /^phase-(\d+)/.exec(basename);
	if (fromName && "phase" in fm) {
		const expected = Number.parseInt(fromName[1] ?? "", 10);
		const actual = Number(fm.phase);
		if (!Number.isInteger(actual)) errors.push(`${basename}: frontmatter 'phase' is not an integer`);
		else if (actual !== expected) {
			errors.push(`${basename}: frontmatter phase=${actual} != filename phase=${expected}`);
		}
	}

	if ("blocked_on" in fm) {
		const blocked = fm.blocked_on;
		if (!Array.isArray(blocked)) warnings.push(`${basename}: frontmatter 'blocked_on' should be a list of strings`);
		else if (!blocked.every((item) => typeof item === "string")) {
			warnings.push(`${basename}: frontmatter 'blocked_on' items should all be strings`);
		}
	}

	if (status === "completed") {
		const { total, checked } = countCheckboxes(content);
		if (total > 0 && checked < total) {
			errors.push(`${basename}: status=completed but ${total - checked}/${total} todos unchecked (drift)`);
		}
	}

	return { warnings, errors };
}

/** Every issue in one phase file, in print order (`WARN `/`ERROR ` prefixes applied). */
export function checkPhaseFile(content: string, basename: string): string[] {
	const issues: string[] = [];
	for (const section of REQUIRED_PHASE_SECTIONS) {
		if (!content.includes(section)) issues.push(`${basename}: Missing section: ${section}`);
	}

	const todo = sectionBody(content, "## Todo List");
	if (todo !== null) {
		const trimmed = todo.trim();
		if (!trimmed || (!trimmed.includes("- [ ]") && !trimmed.includes("- [x]"))) {
			issues.push(`${basename}: Todo List has no checkboxes`);
		}
	}

	const lineCount = content.trim().split("\n").length;
	if (lineCount > MAX_PHASE_LINES) issues.push(`${basename}: ${lineCount} lines (max 150 recommended)`);

	const { warnings, errors } = checkFrontmatter(content, basename);
	for (const warning of warnings) issues.push(`WARN ${warning}`);
	for (const error of errors) issues.push(`ERROR ${error}`);
	return issues;
}
