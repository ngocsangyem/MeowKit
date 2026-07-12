/**
 * Characterization: bounded body reader. Encodes the source behavior — resolve
 * within the cap, BodyError(413) on overflow, BodyError(408) on timeout — and
 * that the socket is destroyed on the two failure paths.
 */

import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { bufferBody, BodyError } from "../request-body.js";

/** Minimal fake IncomingMessage: an emitter with a destroyable socket. */
function fakeReq(): { req: IncomingMessage; destroy: ReturnType<typeof vi.fn> } {
	const emitter = new EventEmitter() as EventEmitter & { socket: { destroy: () => void } };
	const destroy = vi.fn();
	emitter.socket = { destroy };
	return { req: emitter as unknown as IncomingMessage, destroy };
}

describe("bufferBody", () => {
	it("resolves with the full body when under the cap", async () => {
		const { req } = fakeReq();
		const p = bufferBody(req, 4096, 1000);
		req.emit("data", Buffer.from("hello "));
		req.emit("data", Buffer.from("world"));
		req.emit("end");
		expect((await p).toString()).toBe("hello world");
	});

	it("rejects BodyError(413) and destroys the socket when over the cap", async () => {
		const { req, destroy } = fakeReq();
		const p = bufferBody(req, 8, 1000);
		req.emit("data", Buffer.from("0123456789")); // 10 > cap 8
		await expect(p).rejects.toMatchObject({ status: 413, tag: "body-too-large" });
		expect(destroy).toHaveBeenCalled();
	});

	it("rejects BodyError(408) on timeout and destroys the socket", async () => {
		const { req, destroy } = fakeReq();
		const p = bufferBody(req, 4096, 20); // never emit end
		await expect(p).rejects.toBeInstanceOf(BodyError);
		await expect(p).rejects.toMatchObject({ status: 408 });
		expect(destroy).toHaveBeenCalled();
	});
});
