/**
 * Immutable feedback-batch storage under `<plan-dir>/visual-plan/feedback/`.
 *
 * A batch file is write-once: `writeBatch` refuses to overwrite an existing id
 * (immutability is the misapplication guard). The batch id is validated against
 * the strict `feedback-<ts>-<slug>` pattern BEFORE any path join (red-team M8),
 * so a traversal/absolute/null-byte id can never escape the feedback dir.
 * Batches are committed to git by default (Validation Session 1) — they are
 * review evidence, like the plan files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { isValidFeedbackBatchId } from "../domain/ids.js";
import { FeedbackBatchSchema, type FeedbackBatch } from "../domain/feedback-schemas.js";
import { atomicWriteFileSync } from "./atomic-write.js";

const FEEDBACK_DIR = path.join("visual-plan", "feedback");

/** Absolute path to a batch file, validating the id BEFORE the join. Throws on a bad id. */
function batchPath(planDir: string, id: string): string {
	if (!isValidFeedbackBatchId(id)) throw new Error(`invalid feedback batch id: ${JSON.stringify(id)}`);
	return path.join(planDir, FEEDBACK_DIR, `${id}.json`);
}

/** Persist a batch write-once. Returns false if a batch with this id already exists. */
export function writeBatch(planDir: string, batch: FeedbackBatch): boolean {
	const file = batchPath(planDir, batch.id);
	if (fs.existsSync(file)) return false; // immutable — never overwrite
	fs.mkdirSync(path.dirname(file), { recursive: true });
	atomicWriteFileSync(file, `${JSON.stringify(batch, null, 2)}\n`);
	return true;
}

/** Read + validate a batch by id, or null when absent/invalid. Throws on a malformed id. */
export function readBatch(planDir: string, id: string): FeedbackBatch | null {
	const file = batchPath(planDir, id);
	let text: string;
	try {
		text = fs.readFileSync(file, "utf-8");
	} catch {
		return null;
	}
	const parsed = FeedbackBatchSchema.safeParse(JSON.parse(text) as unknown);
	return parsed.success ? parsed.data : null;
}

/** List batch ids present in the feedback dir (for `status` / orphan detection). */
export function listBatchIds(planDir: string): string[] {
	try {
		return fs
			.readdirSync(path.join(planDir, FEEDBACK_DIR))
			.filter((n) => n.endsWith(".json"))
			.map((n) => n.slice(0, -5))
			.filter(isValidFeedbackBatchId)
			.sort();
	} catch {
		return [];
	}
}
