/**
 * Feedback routes:
 *   POST /api/visual-plan/feedback       → freeze accumulated semantic ops into an
 *                                           immutable batch; returns id + Copy Command.
 *   GET  /api/visual-plan/feedback/:id    → read a batch (id validated before any
 *                                           path join by the repository).
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { bufferBody, BodyError } from "../../../local-web/request-body.js";
import { prepareFeedback } from "../../application/prepare-feedback.js";
import { readBatch } from "../../infrastructure/feedback-repository.js";
import { writeJson } from "./get-plan.js";

const BODY_CAP = 256 * 1024;
const TIMEOUT_MS = 5000;

export async function handlePostFeedback(req: IncomingMessage, res: ServerResponse, planDir: string): Promise<void> {
	if (!(req.headers["content-type"] ?? "").toLowerCase().includes("application/json")) {
		writeJson(res, 415, { error: "unsupported-media-type" });
		return;
	}
	let raw: Buffer;
	try {
		raw = await bufferBody(req, BODY_CAP, TIMEOUT_MS);
	} catch (e) {
		writeJson(res, e instanceof BodyError ? e.status : 400, {
			error: e instanceof BodyError ? e.tag : "body-read-error",
		});
		return;
	}
	let body: unknown;
	try {
		body = JSON.parse(raw.toString("utf-8"));
	} catch {
		writeJson(res, 400, { error: "invalid-json" });
		return;
	}
	const operations = (body as { operations?: unknown }).operations;
	if (!Array.isArray(operations)) {
		writeJson(res, 400, { error: "missing-operations" });
		return;
	}
	const r = prepareFeedback(planDir, operations);
	if (!r.ok) {
		writeJson(res, 400, { error: "prepare-failed", message: r.error });
		return;
	}
	writeJson(res, 201, { ok: true, id: r.batchId, copyCommand: r.copyCommand });
}

/** `id` is validated inside the repository (throws on a malformed id) → mapped to 400. */
export function handleGetFeedback(res: ServerResponse, planDir: string, id: string): void {
	let batch;
	try {
		batch = readBatch(planDir, id);
	} catch {
		writeJson(res, 400, { error: "invalid-batch-id" });
		return;
	}
	if (!batch) {
		writeJson(res, 404, { error: "batch-not-found" });
		return;
	}
	writeJson(res, 200, batch);
}
