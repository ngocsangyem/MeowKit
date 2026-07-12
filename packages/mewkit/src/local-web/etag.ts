/**
 * SHA-256 ETag + optimistic-concurrency (409-stale) helper.
 *
 * CONSOLIDATES the two prior sources: the standalone per-file SHA-256 ETag
 * (64-char lowercase hex of the file's bytes) and the write pipeline's 409-stale
 * check (`current !== provided ⇒ stale`). One canonical implementation drives
 * both a caller computing an ETag to hand out and a caller comparing a
 * client-supplied ETag before a write. Missing file ⇒ null (caller decides).
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";

/** 64-char lowercase hex SHA-256 of `content`. */
export function computeEtag(content: Buffer | string): string {
	return crypto.createHash("sha256").update(content).digest("hex");
}

/** SHA-256 ETag of a file's bytes, or null if it cannot be read. */
export function etagFromFile(filePath: string): string | null {
	try {
		return computeEtag(fs.readFileSync(filePath));
	} catch {
		return null;
	}
}

/**
 * True when a client-supplied ETag no longer matches the current one — the
 * optimistic-concurrency condition a write route answers with HTTP 409.
 */
export function isStaleEtag(currentEtag: string, providedEtag: string): boolean {
	return currentEtag !== providedEtag;
}
