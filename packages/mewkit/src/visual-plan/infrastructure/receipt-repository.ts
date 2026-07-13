/**
 * Resolution-receipt storage under `<plan-dir>/visual-plan/resolutions/`.
 *
 * A receipt records the per-operation outcome of applying a feedback batch
 * (applied | rejected | unresolved). Receipt EXISTENCE is the "batch resolved"
 * marker — the batch file itself stays byte-immutable. `writeReceipt` is
 * write-once (a second apply of the same batch is refused). The batch/receipt id
 * is validated against the strict pattern BEFORE any path join (red-team M8).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { isValidFeedbackBatchId } from "../domain/ids.js";
import { ResolutionReceiptSchema, type ResolutionReceipt } from "../domain/feedback-schemas.js";
import { atomicWriteFileSync } from "./atomic-write.js";

const RESOLUTIONS_DIR = path.join("visual-plan", "resolutions");

/** Receipt path for a batch id, validating the id BEFORE the join. Throws on a bad id. */
function receiptPath(planDir: string, batchId: string): string {
	if (!isValidFeedbackBatchId(batchId)) throw new Error(`invalid batch id: ${JSON.stringify(batchId)}`);
	return path.join(planDir, RESOLUTIONS_DIR, `${batchId}.json`);
}

/** True when a resolution receipt already exists for this batch (⇒ already applied). */
export function receiptExists(planDir: string, batchId: string): boolean {
	return fs.existsSync(receiptPath(planDir, batchId));
}

/** Persist a receipt write-once. Returns false if a receipt for this batch already exists. */
export function writeReceipt(planDir: string, receipt: ResolutionReceipt): boolean {
	const file = receiptPath(planDir, receipt.batchId);
	if (fs.existsSync(file)) return false; // double-apply guard
	fs.mkdirSync(path.dirname(file), { recursive: true });
	atomicWriteFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`);
	return true;
}

/** Read + validate every receipt in the plan (for approve's unresolved-check). */
export function listReceipts(planDir: string): ResolutionReceipt[] {
	let entries: string[];
	try {
		entries = fs.readdirSync(path.join(planDir, RESOLUTIONS_DIR));
	} catch {
		return [];
	}
	const out: ResolutionReceipt[] = [];
	for (const name of entries) {
		if (!name.endsWith(".json")) continue;
		try {
			const parsed = ResolutionReceiptSchema.safeParse(JSON.parse(fs.readFileSync(path.join(planDir, RESOLUTIONS_DIR, name), "utf-8")) as unknown);
			if (parsed.success) out.push(parsed.data);
		} catch {
			// skip unreadable/invalid receipt
		}
	}
	return out;
}
