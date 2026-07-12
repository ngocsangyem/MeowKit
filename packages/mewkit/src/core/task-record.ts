// Minimal durable task state (Phase 4): the one per-task record that lets a fresh session
// resume and audit capability use. Plans stay the human source of truth — this record JOINS
// to a plan by path, it does not replace it. Compatibility is governed by the record's own
// `schemaVersion` checked against the CLI's supported range (OQ6 decision): the record is
// decoupled from the npm-CLI version line and the kit-release version line, which are recorded
// as provenance only. Integrity: validated id, realpath containment, atomic replace under a
// per-file lock (reuses the install-metadata writer pattern).
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import { join, relative, isAbsolute, sep } from "node:path";
import { z } from "zod";
import { withFileLock } from "./file-lock.js";

/** The record schema version THIS CLI writes. Bump on any breaking record shape change. */
export const TASK_RECORD_SCHEMA_VERSION = "1.0";
/** Record schema versions this CLI can safely READ. A record outside this set is rejected. */
export const SUPPORTED_TASK_RECORD_SCHEMAS: ReadonlySet<string> = new Set(["1.0"]);

/** Valid task id: lowercase slug, filename-safe (it becomes `<id>.json`). */
const TASK_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const CapabilityDecisionSchema = z.object({
	capabilityId: z.string(),
	decision: z.enum(["selected", "skipped", "unavailable", "unsupported"]),
	reason: z.string(),
	/** References the Phase-3 availability snapshot that justified the decision. */
	adapterSnapshotId: z.string().optional(),
});

export const RepoRefSchema = z.object({
	/** Stable repository identity (remote URL, path hash, or name) — never invented. */
	identity: z.string(),
	/** VCS revision when available; null for non-git roots (no fabricated revision). */
	revision: z.string().nullable(),
});

export const TaskRecordSchema = z.object({
	schemaVersion: z.literal("1.0"),
	taskId: z.string().regex(TASK_ID_RE),
	planPath: z.string().nullable().default(null),
	status: z.enum(["active", "blocked", "done"]),
	currentStep: z.string().default(""),
	repos: z.array(RepoRefSchema).default([]),
	blockers: z.array(z.string()).default([]),
	nextAction: z.string().default(""),
	verificationSummaries: z.array(z.object({ ref: z.string(), result: z.string() })).default([]),
	evidenceRefs: z.array(z.string()).default([]),
	capabilityDecisions: z.array(CapabilityDecisionSchema).default([]),
	/** Provenance only (never the compatibility gate): who wrote this record. */
	writtenByCli: z.string().default(""),
	writtenByKit: z.string().default(""),
	updatedAt: z.string(),
})
	// Preserve unknown keys through a read→write round-trip. A future CLI may add an
	// additive field WITHOUT bumping schemaVersion (per the versioning note above); an older
	// CLI must not silently strip it when it updates the record.
	.passthrough();
export type TaskRecord = z.infer<typeof TaskRecordSchema>;

/** Thrown when a record's schemaVersion is outside this CLI's supported range (loud, non-zero). */
export class IncompatibleTaskRecordError extends Error {
	constructor(public readonly detail: string) {
		super(`Incompatible task record: ${detail}`);
		this.name = "IncompatibleTaskRecordError";
	}
}

/** `<projectRoot>/tasks/active` — the durable task-record home for a flat-copy install. */
function activeDir(projectRoot: string): string {
	return join(projectRoot, "tasks", "active");
}

/** Resolve a task-record path and assert it stays contained under tasks/active (realpath). */
function recordPath(projectRoot: string, taskId: string): string {
	if (!TASK_ID_RE.test(taskId)) throw new Error(`invalid task id: ${JSON.stringify(taskId)}`);
	const dir = activeDir(projectRoot);
	const abs = join(dir, `${taskId}.json`);
	// Lexical + realpath containment: the id regex already bars separators/.., this is defense in depth.
	const rel = relative(dir, abs);
	if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) throw new Error(`task path escapes tasks/active: ${taskId}`);
	return abs;
}

/** Parse + version-check a record already read from disk. Throws on schema drift. */
function parseAndCheck(raw: string): TaskRecord {
	const parsed = JSON.parse(raw) as { schemaVersion?: unknown };
	if (typeof parsed.schemaVersion === "string" && !SUPPORTED_TASK_RECORD_SCHEMAS.has(parsed.schemaVersion)) {
		throw new IncompatibleTaskRecordError(
			`record schemaVersion "${parsed.schemaVersion}" not in supported ${JSON.stringify([...SUPPORTED_TASK_RECORD_SCHEMAS])}`,
		);
	}
	return TaskRecordSchema.parse(parsed);
}

