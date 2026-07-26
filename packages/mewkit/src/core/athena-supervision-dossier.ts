// Athena supervision dossier — the parent-owned continuity record.
//
// Canonical contract: `.claude/rules-conditional/advice-supervision-rules.md`.
//
// Athena is a long-lived LEAD but never a long-lived SESSION: each call is a fresh
// fork. Continuity therefore cannot come from a transcript, so it comes from one
// compact file the PARENT owns. Two properties make that safe:
//
//  1. It stays small. A fresh parent reloads the current directive and pointers,
//     not the history — an auto-growing record would reintroduce the context rot
//     the fork exists to avoid. Historical receipts may sit below the active
//     summary but are never auto-loaded.
//  2. It cannot become a second task truth. The durable task record owns status,
//     progress and verification; this file is refused if it carries any of them.
//     Without that guard, "the dossier says verified" eventually outranks the
//     tests, which is how an advisory surface silently acquires authority.
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { RUN_ID_RE, isValidRunId } from "./athena-supervision-mode.js";
import { DISPOSITIONS, SUPERVISION_STAGES, type CheckpointRecord } from "./athena-supervision-protocol.js";
import { withFileLock } from "./file-lock.js";

/** Frontmatter + active summary ceiling. History below it does not count. */
export const ACTIVE_SUMMARY_MAX_BYTES = 2 * 1024;

/**
 * Fields that would turn continuity into authority. Rejected outright rather than
 * stripped: silently dropping a field the caller believed it stored is worse than
 * refusing, because the caller then trusts state that was never written.
 */
export const FORBIDDEN_DOSSIER_FIELDS = [
	"progress",
	"percentComplete",
	"verification",
	"verified",
	"verificationResult",
	"testsPassed",
	"gate",
	"gate1",
	"gate2",
	"gateApproval",
	"approval",
	"approved",
	"verdict",
	"status",
] as const;

export const CheckpointMarkerSchema = z.object({
	checkpointId: z.string().min(1),
	stage: z.enum(["GUIDE", "RESCUE", "REVIEW", "RECHECK"]),
	/** `pending` is written BEFORE the call, `committed` after its result lands. */
	state: z.enum(["pending", "committed"]),
	/**
	 * Which budget this call is charged to, for a skill whose cap is per-partition.
	 * Carried on the marker so `commit` inherits it from `begin` — asking the caller
	 * to repeat it would let a call open against one budget and commit against another.
	 */
	partition: z.string().min(1).optional(),
});
export type CheckpointMarker = z.infer<typeof CheckpointMarkerSchema>;

/**
 * One committed call, persisted so cap accounting survives a process boundary.
 *
 * Every checkpoint runs as a separate CLI invocation, so in-memory history does not
 * exist by the time the next call is evaluated. Without this list a run would
 * re-derive an empty history each time and every cap would silently reset to zero —
 * a supervision budget that resets is not a budget.
 */
export const CheckpointHistorySchema = z.object({
	checkpointId: z.string().min(1),
	stage: z.enum(SUPERVISION_STAGES),
	disposition: z.enum(DISPOSITIONS),
	/**
	 * The budget this call was charged to. Optional so a history written before
	 * partitioning still parses — an entry with no partition belongs to a per-run
	 * budget, which is exactly what those runs had.
	 */
	partition: z.string().min(1).optional(),
});

export const DossierSchema = z
	.object({
		runId: z.string().regex(RUN_ID_RE),
		skill: z.string().min(1),
		stage: z.enum(["GUIDE", "RESCUE", "REVIEW", "RECHECK"]),
		/** Pointers to locked decisions — never the decisions' full text. */
		lockedDecisionPointers: z.array(z.string()).default([]),
		latestDirective: z.string().default(""),
		correctionCount: z.number().int().min(0).default(0),
		receiptPointers: z.array(z.string()).default([]),
		nextSafeAction: z.string().default(""),
		checkpoint: CheckpointMarkerSchema.nullable().default(null),
		history: z.array(CheckpointHistorySchema).default([]),
		/**
		 * Set when supervision stopped and handed the decision to a human — a cap was
		 * reached, or work was returned twice unresolved.
		 *
		 * It exists because caps are per RUN and the run id comes from the caller: an
		 * agent told "escalate, do not retry" could otherwise mint a fresh run id and
		 * keep going, which defeats the escalation rather than the budget. A sibling run
		 * for the same skill is refused while this is set, so the way forward is the
		 * human the refusal asked for.
		 *
		 * This records that supervision STOPPED. It is not a verdict, status or approval
		 * — those remain forbidden fields.
		 */
		escalatedToHuman: z.boolean().default(false),
	})
	.strict();
