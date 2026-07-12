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
import { distinctRepos, type ContextEnvelope } from "./repo-context.js";

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

/**
 * `<projectRoot>/tasks/active` — the durable task-record home. This is the SAME path for a
 * flat-copy AND a plugin install: task records are the CONSUMER PROJECT's state (keyed to the
 * project the agent is working in, `process.cwd()`), not plugin-owned state. `tasks/` is
 * framework-internal state that keeps its path (skill-authoring Rule 2's exception), so it does
 * NOT move to `${CLAUDE_PLUGIN_DATA}` — that root is for a plugin's OWN cross-session data, and
 * putting consumer task records there would misplace them. Resolves P4 open decision #2.
 */
function activeDir(projectRoot: string): string {
	return join(projectRoot, "tasks", "active");
}

/**
 * The current active-plan pointer, mirroring the existing hook contract
 * (`session-state/active-plan.json` → `path` || `slug`, else legacy plain-text
 * `session-state/active-plan`). Null when absent. This is the CHECKPOINT JOIN: the task record
 * whose `planPath` matches the pointer is the current task (resolves P4 open decision #3).
 */
export function readActivePlanPointer(projectRoot: string): string | null {
	const jsonPath = join(projectRoot, "session-state", "active-plan.json");
	if (existsSync(jsonPath)) {
		try {
			const d = JSON.parse(readFileSync(jsonPath, "utf-8")) as { path?: unknown; slug?: unknown };
			const p = (typeof d.path === "string" && d.path) || (typeof d.slug === "string" && d.slug) || "";
			if (p.trim()) return p.trim();
		} catch {
			/* fall through to legacy */
		}
	}
	const legacy = join(projectRoot, "session-state", "active-plan");
	if (existsSync(legacy)) {
		const txt = readFileSync(legacy, "utf-8").trim();
		if (txt) return txt;
	}
	return null;
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

/**
 * Record a repo-context envelope's evidence into an EXISTING durable task record (Phase 5
 * slice 2). Merges — never replaces — so evidence accumulates across a task's steps:
 * - `repos`: the DISTINCT owning repos of the envelope's evidence (via `distinctRepos`), unioned
 *   with the record's repos by identity; the newest envelope's revision wins for a repo already
 *   present. Multi-repo context is preserved: every owning repo stays its own entry.
 * - `evidenceRefs`: the evidence PATHS unioned with the record's, deduped. The record stays a
 *   COMPACT resume summary — the full envelope (with content hashes) lives on disk and is
 *   re-checked on demand via `context check`, not duplicated here.
 *
 * Refuses to create a record: context evidence belongs to an active durable task (task-state
 * emission Rule 1). `now` is passed in — the pure core never reads the clock.
 */
export async function recordContextEvidence(
	projectRoot: string,
	taskId: string,
	envelope: ContextEnvelope,
	now: string,
): Promise<TaskRecord> {
	return updateTaskRecord(projectRoot, taskId, (existing) => {
		if (!existing)
			throw new Error(`no active task record "${taskId}" — context evidence is recorded only for an existing durable task`);
		// Union owning repos by identity (newest revision wins for a repo already recorded).
		const revByIdentity = new Map(existing.repos.map((r) => [r.identity, r.revision]));
		for (const r of distinctRepos(envelope.evidence)) revByIdentity.set(r.identity, r.revision);
		const repos = [...revByIdentity]
			.map(([identity, revision]) => ({ identity, revision }))
			.sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0));
		// Union evidence paths (compact resume summary — never the hashes).
		const paths = new Set(existing.evidenceRefs);
		for (const e of envelope.evidence) paths.add(e.path);
		return { ...existing, repos, evidenceRefs: [...paths].sort(), updatedAt: now };
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
	/** The active-plan pointer (checkpoint join); a record whose planPath matches is current. */
	activePlanPointer: string | null;
}
export function reconstructResumeState(projectRoot: string): ResumeState {
	const records: TaskRecord[] = [];
	const issues: { taskId: string; problem: string }[] = [];
	// Listing itself is guarded so a dir-removal race can't crash the whole reconstruction.
	let ids: string[] = [];
	try {
		ids = listTaskRecordIds(projectRoot);
	} catch (err) {
		issues.push({ taskId: "(listing)", problem: (err as Error).message });
	}
	for (const id of ids) {
		try {
			const r = readTaskRecord(projectRoot, id);
			if (r) records.push(r);
		} catch (err) {
			issues.push({ taskId: id, problem: (err as Error).message });
		}
	}
	return { records, issues, activePlanPointer: readActivePlanPointer(projectRoot) };
}
