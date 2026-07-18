/**
 * PATCH /api/visual-plan — apply ONE typed visual patch op under optimistic
 * concurrency. Body is a single `PatchOp` (JSON, bounded); `If-Match` carries the
 * client's ETag. Maps the patch orchestrator's outcome to HTTP: 200 + new ETag,
 * 409 stale (never auto-replays), 400 malformed/rejected op, 422 invalid result.
 * The body cap is the DoS guard (from local-web).
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { bufferBody, BodyError } from "../../../local-web/request-body.js";
import { PatchOpSchema } from "../../domain/patches.js";
import { patchPlan } from "../../application/patch-plan.js";
import { writeJson } from "./get-plan.js";

const BODY_CAP = 64 * 1024;
const TIMEOUT_MS = 5000;

export async function handlePatch(req: IncomingMessage, res: ServerResponse, planDir: string): Promise<void> {
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
	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(raw.toString("utf-8"));
	} catch {
		writeJson(res, 400, { error: "invalid-json" });
		return;
	}
	const op = PatchOpSchema.safeParse(parsedJson);
	if (!op.success) {
		writeJson(res, 400, { error: "invalid-patch-op", details: op.error.issues });
		return;
	}

	// Optimistic locking is mandatory over the wire: a PATCH without If-Match is
	// refused (428) so a raw client cannot bypass the concurrency check and clobber.
	const ifMatch = req.headers["if-match"];
	if (typeof ifMatch !== "string" || ifMatch.length === 0) {
		writeJson(res, 428, { error: "precondition-required", message: "If-Match header is required" });
		return;
	}
	const result = patchPlan(planDir, op.data, ifMatch);
	switch (result.status) {
		case "ok":
			res.setHeader("ETag", result.etag ?? "");
			writeJson(res, 200, { ok: true, revision: result.revision, etag: result.etag });
			return;
		case "stale":
			writeJson(res, 409, { error: "stale", currentEtag: result.currentEtag });
			return;
		case "op-rejected":
			writeJson(res, 400, { error: "op-rejected", message: result.message });
			return;
		case "invalid-result":
			writeJson(res, 422, { error: "invalid-result", errors: result.errors });
			return;
		default:
			writeJson(res, 404, { error: result.status });
	}
}
