/**
 * Editable-plan hook — wires the fetch + the serialized MutationQueue.
 *
 * Edits go through the queue (one PATCH in flight, ETag-tracked). After a save
 * drains to `clean`, the hook REFETCHES the authoritative artifact rather than
 * mutating a local copy — this keeps the client and server byte-identical and
 * avoids a client/server apply divergence (optimistic local rendering is a
 * deferred UX enhancement, not a correctness requirement). A 409 `stale` triggers
 * a refetch + queue reload (the 409 never auto-replays).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { VisualPlan } from "../domain/artifact-types.js";
import { fetchPlan, patchPlan } from "../api/client.js";
import { MutationQueue, type SaveState } from "./mutation-queue.js";

export interface EditablePlan {
	plan: VisualPlan | null;
	error: string | null;
	saveState: SaveState;
	edit: (op: unknown) => void;
}

export function useEditablePlan(): EditablePlan {
	const [plan, setPlan] = useState<VisualPlan | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [saveState, setSaveState] = useState<SaveState>("clean");
	const queueRef = useRef<MutationQueue<unknown> | null>(null);
	const savingRef = useRef(false);
	const mountedRef = useRef(true);

	// Refetch the authoritative artifact. On failure, surface an error instead of
	// silently leaving a stale-but-"clean" UI (a persisted edit would look lost).
	// Returns the fresh ETag, or null when the refetch itself failed.
	const refetch = useCallback(async (): Promise<string | null> => {
		try {
			const loaded = await fetchPlan();
			if (!mountedRef.current) return null;
			setPlan(loaded.plan);
			return loaded.etag ?? "";
		} catch (e) {
			if (mountedRef.current) setError(`reload failed: ${e instanceof Error ? e.message : String(e)}`);
			return null;
		}
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		void (async () => {
			try {
				const loaded = await fetchPlan();
				if (!mountedRef.current) return;
				setPlan(loaded.plan);
				queueRef.current = new MutationQueue<unknown>((op, etag) => patchPlan(op, etag), loaded.etag ?? "", (s) => {
					setSaveState(s);
					if (s === "saving") savingRef.current = true;
					else if (s === "clean" && savingRef.current) {
						savingRef.current = false;
						void refetch();
					} else if (s === "stale") {
						savingRef.current = false;
						void refetch().then((etag) => {
							if (etag !== null) queueRef.current?.reload(etag);
						});
					}
				});
			} catch (e) {
				if (mountedRef.current) setError(e instanceof Error ? e.message : String(e));
			}
		})();
		return () => {
			mountedRef.current = false;
		};
	}, [refetch]);

	const edit = useCallback((op: unknown) => queueRef.current?.enqueue(op), []);
	return { plan, error, saveState, edit };
}
