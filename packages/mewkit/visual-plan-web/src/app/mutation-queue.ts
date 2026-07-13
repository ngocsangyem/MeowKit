/**
 * Serialized mutation queue + save state machine.
 *
 * The heart of Phase-5 editing: at most ONE PATCH is in flight at a time, edits
 * queue behind it, and a 409 (stale) NEVER auto-replays queued semantic ops — it
 * drops the queue and moves to `stale`, from which only an explicit reload
 * recovers. This deliberately avoids agent-native's un-serialized per-keystroke
 * autosave race. Framework-agnostic (no React) so the state machine is unit-
 * testable with an injected patch function.
 *
 *   clean ──enqueue──▶ dirty ──pump──▶ saving
 *   saving ──200──▶ clean | dirty (more queued)
 *   saving ──409──▶ stale (queue dropped; reload to recover)
 *   saving ──error──▶ error (retryable on next enqueue)
 */

export type SaveState = "clean" | "dirty" | "saving" | "stale" | "error";

export interface PatchOutcome {
	ok: boolean;
	etag?: string;
	stale?: boolean;
	currentEtag?: string;
}

export type PatchFn<Op> = (op: Op, etag: string) => Promise<PatchOutcome>;

export class MutationQueue<Op> {
	private queue: Op[] = [];
	private inFlight = false;
	private stateValue: SaveState = "clean";

	constructor(
		private readonly patchFn: PatchFn<Op>,
		private etag: string,
		private readonly onState: (s: SaveState) => void = () => {},
	) {}

	get state(): SaveState {
		return this.stateValue;
	}

	get currentEtag(): string {
		return this.etag;
	}

	private set(s: SaveState): void {
		this.stateValue = s;
		this.onState(s);
	}

	/** Enqueue an op. No-op while `stale` (reload first). */
	enqueue(op: Op): void {
		if (this.stateValue === "stale") return;
		this.queue.push(op);
		if (this.stateValue !== "saving") this.set("dirty");
		void this.pump();
	}

	/** Recover from `stale`/`error` after the caller refetched the artifact. */
	reload(newEtag: string): void {
		this.etag = newEtag;
		this.queue = [];
		this.inFlight = false;
		this.set("clean");
	}

	private async pump(): Promise<void> {
		if (this.inFlight || this.queue.length === 0 || this.stateValue === "stale") return;
		this.inFlight = true;
		this.set("saving");
		const op = this.queue[0];
		let res: PatchOutcome;
		try {
			res = await this.patchFn(op, this.etag);
		} catch {
			res = { ok: false };
		}
		this.inFlight = false;

		if (res.ok && res.etag) {
			this.queue.shift();
			this.etag = res.etag;
			this.set(this.queue.length > 0 ? "dirty" : "clean");
			void this.pump();
		} else if (res.stale) {
			this.queue = []; // 409 never auto-replays semantic ops
			if (res.currentEtag) this.etag = res.currentEtag;
			this.set("stale");
		} else {
			this.set("error"); // keep the queue; a later enqueue re-pumps
		}
	}
}
