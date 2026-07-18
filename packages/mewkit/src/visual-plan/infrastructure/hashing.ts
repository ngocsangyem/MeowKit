/**
 * Source-hash computation + stale detection for the visual artifact.
 *
 * The artifact pins the SHA-256 of the Markdown plan it was generated from
 * (`source.planHash`) and of every phase file (`source.phaseHashes`). If a
 * human edits `plan.md`/`phase-*.md` after generation, the recomputed hash
 * diverges and validation reports STALE_SOURCE_HASH — the artifact must be
 * regenerated or re-hashed (`rehash`) before it can be approved (red-team M1).
 *
 * `artifactHash` (SHA-256 of the plan.json bytes) is the pointer cached in
 * `.plan-state.json.visual.hash`; it detects artifact drift, not source drift.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { err, ErrorCode, type ValidationError } from "../domain/errors.js";
import type { VisualPlan } from "../domain/schemas.js";

/** Match `phase-NN-*.md`; capture the (possibly zero-padded) phase number. */
const PHASE_FILE_RE = /^phase-(\d+)-.*\.md$/i;

/** SHA-256 of a UTF-8 string, `sha256:`-prefixed lowercase hex. */
export function sha256(content: string): string {
	return `sha256:${crypto.createHash("sha256").update(content, "utf-8").digest("hex")}`;
}

/** SHA-256 of a file's bytes, or `null` if it cannot be read. */
export function hashFile(filePath: string): string | null {
	try {
		return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
	} catch {
		return null;
	}
}

/** SHA-256 of the artifact's on-disk bytes (the `.plan-state.json` pointer). */
export function artifactHash(planDir: string, artifactRelPath: string): string | null {
	return hashFile(path.join(planDir, artifactRelPath));
}

export interface SourceHashes {
	planHash: string;
	phaseHashes: Record<string, string>;
}

/**
 * Recompute source hashes from disk. `planPath` is resolved relative to
 * `planDir`; phase files are discovered by the `phase-NN-*.md` convention in
 * the plan directory. Missing plan file → empty planHash (validation catches it).
 */
export function computeSourceHashes(planDir: string, planPath: string): SourceHashes {
	const planHash = hashFile(path.join(planDir, planPath)) ?? "";
	const phaseHashes: Record<string, string> = {};
	let entries: string[] = [];
	try {
		entries = fs.readdirSync(planDir);
	} catch {
		entries = [];
	}
	for (const name of entries.sort()) {
		const m = name.match(PHASE_FILE_RE);
		if (!m) continue;
		const key = String(parseInt(m[1], 10));
		const h = hashFile(path.join(planDir, name));
		if (h) phaseHashes[key] = h;
	}
	return { planHash, phaseHashes };
}

/**
 * Compare the artifact's pinned source hashes against freshly-computed ones.
 * Any divergence (plan bytes changed, a phase added/removed/edited) is a
 * STALE_SOURCE_HASH error with the exact JSON path.
 */
export function checkSourceFreshness(plan: VisualPlan, planDir: string): ValidationError[] {
	const errors: ValidationError[] = [];
	const fresh = computeSourceHashes(planDir, plan.source.planPath);
	if (fresh.planHash !== plan.source.planHash) {
		errors.push(
			err(
				"source.planHash",
				ErrorCode.STALE_SOURCE_HASH,
				`plan.md hash diverged (expected ${plan.source.planHash || "<empty>"}, on disk ${fresh.planHash || "<missing>"})`,
			),
		);
	}
	const keys = new Set([...Object.keys(plan.source.phaseHashes), ...Object.keys(fresh.phaseHashes)]);
	for (const k of keys) {
		if (plan.source.phaseHashes[k] !== fresh.phaseHashes[k]) {
			errors.push(err(`source.phaseHashes.${k}`, ErrorCode.STALE_SOURCE_HASH, `phase ${k} hash diverged`));
		}
	}
	return errors;
}