/** Read + version-check a single task record. Throws IncompatibleTaskRecordError on schema drift. */
export function readTaskRecord(projectRoot: string, taskId: string): TaskRecord | null {
	const abs = recordPath(projectRoot, taskId);
	if (!existsSync(abs)) return null;
	return parseAndCheck(readFileSync(abs, "utf-8"));
}

/** Atomic temp+rename write of an already-validated record (NO lock — callers hold it). */
async function atomicReplace(target: string, record: TaskRecord): Promise<void> {
	const serialized = JSON.stringify(record, null, 2) + "\n";
	const tmp = `${target}.tmp-${process.pid}`;
	try {
		await writeFile(tmp, serialized, "utf-8");
		await rename(tmp, target);
	} catch (err) {
		try {
			await unlink(tmp);
		} catch {
			/* best-effort cleanup */
		}
		throw err;
	}
}

/** Prepare tasks/active and assert realpath containment; returns the resolved target path. */
function prepareTarget(projectRoot: string, taskId: string): string {
	const dir = activeDir(projectRoot);
	mkdirSync(dir, { recursive: true });
	// Realpath containment — reject a symlinked tasks/active escaping the project root.
	const relDir = relative(realpathSync(projectRoot), realpathSync(dir));
	if (relDir.startsWith("..") || isAbsolute(relDir)) throw new Error("tasks/active escapes the project root");
	return recordPath(projectRoot, taskId);
}

/**
 * Atomically write a task record under a per-id lock. Refuses to overwrite an on-disk record
 * whose schemaVersion this CLI cannot read (fails closed — never clobbers an incompatible
 * record). Prefer `updateTaskRecord` for read-modify-write; this is the low-level put.
 */
export async function writeTaskRecord(projectRoot: string, record: TaskRecord): Promise<void> {
	const validated = TaskRecordSchema.parse(record);
	const target = prepareTarget(projectRoot, validated.taskId);
	const lockPath = join(activeDir(projectRoot), `.${validated.taskId}.lock`);
	await withFileLock(lockPath, async () => {
		if (existsSync(target)) parseAndCheck(readFileSync(target, "utf-8")); // throws if on-disk is incompatible
		await atomicReplace(target, validated);
	});
}

/**
 * Read → mutate → write a task record atomically under ONE lock, so concurrent updates to the
 * same id cannot lose each other's changes (the read-modify-write cycle is serialized). The
 * mutator receives the current record (or null if absent) and returns the next one. An
 * incompatible on-disk record makes the read throw before any write — it is never clobbered.
 */
export async function updateTaskRecord(
	projectRoot: string,
	taskId: string,
	mutate: (existing: TaskRecord | null) => TaskRecord,
): Promise<TaskRecord> {
	const target = prepareTarget(projectRoot, taskId);
	const lockPath = join(activeDir(projectRoot), `.${taskId}.lock`);
	return withFileLock(lockPath, async () => {
		const existing = existsSync(target) ? parseAndCheck(readFileSync(target, "utf-8")) : null;
		const next = TaskRecordSchema.parse(mutate(existing));
		await atomicReplace(target, next);
		return next;
	});
}

/** List all active-dir task ids (record filenames), for resume reconstruction. */
export function listTaskRecordIds(projectRoot: string): string[] {
	const dir = activeDir(projectRoot);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".json"))
		.map((f) => f.replace(/\.json$/, ""))
		.filter((id) => TASK_ID_RE.test(id))
		.sort();
}

/**
 * Resume reconstruction: read every active task record from files only (no network, no CLI
 * round-trip). A corrupt/incompatible record is surfaced as an issue rather than crashing the
 * whole reconstruction, so one bad file never blocks resuming the others.
 */
export interface ResumeState {
	records: TaskRecord[];
	issues: { taskId: string; problem: string }[];
}
export function reconstructResumeState(projectRoot: string): ResumeState {
	const records: TaskRecord[] = [];
	const issues: { taskId: string; problem: string }[] = [];
	for (const id of listTaskRecordIds(projectRoot)) {
		try {
			const r = readTaskRecord(projectRoot, id);
			if (r) records.push(r);
		} catch (err) {
			issues.push({ taskId: id, problem: (err as Error).message });
		}
	}
	return { records, issues };
}
