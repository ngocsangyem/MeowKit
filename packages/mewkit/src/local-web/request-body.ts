/**
 * Bounded request-body reader with a socket timeout.
 *
 * Behavior extracted verbatim from the loopback write pipeline: collect the body
 * up to `capBytes`, destroying the socket and rejecting with `BodyError(413)` on
 * overflow or `BodyError(408)` on timeout. The cap + timeout are the DoS guard
 * for any POST/PATCH route; the consumer supplies both (the write pipeline uses
 * a 4096-byte cap).
 */

import type { IncomingMessage } from "node:http";

/** Carries the HTTP status + a short tag for a body-read failure. */
export class BodyError extends Error {
	constructor(
		public readonly status: number,
		public readonly tag: string,
	) {
		super(tag);
		this.name = "BodyError";
	}
}

/**
 * Collect the full request body up to `capBytes`. Destroys the socket if the
 * body exceeds the cap OR if `timeoutMs` elapses first. Rejects with
 * `BodyError(413,"body-too-large")` on overflow, `BodyError(408,"request-timeout")`
 * on timeout.
 */
export function bufferBody(req: IncomingMessage, capBytes: number, timeoutMs: number): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		let settled = false;

		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			req.socket?.destroy();
			reject(new BodyError(408, "request-timeout"));
		}, timeoutMs);

		req.on("data", (chunk: Buffer) => {
			total += chunk.length;
			if (total > capBytes) {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				req.socket?.destroy();
				reject(new BodyError(413, "body-too-large"));
				return;
			}
			chunks.push(chunk);
		});

		req.on("end", () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(Buffer.concat(chunks));
		});

		req.on("error", (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(err);
		});
	});
}
