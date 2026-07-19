// The ONE trace-append primitive. Every TypeScript writer (task-state emission, wiki adapter,
// CLI friction) builds its line and rotates through here, and the shell hook contends on the same
// sidecar lock path with the same protocol — so there is a single append implementation and a
// single lock object. Records are secret-scrubbed before write; append failure is the caller's to
// treat as advisory (this never throws for a full/rotating log, only for a genuinely unwritable
// filesystem).
import { appendFileSync, mkdirSync, renameSync, statSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { withFileLock, withFileLockSync } from "./file-lock.js";
import { scrubSecrets } from "../wiki/infrastructure/scan-patterns.js";

export const TRACE_SCHEMA_VERSION = "1.0";
export const TRACE_LOG_REL = path.join("memory", "trace-log.jsonl");
export const TRACE_LOCK_REL = path.join("memory", ".trace-log.lock");
export const TRACE_MAX_BYTES = 50 * 1024 * 1024;

/** Shared rotation predicate — bash and TS agree on the 50MB threshold. */
export function shouldRotate(sizeBytes: number): boolean {
	return sizeBytes > TRACE_MAX_BYTES;
}

export interface TraceAppendInput {
	event: string;
	data?: Record<string, unknown>;
	/** Canonical task identity — top-level so the query path can filter without json_extract. */
	taskId?: string | null;
	planPath?: string | null;
	runId?: string;
	model?: string;
	density?: string;
	harnessVersion?: string;
	/** Injected clock (tests pass a fixed Date); defaults to now. */
	now?: Date;
}

/** Recursively secret-scrub every string in an arbitrary data value before it is persisted. */
function scrubDeep(value: unknown): unknown {
	if (typeof value === "string") return scrubSecrets(value);
	if (Array.isArray(value)) return value.map(scrubDeep);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) out[k] = scrubDeep(v);
		return out;
	}
	return value;
}

function isoSeconds(now: Date): string {
	return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function rotationStamp(now: Date): string {
	const p = (n: number, w = 2): string => String(n).padStart(w, "0");
	return (
		p(now.getUTCFullYear() % 100) +
		p(now.getUTCMonth() + 1) +
		p(now.getUTCDate()) +
		"-" +
		p(now.getUTCHours()) +
		p(now.getUTCMinutes()) +
		p(now.getUTCSeconds())
	);
}

function buildRecord(input: TraceAppendInput, now: Date): Record<string, unknown> {
	const record: Record<string, unknown> = {
		schema_version: TRACE_SCHEMA_VERSION,
		ts: isoSeconds(now),
		event: input.event,
		run_id: input.runId ?? process.env["MEOWKIT_RUN_ID"] ?? "",
		harness_version: input.harnessVersion ?? process.env["MEOWKIT_HARNESS_VERSION"] ?? "3.0.0",
		model: input.model ?? process.env["MEOWKIT_MODEL_HINT"] ?? "",
		density: input.density ?? process.env["MEOWKIT_AUTOBUILD_MODE"] ?? "",
	};
	if (input.taskId) record["task_id"] = input.taskId;
	if (input.planPath) record["plan_path"] = input.planPath;
	record["data"] = scrubDeep(input.data ?? {});
	return record;
}

/** Rotate an oversized log to `trace-log.<stamp>.jsonl.gz` and start a fresh empty log. */
function rotate(logPath: string, now: Date): void {
	const dir = path.dirname(logPath);
	const rotated = path.join(dir, `trace-log.${rotationStamp(now)}.jsonl`);
	renameSync(logPath, rotated);
	writeFileSync(rotated + ".gz", gzipSync(readFileSync(rotated)));
	unlinkSync(rotated);
	writeFileSync(logPath, "");
}

/** Append the serialized line and rotate if the log is now oversized (caller holds the lock). */
function writeAndRotate(claudeDir: string, line: string, now: Date): void {
	const logPath = path.join(claudeDir, TRACE_LOG_REL);
	mkdirSync(path.dirname(logPath), { recursive: true });
	appendFileSync(logPath, line + "\n", "utf-8");
	try {
		if (shouldRotate(statSync(logPath).size)) rotate(logPath, now);
	} catch {
		/* rotation is best-effort — a failed rotate never loses the just-appended line */
	}
}

/** Append one trace record under the shared sidecar lock. Async writer (task-state, CLI). */
export async function appendTraceRecord(claudeDir: string, input: TraceAppendInput): Promise<void> {
	const now = input.now ?? new Date();
	const line = JSON.stringify(buildRecord(input, now));
	const lockPath = path.join(claudeDir, TRACE_LOCK_REL);
	mkdirSync(path.dirname(lockPath), { recursive: true });
	await withFileLock(lockPath, async () => writeAndRotate(claudeDir, line, now));
}

/** Synchronous sibling for sync callers (the wiki trace adapter) — same lock, same record shape. */
export function appendTraceRecordSync(claudeDir: string, input: TraceAppendInput): void {
	const now = input.now ?? new Date();
	const line = JSON.stringify(buildRecord(input, now));
	const lockPath = path.join(claudeDir, TRACE_LOCK_REL);
	mkdirSync(path.dirname(lockPath), { recursive: true });
	withFileLockSync(lockPath, () => writeAndRotate(claudeDir, line, now));
}
