/**
 * write-handlers — POST /api/plan/todo handler.
 *
 * Pipeline: readonly → method → origin → CT → body → parse → zod
 *   → slug → boundary (R2-15) → orphan cleanup (R2-13)
 *   → phase glob (R2-1) → file boundary (M15) → etag → toggle
 *   → no-op early return → atomic write → invalidate → 200.
 * Helpers live in write-utils.ts. Red-team: H4 H5 M11 M15 R2-1 R2-6
 *   R2-10 R2-13 R2-14 R2-15 SEC#8.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { applyTodoToggle } from "../plan/apply-todo-toggle.js";
import { atomicWriteFileSync, cleanOrphanedTmps } from "../plan/atomic-write.js";
import { SLUG_RE, buildPhaseNumberRe } from "../plan/plan-constants.js";
import type { PlanCollector } from "../plan/collector.js";
import { createLogger } from "../logger.js";
import {
	isOriginAllowed,
	bufferBody,
	BodyError,
	resolvePlanDirBoundary,
	resolvePhaseFileBoundary,
	writeJson,
} from "./write-utils.js";

export { handleTodoPreflight } from "./write-utils.js";

const log = createLogger("PlanWriter");

// ── Inline zod schema (R2-10) ───────────────────────────────────────────────
const TodoWriteRequest = z.object({
	slug: z.string(),
	phase: z.number().int().min(0).max(99),
	todoIdx: z.number().int().min(0).max(999),
	checked: z.boolean(),
	etag: z.string().regex(/^[0-9a-f]{64}$/),
});
type TodoWriteRequestType = z.infer<typeof TodoWriteRequest>;

const BODY_CAP = 4096;
const DEFAULT_TIMEOUT_MS = 5000;
function reqTimeout(): number {
	const v = parseInt(process.env.MEOWKIT_ORCHVIZ_REQ_TIMEOUT_MS ?? "", 10);
	return Number.isFinite(v) && v > 0 ? v : DEFAULT_TIMEOUT_MS;
}

export interface WriteHandlerContext {
	projectRoot: string;
	port: number;
	planCollector?: PlanCollector;
}

// Per-process: tracks which slugs we have already cleaned of orphan tmps.
// Intentionally unbounded — slug count is bounded by the plans directory size.
const cleanedSlugs = new Set<string>();

export async function handleTodoWrite(
	req: IncomingMessage,
	res: ServerResponse,
	ctx: WriteHandlerContext,
): Promise<void> {
	if (process.env.MEOWKIT_ORCHVIZ_READONLY === "1") { writeJson(res, 405, { error: "readonly" }); return; }
	if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }); res.end(); return; }

	const origin = req.headers["origin"] ?? "";
	if (!isOriginAllowed(origin, ctx.port)) {
		log.warn("origin-rejected", { originHeader: origin });
		writeJson(res, 403, { error: "forbidden-origin" });
		return;
	}

	const ct = req.headers["content-type"] ?? "";
	if (!ct.toLowerCase().includes("application/json")) { writeJson(res, 415, { error: "unsupported-media-type" }); return; }

	let rawBuf: Buffer;
	try {
		rawBuf = await bufferBody(req, BODY_CAP, reqTimeout());
	} catch (err) {
		writeJson(res, err instanceof BodyError ? err.status : 400, { error: err instanceof BodyError ? err.tag : "body-read-error" });
		return;
	}

	let parsed: unknown;
	try { parsed = JSON.parse(rawBuf.toString("utf-8")); }
	catch { writeJson(res, 400, { error: "invalid-json" }); return; }

	const validated = TodoWriteRequest.safeParse(parsed);
	if (!validated.success) { writeJson(res, 400, { error: "validation-failed", details: validated.error.issues }); return; }
	const body: TodoWriteRequestType = validated.data;

	if (!SLUG_RE.test(body.slug)) {
		log.warn("invalid-slug", { httpStatus: 400 });
		writeJson(res, 400, { error: "invalid-slug" });
		return;
	}

	const plansDir = path.join(ctx.projectRoot, "tasks", "plans");
	const planDir = path.join(plansDir, body.slug);

	// 8. Boundary check — resolvedPlanDir cached once (R2-15)
	const boundary = resolvePlanDirBoundary(plansDir, planDir);
	if (!boundary) {
		log.warn("plandir-boundary-failed", { slug: body.slug, httpStatus: 403 });
		writeJson(res, 403, { error: "forbidden-path" });
		return;
	}
	const { resolvedPlanDir } = boundary;

	// R2-13: orphan cleanup on first write per slug
	if (!cleanedSlugs.has(body.slug)) { cleanedSlugs.add(body.slug); cleanOrphanedTmps(resolvedPlanDir); }

	// 9. Phase glob — zero-pad regex (R2-1 CRITICAL)
	const phaseRe = buildPhaseNumberRe(body.phase);
	let dirEntries: string[];
	try { dirEntries = fs.readdirSync(resolvedPlanDir); }
	catch { writeJson(res, 404, { error: "plan-not-found" }); return; }

	const matches = dirEntries.filter((n) => !n.startsWith(".") && phaseRe.test(n));
	if (matches.length !== 1) {
		log.warn("ambiguous-phase", { slug: body.slug, phase: body.phase, matchCount: matches.length, httpStatus: 400 });
		writeJson(res, 400, { error: "ambiguous-phase" });
		return;
	}

	// 10. Realpath check on globbed file (M15 + R2-15)
	const resolvedPhaseFile = resolvePhaseFileBoundary(path.join(resolvedPlanDir, matches[0]), resolvedPlanDir);
	if (!resolvedPhaseFile) {
		log.warn("phasefile-boundary-failed", { slug: body.slug, phase: body.phase, httpStatus: 403 });
		writeJson(res, 403, { error: "forbidden-path" });
		return;
	}

	// 12-14. Single read; derive ETag from buffer (avoids second readFileSync)
	let fileBuf: Buffer;
	try { fileBuf = fs.readFileSync(resolvedPhaseFile); }
	catch { writeJson(res, 500, { error: "file-read-failed" }); return; }

	const currentEtag = crypto.createHash("sha256").update(fileBuf).digest("hex");
	if (currentEtag !== body.etag) {
		log.debug("stale-etag", { slug: body.slug, phase: body.phase, todoIdx: body.todoIdx, httpStatus: 409 });
		writeJson(res, 409, { error: "stale", currentEtag });
		return;
	}

	const result = applyTodoToggle(fileBuf.toString("utf-8"), body.todoIdx, body.checked);
	if ("error" in result) {
		log.warn("toggle-error", { slug: body.slug, phase: body.phase, todoIdx: body.todoIdx, errorTag: result.error, httpStatus: 400 });
		writeJson(res, 400, { error: result.error });
		return;
	}

	// 15. Idempotent no-op
	if (!result.changed) {
		log.debug("no-op", { slug: body.slug, phase: body.phase, todoIdx: body.todoIdx, changed: false, httpStatus: 200 });
		writeJson(res, 200, { ok: true, changed: false, etag: currentEtag });
		return;
	}

	// 16. Atomic write
	try { atomicWriteFileSync(resolvedPhaseFile, result.content); }
	catch { writeJson(res, 500, { error: "write-failed" }); return; }

	// 17-18. New etag (hash the just-written content directly, no re-read) + invalidate + respond
	const newEtag = crypto.createHash("sha256").update(result.content).digest("hex");
	ctx.planCollector?.invalidate();
	log.debug("write-success", { slug: body.slug, phase: body.phase, todoIdx: body.todoIdx, changed: true, httpStatus: 200 });
	writeJson(res, 200, { ok: true, changed: true, etag: newEtag });
}
