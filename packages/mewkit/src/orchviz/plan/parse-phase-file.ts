/**
 * parse-phase-file — extract status + todos + metadata from a phase-NN-*.md file.
 *
 * Per red-team H1: status extraction tries 3 sources (frontmatter, permissive
 * regex against `## Overview`, lowercase scan) before falling back to "unknown"
 * — never silently coerce to "pending".
 *
 * Per red-team C1: caller is responsible for boundary checks before this runs.
 * Per red-team M2: frontmatter regex tolerates `\r\n`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { PhaseState, PhaseStatus, TodoItem } from "./types.js";
import { FRONTMATTER_RE } from "./plan-constants.js";

const STATUS_BOLD_RE = /\*+\s*Status\s*:?\s*\*+\s*([A-Za-z_-]+)/i;
const STATUS_PLAIN_RE = /\bstatus\s*:\s*([a-z_-]+)/i;
const TODO_RE = /^\s*-\s*\[(\s|x|X|~|✓)\]\s+(.+?)\s*$/;
const PHASE_NUM_RE = /^phase-(\d+)/;
const HEADING_RE = /^#\s+Phase\s+\d+\s*[:.\-—]?\s*(.+?)\s*$/im;

const VALID_STATUSES: ReadonlySet<PhaseStatus> = new Set([
	"pending",
	"active",
	"in_progress",
	"completed",
	"failed",
	"abandoned",
	"unknown",
]);

function normalizeStatus(raw: string): PhaseStatus {
	const lower = raw.toLowerCase().replace(/\s+/g, "_");
	if (VALID_STATUSES.has(lower as PhaseStatus)) return lower as PhaseStatus;
	if (lower === "in-progress") return "in_progress";
	if (lower === "done") return "completed";
	return "unknown";
}

export function parsePhaseFile(filePath: string): PhaseState | null {
	const fileName = path.basename(filePath);
	let raw: string;
	try {
		raw = fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}

	const numMatch = fileName.match(PHASE_NUM_RE);
	const number = numMatch ? parseInt(numMatch[1], 10) : 0;
	const abandonedFromName = fileName.toUpperCase().includes("ABANDONED");

	let frontmatter: Record<string, unknown> = {};
	const fmMatch = raw.match(FRONTMATTER_RE);
	if (fmMatch) {
		try {
			const parsed = yaml.load(fmMatch[1], { schema: yaml.FAILSAFE_SCHEMA });
			if (parsed && typeof parsed === "object") {
				frontmatter = parsed as Record<string, unknown>;
			}
		} catch {
			/* malformed frontmatter; treat as absent */
		}
	}

	const fmStatus =
		typeof frontmatter.status === "string" ? frontmatter.status.toLowerCase() : null;
	const abandoned = abandonedFromName || fmStatus === "abandoned";

	let status: PhaseStatus = "unknown";
	if (abandoned) {
		status = "abandoned";
	} else if (fmStatus) {
		status = normalizeStatus(fmStatus);
	} else {
		const boldMatch = raw.match(STATUS_BOLD_RE);
		if (boldMatch) {
			status = normalizeStatus(boldMatch[1]);
		} else {
			const plainMatch = raw.match(STATUS_PLAIN_RE);
			if (plainMatch) status = normalizeStatus(plainMatch[1]);
		}
	}

	const headingMatch = raw.match(HEADING_RE);
	const title = headingMatch ? headingMatch[1].trim() : fileName.replace(/\.md$/, "");

	const effort =
		typeof frontmatter.effort === "string"
			? frontmatter.effort
			: extractEffort(raw) ?? "?";

	const todos = extractTodos(raw);

	return {
		number,
		title,
		status,
		effort,
		todos,
		filePath,
		abandoned,
	};
}

function extractEffort(raw: string): string | null {
	const match = raw.match(/\*+\s*Effort\s*:?\s*\*+\s*([^\n*]+?)\s*(?:\(|$)/im);
	return match ? match[1].trim() : null;
}

/**
 * Extract todos from the ## Todo List section.
 *
 * Per red-team C1: tracks ``` fence depth and skips checkbox lines inside
 * fenced code blocks. This makes the reader's todoIdx consistent with the
 * writer's applyTodoToggle walk (Phase 2). Reader and writer use the SAME
 * counting logic — only checkboxes OUTSIDE fences are counted.
 */
function extractTodos(raw: string): TodoItem[] {
	const todoSection = raw.match(/##\s+Todo\s+List\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
	if (!todoSection) return [];
	const out: TodoItem[] = [];
	let fenceDepth = 0;
	for (const line of todoSection[1].split(/\r?\n/)) {
		if (/^```/.test(line)) {
			fenceDepth = fenceDepth === 0 ? 1 : 0;
			continue;
		}
		if (fenceDepth > 0) continue;
		const m = line.match(TODO_RE);
		if (!m) continue;
		const marker = m[1];
		const text = m[2].trim();
		if (!text) continue;
		out.push({ checked: marker !== " " && marker !== "", text });
	}
	return out;
}
