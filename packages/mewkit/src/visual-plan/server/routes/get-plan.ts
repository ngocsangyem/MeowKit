/**
 * GET /api/visual-plan — serve the artifact JSON + a strong ETag.
 *
 * The ETag is the SHA-256 of the on-disk artifact bytes (via local-web's
 * `computeEtag`), so it is the SAME value the Phase-5 PATCH route will check with
 * `If-Match` — read and write agree on identity. Missing artifact → 404 (not a
 * throw); the studio shows an empty state.
 */

import * as fs from "node:fs";
import type { ServerResponse } from "node:http";
import { computeEtag } from "../../../local-web/etag.js";
import { artifactPath } from "../../infrastructure/visual-plan-repository.js";

/** Write a small JSON response. */
export function writeJson(res: ServerResponse, status: number, body: unknown): void {
	const text = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": String(Buffer.byteLength(text)),
	});
	res.end(text);
}

/** Serve the raw artifact bytes for `planDir` with an ETag, or 404 when absent. */
export function handleGetPlan(res: ServerResponse, planDir: string): void {
	let bytes: Buffer;
	try {
		bytes = fs.readFileSync(artifactPath(planDir));
	} catch {
		writeJson(res, 404, { error: "no-visual-artifact" });
		return;
	}
	// Hash the raw bytes (not a decoded string) so this ETag is byte-identical to
	// what the Phase-5 PATCH If-Match check (etagFromFile → Buffer) computes.
	res.writeHead(200, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": String(bytes.byteLength),
		ETag: computeEtag(bytes),
		"Cache-Control": "no-store",
	});
	res.end(bytes);
}
