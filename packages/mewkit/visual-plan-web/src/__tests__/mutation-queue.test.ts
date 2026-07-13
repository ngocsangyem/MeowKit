/**
 * Serialized save queue + state machine: one PATCH in flight at a time, ordered
 * ETag threading, 409 → stale (queue dropped, never auto-replayed), enqueue is a
 * no-op while stale, reload recovers, and a transport error → error state.
 */

import { describe, expect, it, vi } from "vitest";
import { MutationQueue, type PatchOutcome } from "../app/mutation-queue.js";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

describe("MutationQueue", () => {
	it("saves a single op: dirty → saving → clean, ETag advances", async () => {
		const patch = vi.fn(async (): Promise<PatchOutcome> => ({ ok: true, etag: "e1" }));
		const q = new MutationQueue<number>(patch, "e0");
		q.enqueue(1);
		await tick();
		expect(q.state).toBe("clean");
		expect(q.currentEtag).toBe("e1");
		expect(patch).toHaveBeenCalledWith(1, "e0");
	});

	it("serializes two rapid edits (one in flight) with ordered ETags", async () => {
		let n = 0;
		const seenEtags: string[] = [];
		const patch = vi.fn(async (_op: number, etag: string): Promise<PatchOutcome> => {
			seenEtags.push(etag);
			return { ok: true, etag: `e${++n}` };
		});
		const q = new MutationQueue<number>(patch, "e0");
		q.enqueue(1);
		q.enqueue(2); // enqueued behind the in-flight save
		await tick();
		expect(seenEtags).toEqual(["e0", "e1"]); // ordered, never concurrent
		expect(q.state).toBe("clean");
	});

	it("409 → stale: drops the queue, never auto-replays, enqueue is a no-op", async () => {
		const patch = vi.fn(async (): Promise<PatchOutcome> => ({ ok: false, stale: true, currentEtag: "e9" }));
		const q = new MutationQueue<number>(patch, "e0");
		q.enqueue(1);
		await tick();
		expect(q.state).toBe("stale");
		expect(q.currentEtag).toBe("e9");
		q.enqueue(2); // no-op while stale
		await tick();
		expect(patch).toHaveBeenCalledTimes(1); // 2 was not sent
	});

	it("reload recovers from stale to clean", async () => {
		const q = new MutationQueue<number>(async () => ({ ok: false, stale: true, currentEtag: "e9" }), "e0");
		q.enqueue(1);
		await tick();
		q.reload("e10");
		expect(q.state).toBe("clean");
		expect(q.currentEtag).toBe("e10");
	});

	it("transport error → error state", async () => {
		const q = new MutationQueue<number>(async () => {
			throw new Error("network");
		}, "e0");
		q.enqueue(1);
		await tick();
		expect(q.state).toBe("error");
	});
});
