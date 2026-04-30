/**
 * useOverlays — poll /api/overlays every 5s for meowkit-specific overlays.
 */

import { useEffect, useState } from "react";

export interface OverlayState {
	gate1: { name: string; approved: boolean } | null;
	gate2: { name: string; verdict: string } | null;
	model: string | null;
	cost: { tokens: number; usd: number } | null;
	phase: string | null;
}

const EMPTY: OverlayState = {
	gate1: null,
	gate2: null,
	model: null,
	cost: null,
	phase: null,
};

export function useOverlays(intervalMs: number = 5000): OverlayState {
	const [state, setState] = useState<OverlayState>(EMPTY);

	useEffect(() => {
		let alive = true;
		let warned = false;
		const fetchOnce = async (): Promise<void> => {
			try {
				const res = await fetch("/api/overlays", { cache: "no-cache" });
				if (!res.ok) return;
				const json = (await res.json()) as Partial<OverlayState>;
				if (alive) setState({ ...EMPTY, ...json });
			} catch (err) {
				if (!warned) {
					warned = true;
					console.warn("[orchviz] /api/overlays unreachable; will keep retrying silently:", err);
				}
			}
		};
		void fetchOnce();
		const id = window.setInterval(() => void fetchOnce(), intervalMs);
		return () => {
			alive = false;
			window.clearInterval(id);
		};
	}, [intervalMs]);

	return state;
}
