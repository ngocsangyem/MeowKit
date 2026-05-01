/**
 * ETag helpers — per-phase-file sha256 hash.
 *
 * Per red-team H2 / R2-2: ETag scope is per-FILE, NOT a bundle hash.
 * Concurrent writes to different phases do not produce false 409s.
 *
 * computePhaseFileEtag(phaseFilePath) → 64-char lowercase hex sha256.
 * Missing file → "" (not an error; caller decides how to handle absent files).
 *
 * computeAllPhaseEtags(planDir) → Record<phaseNumber, hex64>
 * for every phase-NN-*.md in the directory.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { PHASE_FILE_NUM_RE } from "./plan-constants.js";

/**
 * Compute sha256 of a single phase file's bytes.
 * Returns 64-char lowercase hex, or "" if the file cannot be read.
 */
export function computePhaseFileEtag(phaseFilePath: string): string {
	let buf: Buffer;
	try {
		buf = fs.readFileSync(phaseFilePath);
	} catch {
		return "";
	}
	return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Compute etags for every phase-NN-*.md file in planDir.
 * Returns a Record keyed by phase number (integer).
 * Missing or unreadable files are omitted.
 */
export function computeAllPhaseEtags(planDir: string): Record<number, string> {
	let entries: string[];
	try {
		entries = fs.readdirSync(planDir);
	} catch {
		return {};
	}
	const out: Record<number, string> = {};
	for (const name of entries) {
		const m = name.match(PHASE_FILE_NUM_RE);
		if (!m) continue;
		const phaseNum = parseInt(m[1], 10);
		const filePath = path.join(planDir, name);
		const etag = computePhaseFileEtag(filePath);
		if (etag !== "") {
			out[phaseNum] = etag;
		}
	}
	return out;
}
