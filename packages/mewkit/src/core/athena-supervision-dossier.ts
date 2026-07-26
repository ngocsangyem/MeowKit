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
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { RUN_ID_RE, isValidRunId } from "./athena-supervision-mode.js";
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
});
export type CheckpointMarker = z.infer<typeof CheckpointMarkerSchema>;

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
		const keys = Object.keys(candidate as Record<string, unknown>);
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
 * Render the active portion: frontmatter plus a short human-readable summary. The
 * explicit not-verification line is part of the artifact, not decoration — a later
 * reader must not be able to mistake a directive for proof.
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
checkpoint: ${cp ? `{ checkpointId: ${yamlScalar(cp.checkpointId)}, stage: ${yamlScalar(cp.stage)}, state: ${yamlScalar(cp.state)} }` : "null"}
---

# Supervision run ${dossier.runId}

This is supervision continuity, NEVER verification and never a gate approval.

**Latest directive:** ${dossier.latestDirective || "(none yet)"}
**Next safe action:** ${dossier.nextSafeAction || "(none recorded)"}
`;
}

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

	const HISTORY_MARKER = "\n<!-- supervision-history (never auto-loaded) -->\n";
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
 * Mark a checkpoint `pending` before delegating. If the process dies mid-call, the
 * pending marker is what lets a resuming parent recognize the checkpoint as
 * already-attempted instead of spending another slot on it.
 */
export function beginCheckpoint(dossier: Dossier, marker: Omit<CheckpointMarker, "state">): Dossier {
	return { ...dossier, stage: marker.stage, checkpoint: { ...marker, state: "pending" } };
}

/** Commit a delivered result, advancing the directive and correction count. */
export function commitCheckpoint(
	dossier: Dossier,
	result: { latestDirective: string; nextSafeAction: string; receiptPointer?: string; corrections?: number },
): Dossier {
	return {
		...dossier,
		latestDirective: result.latestDirective,
		nextSafeAction: result.nextSafeAction,
		correctionCount: dossier.correctionCount + (result.corrections ?? 0),
		receiptPointers: result.receiptPointer
			? [...new Set([...dossier.receiptPointers, result.receiptPointer])]
			: dossier.receiptPointers,
		checkpoint: dossier.checkpoint ? { ...dossier.checkpoint, state: "committed" } : null,
	};
}
