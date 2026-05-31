import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Reader for the canonical event log at `.claude/memory/trace-log.jsonl`, the
 * append-only JSONL stream written by `append-trace.sh`. Consumed by `reflect`
 * and `health`. Tolerant by contract: it NEVER throws — malformed and oversized
 * lines are skipped and tallied, unreadable files are ignored.
 *
 * Schema: see `.claude/skills/trace-analyze/references/trace-schema.md`.
 */

/** Event types with a live emitter, plus the reserved (no-emitter-yet) ones. */
export const KNOWN_EVENT_TYPES = [
	// existing
	"file_edited",
	"harness_run_start",
	"contract_signed",
	"verdict_written",
	"cost_sample",
	"session_end",
	"dead_weight_audit_needed",
	"benchmark_result",
	// Phase 4 — gate/hook taxonomy
	"gate.blocked",
	"privacy.blocked",
	"injection.blocked",
	"hook.failed",
	// reserved — no emitter today (consumers must render N/A, never zero/list)
	"skill.invoked",
	"memory.write",
] as const;

export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];

/** Reserved types have no emitter yet; consumers render `N/A`, never a metric. */
export const RESERVED_EVENT_TYPES = new Set<string>(["skill.invoked", "memory.write"]);

export interface EventRecord {
	schema_version: string;
	ts: string;
	event: string;
	run_id?: string;
	harness_version?: string;
	model?: string;
	density?: string;
	data: Record<string, unknown>;
}

export interface ReadEventsOptions {
	/** Time window: `Nd` (days), `Nh` (hours), or an ISO-8601 instant. */
	since?: string;
	/** Keep only events whose `data.task` equals this id. */
	task?: string;
	/** Keep only these event types. */
	types?: string[];
}

export interface ReadEventsResult {
	events: EventRecord[];
	/** Count of lines skipped: failed JSON.parse OR exceeded the 64 KiB guard. */
	malformed: number;
}

/** Reject any single line larger than this (defends against a torn/huge line). */
const MAX_LINE_BYTES = 64 * 1024;

/** Resolve a `since` spec to an epoch-ms lower bound, or null if absent/invalid. */
export function parseSince(since: string | undefined): number | null {
	if (!since) return null;
	const rel = since.match(/^(\d+)([dh])$/);
	if (rel) {
		const n = Number(rel[1]);
		const unitMs = rel[2] === "d" ? 86_400_000 : 3_600_000;
		return Date.now() - n * unitMs;
	}
	const parsed = Date.parse(since);
	return Number.isNaN(parsed) ? null : parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize a parsed JSON line into an EventRecord, or null if it isn't one. */
function toEventRecord(parsed: unknown): EventRecord | null {
	if (!isRecord(parsed)) return null;
	if (typeof parsed.event !== "string" || typeof parsed.ts !== "string") return null;
	const data = isRecord(parsed.data) ? parsed.data : {};
	return {
		schema_version: typeof parsed.schema_version === "string" ? parsed.schema_version : "",
		ts: parsed.ts,
		event: parsed.event,
		run_id: typeof parsed.run_id === "string" ? parsed.run_id : undefined,
		harness_version: typeof parsed.harness_version === "string" ? parsed.harness_version : undefined,
		model: typeof parsed.model === "string" ? parsed.model : undefined,
		density: typeof parsed.density === "string" ? parsed.density : undefined,
		data,
	};
}

/** Parse one log file's text into records, mutating the accumulator + malformed tally. */
function parseLines(text: string, out: EventRecord[], state: { malformed: number }): void {
	for (const line of text.split("\n")) {
		if (line.trim() === "") continue;
		if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) {
			state.malformed++;
			continue;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			state.malformed++;
			continue;
		}
		const record = toEventRecord(parsed);
		if (record) out.push(record);
		else state.malformed++;
	}
}

/** Discover the active log + any rotated archives whose mtime is in the window. */
function discoverLogFiles(memoryDir: string, sinceMs: number | null): string[] {
	const active = path.join(memoryDir, "trace-log.jsonl");
	const files: string[] = [];
	let entries: string[] = [];
	try {
		entries = fs.readdirSync(memoryDir);
	} catch {
		return fs.existsSync(active) ? [active] : [];
	}
	if (entries.includes("trace-log.jsonl")) files.push(active);
	// Rotated archives: trace-log.<stamp>.jsonl(.gz). Fold one in unconditionally
	// unless its mtime predates the window (its events are all older than `since`).
	const rotated = /^trace-log\.[^/]+\.jsonl(\.gz)?$/;
	for (const name of entries) {
		if (name === "trace-log.jsonl" || !rotated.test(name)) continue;
		const full = path.join(memoryDir, name);
		if (sinceMs !== null) {
			try {
				if (fs.statSync(full).mtimeMs < sinceMs) continue;
			} catch {
				continue;
			}
		}
		files.push(full);
	}
	return files;
}

function readFileText(file: string): string | null {
	try {
		if (file.endsWith(".gz")) {
			return zlib.gunzipSync(fs.readFileSync(file)).toString("utf8");
		}
		return fs.readFileSync(file, "utf8");
	} catch {
		return null;
	}
}

/**
 * Read events from `<claudeDir>/memory/trace-log.jsonl` (+ in-window rotated `.gz`
 * archives), filtered by `since` / `task` / `types`. Never throws.
 */
export function readEvents(claudeDir: string, opts: ReadEventsOptions = {}): ReadEventsResult {
	const memoryDir = path.join(claudeDir, "memory");
	const sinceMs = parseSince(opts.since);
	const typeSet = opts.types && opts.types.length > 0 ? new Set(opts.types) : null;

	const collected: EventRecord[] = [];
	const state = { malformed: 0 };

	for (const file of discoverLogFiles(memoryDir, sinceMs)) {
		const text = readFileText(file);
		if (text !== null) parseLines(text, collected, state);
	}

	const events = collected.filter((e) => {
		if (typeSet && !typeSet.has(e.event)) return false;
		if (opts.task !== undefined && e.data.task !== opts.task) return false;
		if (sinceMs !== null) {
			const eventMs = Date.parse(e.ts);
			if (Number.isNaN(eventMs) || eventMs < sinceMs) return false;
		}
		return true;
	});

	// Chronological order regardless of file-read order.
	events.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

	return { events, malformed: state.malformed };
}