export type Dossier = z.infer<typeof DossierSchema>;

/**
 * Deterministic path so a fresh parent can find the run without an index. Only an
 * embedded run has an id, so this path cannot exist for a direct consult — that is
 * the structural reason a stateless brief leaves no dossier behind.
 */
export function dossierPath(projectRoot: string, runId: string): string {
	if (!isValidRunId(runId)) throw new Error(`invalid supervision run id: ${JSON.stringify(runId)}`);
	return join(projectRoot, "tasks", "reports", `${runId}-athena-supervision.md`);
}

export interface DossierValidation {
	ok: boolean;
	errors: string[];
}

/**
 * Validate a candidate dossier: shape, forbidden authority fields, and the active
 * summary byte cap. The forbidden-field check runs against the RAW candidate,
 * before schema parsing narrows it — `.strict()` would reject an unknown key with
 * a generic message, and the caller needs to know it tried to store authority.
 */
export function validateDossier(candidate: unknown): DossierValidation {
	const errors: string[] = [];

	if (candidate && typeof candidate === "object") {
		// `Object.getOwnPropertyNames`, not `Object.keys`: a non-enumerable property is
		// still a property, and zod's `.strict()` shares the same blind spot. Today the
		// only caller round-trips through `JSON.parse` (which cannot produce one), so
		// this is closing the gap before a future in-memory caller opens it — the claim
		// above says "refused", and a claim that holds only for JSON inputs is a
		// narrower claim than the one written.
		const keys = Object.getOwnPropertyNames(candidate as Record<string, unknown>);
		for (const forbidden of FORBIDDEN_DOSSIER_FIELDS) {
			if (keys.includes(forbidden))
				errors.push(`"${forbidden}" belongs to the task record — the dossier carries no progress, verification, or gate state`);
		}
	}

	const parsed = DossierSchema.safeParse(candidate);
	if (!parsed.success) {
		errors.push(...parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
		return { ok: false, errors };
	}

	const bytes = Buffer.byteLength(renderDossier(parsed.data), "utf8");
	if (bytes > ACTIVE_SUMMARY_MAX_BYTES)
		errors.push(`active summary is ${bytes}B, over the ${ACTIVE_SUMMARY_MAX_BYTES}B cap — shorten the directive`);

	return { ok: errors.length === 0, errors };
}

/** YAML-escape a scalar conservatively (quote always; escape quotes/backslashes). */
const yamlScalar = (v: string): string => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const yamlList = (items: readonly string[]): string =>
	items.length === 0 ? "[]" : `[${items.map(yamlScalar).join(", ")}]`;

/**
 * Collapse to one line. The directive and next action round-trip through
 * single-line body markers, so an embedded newline would truncate on read — and a
 * silently truncated directive is worse than a reformatted one. The 2 KiB cap
 * already implies a short summary, so nothing legitimate is lost.
 */
const singleLine = (v: string): string => v.replace(/\s+/g, " ").trim();

/**
 * Render the active portion: frontmatter plus a short human-readable summary. The
 * explicit not-verification line is part of the artifact, not decoration — a later
 * reader must not be able to mistake a directive for proof.
 *
 * `history` is emitted as inline JSON: JSON is valid YAML, so the frontmatter stays
 * well-formed for any reader, and this module can parse its own output exactly
 * without taking on a YAML dependency.
 */
export function renderDossier(dossier: Dossier): string {
	const cp = dossier.checkpoint;
	return `---
kind: athena-supervision-dossier
runId: ${yamlScalar(dossier.runId)}
skill: ${yamlScalar(dossier.skill)}
stage: ${yamlScalar(dossier.stage)}
lockedDecisionPointers: ${yamlList(dossier.lockedDecisionPointers)}
correctionCount: ${dossier.correctionCount}
receiptPointers: ${yamlList(dossier.receiptPointers)}
checkpoint: ${cp ? `{ checkpointId: ${yamlScalar(cp.checkpointId)}, stage: ${yamlScalar(cp.stage)}, state: ${yamlScalar(cp.state)}${cp.partition ? `, partition: ${yamlScalar(cp.partition)}` : ""} }` : "null"}
history: ${JSON.stringify(dossier.history)}
escalatedToHuman: ${dossier.escalatedToHuman}
---

# Supervision run ${dossier.runId}

This is supervision continuity, NEVER verification and never a gate approval.

**Latest directive:** ${singleLine(dossier.latestDirective) || "(none yet)"}
**Next safe action:** ${singleLine(dossier.nextSafeAction) || "(none recorded)"}
`;
}

/** Outcome of reading a dossier back. A corrupt record is a refusal, never an empty run. */
export type DossierRead =
	| { found: true; dossier: Dossier }
	| { found: false; corrupt: false }
	| { found: false; corrupt: true; reason: string };

/** Pull one frontmatter scalar line's raw value (everything after the first colon). */
function frontmatterValue(frontmatter: string, key: string): string | undefined {
	const line = frontmatter.split("\n").find((l) => l.startsWith(`${key}:`));
	return line === undefined ? undefined : line.slice(key.length + 1).trim();
}

/** Undo `yamlScalar` — a quoted scalar is valid JSON, so JSON.parse is the exact inverse. */
function unquote(raw: string | undefined): string | undefined {
	if (raw === undefined) return undefined;
	if (!raw.startsWith('"')) return raw;
	try {
		const v: unknown = JSON.parse(raw);
		return typeof v === "string" ? v : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Parse a dossier this module rendered.
 *
 * Deliberately narrow: it reads only the keys `renderDossier` writes rather than
 * accepting arbitrary YAML. A general parser would be a larger surface for a file
 * whose only writer is this module, and the round-trip test is the contract.
 *
 * Fails closed. A record that cannot be parsed is reported as CORRUPT, never as an
 * absent run — treating a damaged dossier as "no history" would reset every cap and
 * hand the run an unbounded supervision budget.
 */
export function parseDossier(text: string): DossierRead {
	const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
	if (!match) return { found: false, corrupt: true, reason: "no frontmatter block" };
	const fm = match[1];

	let history: unknown = [];
	const rawHistory = frontmatterValue(fm, "history");
	if (rawHistory !== undefined && rawHistory !== "") {
		try {
			history = JSON.parse(rawHistory);
		} catch {
			return { found: false, corrupt: true, reason: "history is not valid JSON" };
		}
	}

	let checkpoint: unknown = null;
	const rawCheckpoint = frontmatterValue(fm, "checkpoint");
	if (rawCheckpoint && rawCheckpoint !== "null") {
		// `{ key: "value", … }` — the inline form render emits. Read the known keys.
		const read = (k: string): string | undefined => unquote(new RegExp(`${k}:\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(rawCheckpoint)?.[1]);
		const partition = read("partition");
		checkpoint = {
			checkpointId: read("checkpointId"),
			stage: read("stage"),
			state: read("state"),
			// Omit the key entirely when absent. `partition: undefined` would round-trip
			// through the optional schema, but an explicitly-present-yet-empty key reads
			// as "this run has no budget partition" rather than "this render had none".
			...(partition === undefined ? {} : { partition }),
		};
	}

	let pointers: unknown = [];
	const rawPointers = frontmatterValue(fm, "lockedDecisionPointers");
	let receipts: unknown = [];
	const rawReceipts = frontmatterValue(fm, "receiptPointers");
	try {
		if (rawPointers) pointers = JSON.parse(rawPointers);
		if (rawReceipts) receipts = JSON.parse(rawReceipts);
	} catch {
		return { found: false, corrupt: true, reason: "pointer list is not valid JSON" };
	}

	const body = text.slice(match[0].length);
	const bodyField = (label: string): string => {
		const line = new RegExp(`^\\*\\*${label}:\\*\\* (.*)$`, "m").exec(body)?.[1] ?? "";
		return line === "(none yet)" || line === "(none recorded)" ? "" : line;
	};

	const candidate = {
		runId: unquote(frontmatterValue(fm, "runId")),
		skill: unquote(frontmatterValue(fm, "skill")),
		stage: unquote(frontmatterValue(fm, "stage")),
		lockedDecisionPointers: pointers,
		latestDirective: bodyField("Latest directive"),
		correctionCount: Number(frontmatterValue(fm, "correctionCount") ?? 0),
		receiptPointers: receipts,
		nextSafeAction: bodyField("Next safe action"),
		checkpoint,
		history,
		escalatedToHuman: frontmatterValue(fm, "escalatedToHuman") === "true",
	};

	const parsed = DossierSchema.safeParse(candidate);
	if (!parsed.success) {
		const detail = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
		return { found: false, corrupt: true, reason: detail };
	}
	return { found: true, dossier: parsed.data };
}

/** Read a run's dossier from its deterministic path. Absent ≠ corrupt; see `parseDossier`. */
export function readDossier(projectRoot: string, runId: string): DossierRead {
	const target = dossierPath(projectRoot, runId);
	if (!existsSync(target)) return { found: false, corrupt: false };
	return parseDossier(readFileSync(target, "utf-8"));
}

/** Separator for never-auto-loaded history kept below the active summary. */
const HISTORY_MARKER = "\n<!-- supervision-history (never auto-loaded) -->\n";

/** Atomic temp+rename write; caller holds the lock. */
async function atomicWriteText(target: string, body: string): Promise<void> {
	const tmp = `${target}.tmp-${process.pid}`;
	try {
		await writeFile(tmp, body, "utf-8");
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

/**
 * Write the dossier atomically under a per-run lock, preserving any historical
 * receipts already below the active summary. A rejected dossier throws BEFORE the
 * write, so an invalid record never reaches disk.
 */
export async function writeDossier(projectRoot: string, dossier: Dossier): Promise<string> {
	const check = validateDossier(dossier);
	if (!check.ok) throw new Error(`invalid supervision dossier: ${check.errors.join("; ")}`);

	const target = dossierPath(projectRoot, dossier.runId);
	mkdirSync(join(projectRoot, "tasks", "reports"), { recursive: true });

	const lockPath = join(projectRoot, "tasks", "reports", `.${dossier.runId}-supervision.lock`);

	// The history read happens INSIDE the lock with the write. Reading first would let a
	// concurrent writer append history between the read and the rename, and this write
	// would then silently drop it. One parent owns a run, so the race is unlikely — but a
	// supervised parallel run is cheap to get wrong and expensive to debug.
	await withFileLock(lockPath, async () => {
		let history = "";
		if (existsSync(target)) {
			const existing = readFileSync(target, "utf-8");
			const idx = existing.indexOf(HISTORY_MARKER);
			if (idx !== -1) history = existing.slice(idx);
		}
		await atomicWriteText(target, renderDossier(dossier) + history);
	});
	return target;
}

/**
 * Read → mutate → write for one run, all inside the same lock.
 *
 * `readDossier` followed by `writeDossier` is NOT equivalent: the lock in
 * `writeDossier` covers only its own history-preserving rename, so two processes
 * that each read, mutate and write lose one of the two updates — and the update
 * being lost is a committed checkpoint, i.e. a spent cap slot that comes back. This
 * mirrors `updateTaskRecord`, which solved the same problem for the task record.
 *
 * The mutator receives `null` when no run exists yet, so creation and update take
 * the same guarded path.
 */
export async function updateDossier(
	projectRoot: string,
	runId: string,
	mutate: (existing: Dossier | null) => Dossier,
): Promise<Dossier> {
	const target = dossierPath(projectRoot, runId);
	mkdirSync(join(projectRoot, "tasks", "reports"), { recursive: true });
	const lockPath = join(projectRoot, "tasks", "reports", `.${runId}-supervision.lock`);

	let written!: Dossier;
	await withFileLock(lockPath, async () => {
		let existing: Dossier | null = null;
		let history = "";
		if (existsSync(target)) {
			const raw = readFileSync(target, "utf-8");
			const read = parseDossier(raw);
			// Fail closed inside the lock too: a damaged record must not be silently
			// replaced by a fresh one, which would hand the run a brand-new budget.
			if (!read.found) throw new CorruptDossierError(runId, read.corrupt ? read.reason : "unreadable");
			existing = read.dossier;
			const idx = raw.indexOf(HISTORY_MARKER);
			if (idx !== -1) history = raw.slice(idx);
		}

		const next = mutate(existing);
		const check = validateDossier(next);
		if (!check.ok) throw new Error(`invalid supervision dossier: ${check.errors.join("; ")}`);
		await atomicWriteText(target, renderDossier(next) + history);
		written = next;
	});
	return written;
}

/** A dossier exists but cannot be read. Distinct from "no such run" on purpose. */
export class CorruptDossierError extends Error {
	constructor(
		readonly runId: string,
		readonly detail: string,
	) {
		super(`supervision state for run "${runId}" is unreadable (${detail})`);
		this.name = "CorruptDossierError";
	}
}

/**
 * Every supervision run recorded in the project, by deterministic filename.
 *
 * Used to answer "is another run for this skill already escalated" — the check that
 * stops a fresh run id from being used to walk around an escalation. Corrupt records
 * are returned rather than skipped: silently ignoring one would restore the very
 * bypass this is here to close.
 */
export function listSupervisionRuns(projectRoot: string): { runId: string; read: DossierRead }[] {
	const dir = join(projectRoot, "tasks", "reports");
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith("-athena-supervision.md"))
		.map((f) => ({
			runId: f.slice(0, -"-athena-supervision.md".length),
			read: parseDossier(readFileSync(join(dir, f), "utf-8")),
		}));
}

/**
 * Mark a checkpoint `pending` before delegating. If the process dies mid-call, the
 * pending marker is what lets a resuming parent recognize the checkpoint as
 * already-attempted instead of spending another slot on it.
 */
export function beginCheckpoint(dossier: Dossier, marker: Omit<CheckpointMarker, "state">): Dossier {
	return { ...dossier, stage: marker.stage, checkpoint: { ...marker, state: "pending" } };
}

/**
 * Commit a delivered result, advancing the directive and correction count and
 * appending the call to `history`.
 *
 * The history entry is what a later call counts against the caps, so it is written
 * here — at the same moment the checkpoint becomes `committed` — rather than left to
 * the caller. A committed call that never reached the history would be a free slot.
 * Re-committing the same `checkpointId` replaces its entry instead of appending a
 * second one, so a retry cannot inflate the count it is supposed to be exempt from.
 */
export function commitCheckpoint(
	dossier: Dossier,
	result: {
		latestDirective: string;
		nextSafeAction: string;
		disposition: CheckpointRecord["disposition"];
		receiptPointer?: string;
		corrections?: number;
	},
): Dossier {
	const cp = dossier.checkpoint;
	// The partition comes from the marker, never from the commit call: the budget a
	// call spends is decided when the slot is claimed, so a commit cannot move it.
	const entry = cp
		? {
				checkpointId: cp.checkpointId,
				stage: cp.stage,
				disposition: result.disposition,
				...(cp.partition === undefined ? {} : { partition: cp.partition }),
			}
		: null;
	const history = entry
		? [...dossier.history.filter((h) => h.checkpointId !== entry.checkpointId), entry]
		: dossier.history;

	return {
		...dossier,
		latestDirective: result.latestDirective,
		nextSafeAction: result.nextSafeAction,
		correctionCount: dossier.correctionCount + (result.corrections ?? 0),
		receiptPointers: result.receiptPointer
			? [...new Set([...dossier.receiptPointers, result.receiptPointer])]
			: dossier.receiptPointers,
		checkpoint: cp ? { ...cp, state: "committed" } : null,
		history,
	};
}
